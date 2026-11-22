// Bridge between the annotation model (lib/annotations.ts) and Fabric objects. The model is the source of
// truth: objects are created from it, and read back into it after the user moves, resizes or edits them.

import { FabricImage, type FabricObject, IText, Path, Rect } from 'fabric';

import {
  type Annotation,
  annotationSchema,
  arrowPath,
  type PathCommand,
  pixelateData,
  TEXT_MAX_CHARS,
  textHaloFor,
  translateAnnotation,
} from '@/lib/annotations';

export const TEXT_FONT = '"Inter Variable", Inter, system-ui, sans-serif';
const ACCENT = '#C2410C';

interface Meta {
  /** The annotation as created; reads apply the object's movement since then. */
  annotation: Annotation;
  origin: { left: number; top: number };
}

const metas = new WeakMap<FabricObject, Meta>();

/** Selection handles in the Qatch accent; no rotation or skew anywhere. */
const INTERACTION = {
  originX: 'left',
  originY: 'top',
  lockRotation: true,
  lockSkewingX: true,
  lockSkewingY: true,
  borderColor: ACCENT,
  cornerColor: ACCENT,
  cornerStrokeColor: '#FFFFFF',
  cornerStyle: 'circle',
  transparentCorners: false,
  borderScaleFactor: 2,
} as const;

/** Arrows, pen strokes and text can be moved but not resized (their size follows the screenshot). */
const MOVE_ONLY = { lockScalingX: true, lockScalingY: true, hasControls: false } as const;

function track(obj: FabricObject, annotation: Annotation): FabricObject {
  obj.setControlVisible('mtr', false);
  metas.set(obj, { annotation, origin: { left: obj.left, top: obj.top } });
  return obj;
}

export function annotationOf(obj: FabricObject): Annotation | undefined {
  return metas.get(obj)?.annotation;
}

/** A canvas with the region's pixels averaged in blocks: the original pixels are not in it. */
export function pixelatedRegion(
  source: CanvasImageSource,
  a: Extract<Annotation, { type: 'blur' }>,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(a.w));
  const h = Math.max(1, Math.round(a.h));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(source, Math.round(a.x), Math.round(a.y), w, h, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  pixelateData(pixels.data, w, h, a.block);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function strokePath(path: PathCommand[], color: string, stroke: number): Path {
  return new Path(path, {
    ...INTERACTION,
    ...MOVE_ONLY,
    fill: '',
    stroke: color,
    strokeWidth: stroke,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
  });
}

/** The Fabric object for an annotation. `source` is the original screenshot (for blur). */
export function createObject(a: Annotation, source: CanvasImageSource): FabricObject {
  switch (a.type) {
    case 'rect':
      return track(
        new Rect({
          ...INTERACTION,
          left: a.x,
          top: a.y,
          width: a.w,
          height: a.h,
          fill: '',
          stroke: a.color,
          strokeWidth: a.stroke,
          strokeUniform: true,
          rx: a.stroke,
          ry: a.stroke,
        }),
        a,
      );
    case 'blur':
      return track(
        new FabricImage(pixelatedRegion(source, a), {
          ...INTERACTION,
          left: Math.round(a.x),
          top: Math.round(a.y),
        }),
        a,
      );
    case 'arrow':
      return track(strokePath(arrowPath(a.x1, a.y1, a.x2, a.y2, a.stroke), a.color, a.stroke), a);
    case 'pen':
      return track(strokePath(a.path, a.color, a.stroke), a);
    case 'text':
      return track(createText(a), a);
  }
}

export function createText(a: Extract<Annotation, { type: 'text' }>): IText {
  const halo = textHaloFor(a.color, a.size);
  return new IText(a.text, {
    ...INTERACTION,
    ...MOVE_ONLY,
    left: a.x,
    top: a.y,
    fontFamily: TEXT_FONT,
    fontSize: a.size,
    fontWeight: 600,
    // The chosen colour is the text colour; no label background. A contrasting halo (stroke painted under
    // the fill) keeps it readable on light and dark screenshots.
    fill: a.color,
    stroke: halo.color,
    strokeWidth: halo.width,
    strokeLineJoin: 'round',
    paintFirst: 'stroke',
    cursorColor: a.color,
    editingBorderColor: ACCENT,
  });
}

/** Starts tracking a text object created by the text tool (it may still be empty). */
export function trackText(obj: IText, a: Extract<Annotation, { type: 'text' }>): IText {
  track(obj, a);
  return obj;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * The annotation an object now represents, after moves, resizes or text edits. `undefined` for objects that
 * are not annotations, and for empty text (which is dropped).
 */
export function readObject(obj: FabricObject): Annotation | undefined {
  const meta = metas.get(obj);
  if (!meta) return undefined;
  const a = meta.annotation;
  const dx = round(obj.left - meta.origin.left);
  const dy = round(obj.top - meta.origin.top);

  let next: Annotation;
  switch (a.type) {
    case 'rect':
    case 'blur':
      next = {
        ...a,
        x: round(obj.left),
        y: round(obj.top),
        w: round(obj.width * obj.scaleX),
        h: round(obj.height * obj.scaleY),
      };
      break;
    case 'text': {
      const text = obj instanceof IText ? obj.text.slice(0, TEXT_MAX_CHARS) : a.text;
      if (!text.trim()) return undefined;
      next = { ...a, x: round(a.x + dx), y: round(a.y + dy), text };
      break;
    }
    default:
      next = translateAnnotation(a, dx, dy);
  }
  // Never let an odd edit (e.g. resized to nothing) produce an invalid model: keep the last valid one.
  const parsed = annotationSchema.safeParse(next);
  return parsed.success ? parsed.data : a;
}
