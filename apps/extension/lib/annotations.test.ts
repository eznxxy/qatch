import { describe, expect, it } from 'vitest';

import {
  type Annotation,
  ANNOTATIONS_MAX,
  annotationsSchema,
  arrowPath,
  blurBlockFor,
  commitHistory,
  createHistory,
  fontSizeFor,
  HISTORY_LIMIT,
  orderAnnotations,
  pixelateData,
  redoHistory,
  strokeWidthFor,
  textColorOn,
  translateAnnotation,
  undoHistory,
} from './annotations';

const rect: Annotation = {
  id: 'r',
  type: 'rect',
  x: 10,
  y: 20,
  w: 30,
  h: 40,
  color: '#E5484D',
  stroke: 4,
};
const blur: Annotation = { id: 'b', type: 'blur', x: 0, y: 0, w: 50, h: 50, block: 16 };
const arrow: Annotation = {
  id: 'a',
  type: 'arrow',
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 0,
  color: '#2B59C3',
  stroke: 4,
};
const pen: Annotation = {
  id: 'p',
  type: 'pen',
  path: [
    ['M', 1, 2],
    ['Q', 3, 4, 5, 6],
    ['L', 7, 8],
  ],
  color: '#F5A524',
  stroke: 4,
};
const text: Annotation = {
  id: 't',
  type: 'text',
  x: 5,
  y: 5,
  text: 'NaN',
  color: '#E5484D',
  size: 20,
};

describe('annotationsSchema', () => {
  it('accepts every annotation type', () => {
    const all = [rect, blur, arrow, pen, text];
    expect(annotationsSchema.parse(all)).toEqual(all);
  });

  it.each([
    ['an unknown colour', { ...rect, color: '#000000' }],
    ['a zero-size rectangle', { ...rect, w: 0 }],
    ['an infinite coordinate', { ...rect, x: Infinity }],
    ['empty text', { ...text, text: '' }],
    ['a one-point pen stroke', { ...pen, path: [['M', 1, 2]] }],
    [
      'a malformed path command',
      {
        ...pen,
        path: [
          ['M', 1],
          ['L', 2, 3],
        ],
      },
    ],
    ['an unknown type', { ...rect, type: 'circle' }],
  ])('rejects %s', (_name, value) => {
    expect(annotationsSchema.safeParse([value]).success).toBe(false);
  });

  it('caps the number of annotations', () => {
    const many = Array.from({ length: ANNOTATIONS_MAX + 1 }, (_, i) => ({ ...rect, id: `r${i}` }));
    expect(annotationsSchema.safeParse(many).success).toBe(false);
  });
});

describe('sizing', () => {
  it('scales with the screenshot width within limits', () => {
    expect(strokeWidthFor(1280)).toBe(4);
    expect(strokeWidthFor(2560)).toBe(8);
    expect(strokeWidthFor(100)).toBe(3);
    expect(strokeWidthFor(20_000)).toBe(16);
    expect(fontSizeFor(1280)).toBe(20);
    expect(fontSizeFor(2560)).toBe(40);
    expect(blurBlockFor(1280)).toBe(16);
    expect(blurBlockFor(400)).toBe(12);
  });

  it('uses dark text on amber and white text otherwise', () => {
    expect(textColorOn('#F5A524')).toBe('#17181C');
    expect(textColorOn('#E5484D')).toBe('#FFFFFF');
    expect(textColorOn('#2B59C3')).toBe('#FFFFFF');
  });
});

describe('arrowPath', () => {
  it('draws the shaft and a head that ends at the tip', () => {
    const path = arrowPath(0, 0, 100, 0, 4);
    expect(path[0]).toEqual(['M', 0, 0]);
    expect(path[1]).toEqual(['L', 100, 0]);
    expect(path[3]).toEqual(['L', 100, 0]);
    expect(path).toHaveLength(5);
    const [, wingX, wingY] = path[2] as ['M', number, number];
    const [, , otherWingY] = path[4] as ['L', number, number];
    expect(wingX).toBeLessThan(100);
    expect(wingY).toBeCloseTo(-otherWingY); // symmetric wings
  });

  it('keeps the head at most half of a short arrow', () => {
    const [, wingX] = arrowPath(0, 0, 10, 0, 8)[2] as ['M', number, number];
    expect(10 - wingX).toBeLessThanOrEqual(5.01);
  });
});

describe('translateAnnotation', () => {
  it('moves every coordinate of every type', () => {
    expect(translateAnnotation(rect, 1, 2)).toMatchObject({ x: 11, y: 22, w: 30, h: 40 });
    expect(translateAnnotation(arrow, 1, 2)).toMatchObject({ x1: 1, y1: 2, x2: 101, y2: 2 });
    expect(translateAnnotation(text, 1, 2)).toMatchObject({ x: 6, y: 7 });
    expect(translateAnnotation(pen, 1, 2)).toMatchObject({
      path: [
        ['M', 2, 4],
        ['Q', 4, 6, 6, 8],
        ['L', 8, 10],
      ],
    });
  });

  it('returns the same object when not moved', () => {
    expect(translateAnnotation(rect, 0, 0)).toBe(rect);
  });
});

describe('orderAnnotations', () => {
  it('puts blurs at the bottom and otherwise keeps the order', () => {
    expect(orderAnnotations([rect, blur, arrow]).map((a) => a.id)).toEqual(['b', 'r', 'a']);
  });
});

describe('history', () => {
  it('undoes and redoes', () => {
    let h = createHistory([]);
    h = commitHistory(h, [rect]);
    h = commitHistory(h, [rect, arrow]);
    h = undoHistory(h);
    expect(h.present).toEqual([rect]);
    h = undoHistory(h);
    expect(h.present).toEqual([]);
    expect(undoHistory(h)).toBe(h); // nothing left
    h = redoHistory(h);
    h = redoHistory(h);
    expect(h.present).toEqual([rect, arrow]);
    expect(redoHistory(h)).toBe(h);
  });

  it('clears redo after a new change', () => {
    let h = commitHistory(createHistory([]), [rect]);
    h = undoHistory(h);
    h = commitHistory(h, [arrow]);
    expect(h.future).toEqual([]);
    expect(redoHistory(h)).toBe(h);
  });

  it('ignores commits that change nothing', () => {
    const h = commitHistory(createHistory([]), [rect]);
    expect(commitHistory(h, [{ ...rect }])).toBe(h);
  });

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    let h = createHistory([]);
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = commitHistory(h, [{ ...rect, x: i }]);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe('pixelateData', () => {
  it('replaces each block with its average and covers partial edge blocks', () => {
    // 3x1 image, block 2: pixels 0-1 average, pixel 2 alone.
    const data = new Uint8ClampedArray([0, 0, 0, 255, 100, 200, 50, 255, 9, 9, 9, 255]);
    pixelateData(data, 3, 1, 2);
    expect([...data]).toEqual([50, 100, 25, 255, 50, 100, 25, 255, 9, 9, 9, 255]);
  });

  it('leaves no original pixel pattern inside a block', () => {
    const w = 4;
    const data = new Uint8ClampedArray(w * w * 4).map((_, i) => (i * 37) % 256);
    pixelateData(data, w, w, 4);
    const first = [...data.slice(0, 4)];
    for (let i = 0; i < data.length; i += 4) expect([...data.slice(i, i + 4)]).toEqual(first);
  });
});
