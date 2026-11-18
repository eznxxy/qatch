// Annotation model (FR-04). Plain data in screenshot pixel coordinates: saved in the draft, replayed by undo
// and redo, and rendered by Fabric in the editor. Fabric is only the view; this is the source of truth.

import { z } from 'zod';

export const ANNOTATION_COLORS = [
  { id: 'red', label: 'Red', value: '#E5484D' },
  { id: 'amber', label: 'Amber', value: '#F5A524' },
  { id: 'blue', label: 'Blue', value: '#2B59C3' },
] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number]['value'];

const colorSchema = z.enum(['#E5484D', '#F5A524', '#2B59C3']);

/** Far outside any real screenshot, but finite and bounded. */
const coord = z.number().min(-100_000).max(100_000);
const size = z.number().positive().max(100_000);
const width = z.number().positive().max(200);

const pathCommandSchema = z.union([
  z.tuple([z.literal('M'), coord, coord]),
  z.tuple([z.literal('L'), coord, coord]),
  z.tuple([z.literal('Q'), coord, coord, coord, coord]),
  z.tuple([z.literal('C'), coord, coord, coord, coord, coord, coord]),
  z.tuple([z.literal('Z')]),
]);
export type PathCommand = z.infer<typeof pathCommandSchema>;

export const ANNOTATIONS_MAX = 500;
export const PEN_COMMANDS_MAX = 10_000;
export const TEXT_MAX_CHARS = 1_000;

const id = z.string().min(1).max(64);

export const annotationSchema = z.discriminatedUnion('type', [
  z.object({
    id,
    type: z.literal('rect'),
    x: coord,
    y: coord,
    w: size,
    h: size,
    color: colorSchema,
    stroke: width,
  }),
  z.object({
    id,
    type: z.literal('arrow'),
    x1: coord,
    y1: coord,
    x2: coord,
    y2: coord,
    color: colorSchema,
    stroke: width,
  }),
  z.object({
    id,
    type: z.literal('pen'),
    path: z.array(pathCommandSchema).min(2).max(PEN_COMMANDS_MAX),
    color: colorSchema,
    stroke: width,
  }),
  z.object({
    id,
    type: z.literal('text'),
    x: coord,
    y: coord,
    text: z.string().min(1).max(TEXT_MAX_CHARS),
    color: colorSchema,
    size: z.number().positive().max(400),
  }),
  /** Pixelated in place; flattened into the exported image (the original pixels are not kept in it). */
  z.object({ id, type: z.literal('blur'), x: coord, y: coord, w: size, h: size, block: width }),
]);
export type Annotation = z.infer<typeof annotationSchema>;
export type AnnotationType = Annotation['type'];

export const annotationsSchema = z.array(annotationSchema).max(ANNOTATIONS_MAX);

// --- Sizing: annotations scale with the screenshot so they look the same on 1x and 2x captures ---

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function strokeWidthFor(imageWidth: number): number {
  return clamp(Math.round(imageWidth / 320), 3, 16);
}

export function fontSizeFor(imageWidth: number): number {
  return clamp(Math.round(imageWidth / 64), 14, 72);
}

/**
 * Pixelation block size. Large on purpose: small blocks over text can be partly reversed, so a block is
 * at least as tall as a line of body text.
 */
export function blurBlockFor(imageWidth: number): number {
  return Math.max(12, Math.round(imageWidth / 80));
}

/** Readable text colour on a label of the given colour (white fails contrast on amber). */
export function textColorOn(color: AnnotationColor): string {
  return color === '#F5A524' ? '#17181C' : '#FFFFFF';
}

// --- Geometry ---

/** Shaft plus a two-stroke head at (x2, y2). Head length scales with the stroke, at most half the shaft. */
export function arrowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: number,
): PathCommand[] {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const head = Math.min(Math.max(stroke * 4, 12), length / 2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  const hx = (a: number) => x2 - head * Math.cos(angle - a);
  const hy = (a: number) => y2 - head * Math.sin(angle - a);
  return [
    ['M', x1, y1],
    ['L', x2, y2],
    ['M', hx(spread), hy(spread)],
    ['L', x2, y2],
    ['L', hx(-spread), hy(-spread)],
  ];
}

function translatePath(path: PathCommand[], dx: number, dy: number): PathCommand[] {
  return path.map((command): PathCommand => {
    switch (command[0]) {
      case 'M':
      case 'L':
        return [command[0], command[1] + dx, command[2] + dy];
      case 'Q':
        return ['Q', command[1] + dx, command[2] + dy, command[3] + dx, command[4] + dy];
      case 'C':
        return [
          'C',
          command[1] + dx,
          command[2] + dy,
          command[3] + dx,
          command[4] + dy,
          command[5] + dx,
          command[6] + dy,
        ];
      case 'Z':
        return ['Z'];
    }
  });
}

/** The same annotation moved by (dx, dy). */
export function translateAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  if (dx === 0 && dy === 0) return a;
  switch (a.type) {
    case 'rect':
    case 'blur':
    case 'text':
      return { ...a, x: a.x + dx, y: a.y + dy };
    case 'arrow':
      return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
    case 'pen':
      return { ...a, path: translatePath(a.path, dx, dy) };
  }
}

/** Blurs first (bottom), so marks drawn over a blurred area stay visible. Otherwise keeps the order. */
export function orderAnnotations(list: readonly Annotation[]): Annotation[] {
  return [...list.filter((a) => a.type === 'blur'), ...list.filter((a) => a.type !== 'blur')];
}

// --- Undo / redo ---

export const HISTORY_LIMIT = 100;

export interface History {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
}

export function createHistory(present: Annotation[]): History {
  return { past: [], present, future: [] };
}

const same = (a: Annotation[], b: Annotation[]) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/** Records a new state. No-op if nothing changed; clears redo; keeps at most HISTORY_LIMIT undo steps. */
export function commitHistory(history: History, next: Annotation[]): History {
  if (same(history.present, next)) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function undoHistory(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}

/** Each pixel block replaced by its average colour. Works on RGBA data in place. */
export function pixelateData(data: Uint8ClampedArray, w: number, h: number, block: number): void {
  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      const xEnd = Math.min(bx + block, w);
      const yEnd = Math.min(by + block, h);
      const sum = [0, 0, 0, 0];
      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 4; c++) sum[c] = (sum[c] ?? 0) + (data[i + c] ?? 0);
        }
      }
      const count = (xEnd - bx) * (yEnd - by);
      const avg = sum.map((s) => Math.round(s / count));
      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 4; c++) data[i + c] = avg[c] ?? 0;
        }
      }
    }
  }
}
