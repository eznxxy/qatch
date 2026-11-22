// Owns the Fabric canvas for the editor (FR-04): drawing tools, selection, sync with the annotation model,
// and the flattened PNG export. Scene coordinates are the screenshot's native pixels. The canvas is drawn at
// its displayed size (times devicePixelRatio) with a Fabric zoom, so the browser never rescales the bitmap
// (which blurs it); the export renders the scene again at native size.

import {
  ActiveSelection,
  Canvas,
  FabricImage,
  type FabricObject,
  IText,
  Path,
  PencilBrush,
  Rect,
  type TPointerEventInfo,
} from 'fabric';

import {
  type Annotation,
  type AnnotationColor,
  annotationSchema,
  arrowPath,
  blurBlockFor,
  fontSizeFor,
  orderAnnotations,
  strokeWidthFor,
} from '@/lib/annotations';
import { type CanvasView, fitCanvas } from '@/lib/canvas-fit';

import {
  annotationOf,
  createObject,
  createText,
  readObject,
  trackText,
} from './fabric-annotations';
import type { Tool } from './tools';

type ShapeTool = 'arrow' | 'rect' | 'blur';

interface Drag {
  tool: ShapeTool;
  start: { x: number; y: number };
  preview: FabricObject;
}

const newId = () => crypto.randomUUID();
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const round = (n: number) => Math.round(n * 10) / 10;

export class AnnotationEngine {
  private readonly canvas: Canvas;
  private readonly width: number;
  private readonly height: number;
  private readonly stroke: number;
  private tool: Tool = 'select';
  private color: AnnotationColor = '#E5484D';
  private drag: Drag | undefined;
  /** The model the canvas currently shows; `setAnnotations` with the same array is a no-op. */
  private synced: Annotation[] | undefined;
  /** True while rebuilding from the model: canvas events then must not write back. */
  private rebuilding = false;

  constructor(
    element: HTMLCanvasElement,
    private readonly image: HTMLImageElement,
    private readonly onChange: (next: Annotation[]) => void,
  ) {
    this.width = image.naturalWidth;
    this.height = image.naturalHeight;
    this.stroke = strokeWidthFor(this.width);

    this.canvas = new Canvas(element, {
      width: this.width,
      height: this.height,
      enableRetinaScaling: true,
      preserveObjectStacking: true,
      uniformScaling: false,
      selectionColor: 'rgba(194, 65, 12, 0.08)',
      selectionBorderColor: '#C2410C',
      selectionLineWidth: 2,
    });
    this.canvas.backgroundImage = new FabricImage(image, {
      originX: 'left',
      originY: 'top',
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
    });

    // Downscaling the screenshot with the default ('low') quality makes its text soft.
    this.canvas.on('before:render', ({ ctx }) => {
      ctx.imageSmoothingQuality = 'high';
    });

    this.canvas.on('mouse:down', (e) => {
      this.onPointerDown(e);
    });
    this.canvas.on('mouse:move', (e) => {
      this.onPointerMove(e);
    });
    this.canvas.on('mouse:up', (e) => {
      this.onPointerUp(e);
    });
    this.canvas.on('path:created', ({ path }) => {
      this.onPathCreated(path);
    });
    this.canvas.on('object:modified', ({ target }) => {
      this.onModified(target);
    });
    this.canvas.on('text:editing:exited', () => {
      if (!this.rebuilding) this.commit();
    });
  }

  /** Shows `list` unless the canvas already shows it (i.e. the change came from the canvas). */
  setAnnotations(list: Annotation[]): void {
    if (list !== this.synced) this.rebuild(list);
  }

