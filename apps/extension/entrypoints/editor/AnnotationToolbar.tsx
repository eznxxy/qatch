import { DownloadIcon } from '@/components/icons';
import { ANNOTATION_COLORS, type AnnotationColor } from '@/lib/annotations';
import type { CanvasView } from '@/lib/canvas-fit';

import { type Tool, TOOLS } from './tools';

const VIEWS: readonly { id: CanvasView; label: string; title: string }[] = [
  { id: 'fit', label: 'Fit', title: 'Fit the screenshot to the window' },
  { id: 'actual', label: '100%', title: 'Show the screenshot at actual size (sharpest)' },
];

interface AnnotationToolbarProps {
  view: CanvasView;
  onViewChange: (view: CanvasView) => void;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: AnnotationColor;
  onColorChange: (color: AnnotationColor) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
  downloading: boolean;
}

function PathIcon({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export function AnnotationToolbar(props: AnnotationToolbarProps) {
  const { tool, color } = props;
  return (
    <div role="toolbar" aria-label="Annotation tools" className="annot">
      <div role="group" aria-label="Tool" className="annot__group">
        {TOOLS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className="annot__btn"
            aria-label={label}
            title={label}
            aria-pressed={tool === id}
            onClick={() => {
              props.onToolChange(id);
            }}
          >
            <PathIcon d={icon} />
          </button>
        ))}
      </div>

      <span className="annot__sep" aria-hidden="true" />

      <div role="group" aria-label="Colour" className="annot__group annot__colors">
        {ANNOTATION_COLORS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            className="annot__swatch"
            aria-label={label}
            title={label}
            aria-pressed={color === value}
            onClick={() => {
              props.onColorChange(value);
            }}
          >
            <span className="annot__swatch-dot" data-color={value} aria-hidden="true" />
          </button>
        ))}
      </div>

      <span className="annot__sep" aria-hidden="true" />

      <button
        type="button"
        className="annot__btn"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        aria-keyshortcuts="Control+Z Meta+Z"
        disabled={!props.canUndo}
        onClick={props.onUndo}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
        </svg>
      </button>
      <button
        type="button"
        className="annot__btn"
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        aria-keyshortcuts="Control+Shift+Z Control+Y Meta+Shift+Z"
        disabled={!props.canRedo}
        onClick={props.onRedo}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M15 14l5-5-5-5" />
          <path d="M20 9H10a6 6 0 0 0 0 12h3" />
        </svg>
      </button>

      <span className="annot__sep" aria-hidden="true" />

      <div role="group" aria-label="Screenshot size" className="segmented annot__view">
        {VIEWS.map(({ id, label, title }) => (
          <button
            key={id}
            type="button"
            className="segmented__option"
            title={title}
            aria-pressed={props.view === id}
            onClick={() => {
              props.onViewChange(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn btn--compact annot__download"
        onClick={props.onDownload}
        disabled={props.downloading}
      >
        <DownloadIcon size={16} />
        Download PNG
      </button>
    </div>
  );
}