  setTool(tool: Tool, color: AnnotationColor): void {
    this.tool = tool;
    this.color = color;
    this.cancelDrag();

    const selecting = tool === 'select';
    this.canvas.isDrawingMode = tool === 'pen';
    if (tool === 'pen') {
      const brush = new PencilBrush(this.canvas);
      brush.color = color;
      brush.width = this.stroke;
      brush.decimate = Math.max(1, this.stroke / 2); // fewer points per stroke
      this.canvas.freeDrawingBrush = brush;
    }
    this.canvas.selection = selecting;
    this.canvas.skipTargetFind = !selecting;
    this.canvas.defaultCursor = selecting ? 'default' : tool === 'text' ? 'text' : 'crosshair';
    if (!selecting) this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  /**
   * Sizes the canvas for `view` (see fitCanvas) and zooms the scene to match. The backing store follows the
   * current devicePixelRatio, so call again after a browser zoom change.
   */
  fit(available: { width: number; height: number }, view: CanvasView): void {
    const size = fitCanvas(
      { width: this.width, height: this.height },
      available,
      view,
      window.devicePixelRatio,
    );
    if (!size) return;
    this.canvas.setDimensions({ width: size.width, height: size.height });
    this.canvas.setZoom(size.zoom);
  }

  /** Removes the selected annotations. False if nothing was removed (e.g. while editing text). */
  deleteSelection(): boolean {
    const active = this.canvas.getActiveObject();
    if (!active || (active instanceof IText && active.isEditing)) return false;
    const objects = this.canvas.getActiveObjects();
    this.canvas.discardActiveObject();
    this.canvas.remove(...objects);
    this.commit();
    return true;
  }

  /** The screenshot with all annotations flattened into it, at native resolution. */
  exportPng(): Promise<Blob> {
    const active = this.canvas.getActiveObject();
    if (active instanceof IText && active.isEditing) active.exitEditing();
    this.canvas.discardActiveObject();
    // Render at zoom 1 over the native size; toCanvasElement(1 / zoom) could round a pixel off the edge.
    const viewport = this.canvas.viewportTransform;
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    let output: HTMLCanvasElement;
    try {
      output = this.canvas.toCanvasElement(1, { width: this.width, height: this.height });
    } finally {
      this.canvas.setViewportTransform(viewport);
    }
    return new Promise((resolve, reject) => {
      output.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG export failed'));
      }, 'image/png');
    });
  }

  dispose(): Promise<boolean> {
    return this.canvas.dispose();
  }

  // --- Model sync ---

  private rebuild(list: Annotation[]): void {
    this.rebuilding = true;
    try {
      this.cancelDrag();
      const active = this.canvas.getActiveObject();
      if (active instanceof IText && active.isEditing) active.exitEditing();
      this.canvas.discardActiveObject();
      this.canvas.remove(...this.canvas.getObjects());
      for (const a of orderAnnotations(list)) this.canvas.add(createObject(a, this.image));
      this.synced = list;
      this.canvas.requestRenderAll();
    } finally {
      this.rebuilding = false;
    }
  }

  /** Reads the canvas back into the model and reports it. Drops empty text. */
  private commit(): Annotation[] {
    // Objects inside a multi-selection have group-relative positions; dissolve it first.
    if (this.canvas.getActiveObject() instanceof ActiveSelection) this.canvas.discardActiveObject();
    const next: Annotation[] = [];
    for (const obj of this.canvas.getObjects()) {
      if (!annotationOf(obj)) continue;
      const a = readObject(obj);
      if (a) next.push(a);
      // Empty text is dropped, unless it is still being typed (it joins the model once it has text).
      else if (!(obj instanceof IText && obj.isEditing)) this.canvas.remove(obj);
    }
    this.synced = next;
    this.canvas.requestRenderAll();
    this.onChange(next);
    return next;
  }

  private onModified(target: FabricObject): void {
    if (this.rebuilding) return;
    const touched = target instanceof ActiveSelection ? target.getObjects() : [target];
    const next = this.commit();
    // A moved or resized blur must be pixelated again from the pixels now under it.
    if (touched.some((obj) => annotationOf(obj)?.type === 'blur')) this.rebuild(next);
  }

  // --- Drawing ---

  private point(e: TPointerEventInfo) {
    return {
      x: round(clamp(e.scenePoint.x, 0, this.width)),
      y: round(clamp(e.scenePoint.y, 0, this.height)),
    };
  }

  private onPointerDown(e: TPointerEventInfo): void {
    const { tool } = this;
    if (tool === 'select' || tool === 'pen') return;
    const p = this.point(e);
    if (tool === 'text') {
      this.startText(p);
      return;
    }
    const preview = tool === 'arrow' ? this.arrowPreview(p, p) : this.boxPreview(tool);
    this.canvas.add(preview);
    this.drag = { tool, start: p, preview };
  }

  private onPointerMove(e: TPointerEventInfo): void {
    const { drag } = this;
    if (!drag) return;
    const p = this.point(e);
    if (drag.tool === 'arrow') {
      this.canvas.remove(drag.preview);
      drag.preview = this.arrowPreview(drag.start, p);
      this.canvas.add(drag.preview);
    } else {
      const box = boxBetween(drag.start, p);
      drag.preview.set({ left: box.x, top: box.y, width: box.w, height: box.h });
      drag.preview.setCoords();
    }
    this.canvas.requestRenderAll();
  }

  private onPointerUp(e: TPointerEventInfo): void {
    const { drag } = this;
    if (!drag) return;
    this.cancelDrag();
    const end = this.point(e);
    const min = Math.max(6, this.stroke * 2); // smaller is a click, not a shape

    let annotation: Annotation;
    if (drag.tool === 'arrow') {
      if (Math.hypot(end.x - drag.start.x, end.y - drag.start.y) < min) return;
      annotation = {
        id: newId(),
        type: 'arrow',
        x1: drag.start.x,
        y1: drag.start.y,
        x2: end.x,
        y2: end.y,
        color: this.color,
        stroke: this.stroke,
      };
    } else {
      const box = boxBetween(drag.start, end);
      if (box.w < min || box.h < min) return;
      annotation =
        drag.tool === 'rect'
          ? { id: newId(), type: 'rect', ...box, color: this.color, stroke: this.stroke }
          : { id: newId(), type: 'blur', ...roundBox(box), block: blurBlockFor(this.width) };
    }

    const obj = createObject(annotation, this.image);
    if (annotation.type === 'blur') {
      // Blurs sit below every mark (see orderAnnotations).
      const blurs = this.canvas.getObjects().filter((o) => annotationOf(o)?.type === 'blur').length;
      this.canvas.insertAt(blurs, obj);
    } else {
      this.canvas.add(obj);
    }
    this.commit();
  }

  private onPathCreated(path: FabricObject): void {
    this.canvas.remove(path);
    if (this.rebuilding || !(path instanceof Path)) return;
    const parsed = annotationSchema.safeParse({
      id: newId(),
      type: 'pen',
      path: path.path,
      color: this.color,
      stroke: this.stroke,
    });
    if (!parsed.success) return; // e.g. a single dot, or an extremely long stroke
    this.canvas.add(createObject(parsed.data, this.image));
    this.commit();
  }

  private startText(p: { x: number; y: number }): void {
    const annotation = {
      id: newId(),
      type: 'text' as const,
      x: p.x,
      y: p.y,
      text: ' ', // placeholder for the model; the object starts empty and is dropped if left empty
      color: this.color,
      size: fontSizeFor(this.width),
    };
    const text = trackText(createText({ ...annotation, text: '' }), annotation);
    this.canvas.add(text);
    this.canvas.setActiveObject(text);
    text.enterEditing();
    text.hiddenTextarea?.focus();
    this.canvas.requestRenderAll();
  }

  private boxPreview(tool: 'rect' | 'blur'): Rect {
    const blur = tool === 'blur';
    return new Rect({
      originX: 'left',
      originY: 'top',
      width: 0,
      height: 0,
      fill: blur ? 'rgba(23, 24, 28, 0.18)' : '',
      stroke: blur ? '#17181C' : this.color,
      strokeWidth: blur ? Math.max(2, this.stroke / 2) : this.stroke,
      strokeDashArray: blur ? [this.stroke * 2, this.stroke * 2] : null,
      strokeUniform: true,
      selectable: false,
      evented: false,
    });
  }

  private arrowPreview(from: { x: number; y: number }, to: { x: number; y: number }): Path {
    return new Path(arrowPath(from.x, from.y, to.x, to.y, this.stroke), {
      fill: '',
      stroke: this.color,
      strokeWidth: this.stroke,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: false,
      evented: false,
    });
  }

  private cancelDrag(): void {
    if (this.drag) this.canvas.remove(this.drag.preview);
    this.drag = undefined;
  }
}

function boxBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: round(Math.abs(b.x - a.x)),
    h: round(Math.abs(b.y - a.y)),
  };
}

function roundBox(box: { x: number; y: number; w: number; h: number }) {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    w: Math.max(1, Math.round(box.w)),
    h: Math.max(1, Math.round(box.h)),
  };
}
