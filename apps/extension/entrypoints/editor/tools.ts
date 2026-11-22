export type Tool = 'select' | 'arrow' | 'rect' | 'pen' | 'text' | 'blur';

/** Toolbar order and icons from the Qatch UI design. */
export const TOOLS: readonly { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: 'M5 3l14 7-6 2-2 6z' },
  { id: 'arrow', label: 'Arrow', icon: 'M5 19L19 5M9 5h10v10' },
  { id: 'rect', label: 'Rectangle', icon: 'M4 6h16v12H4z' },
  { id: 'pen', label: 'Freehand', icon: 'M3 17c3-6 5 4 8-2s5 3 10-4' },
  { id: 'text', label: 'Text', icon: 'M5 6V4h14v2M12 4v16M9 20h6' },
  {
    id: 'blur',
    label: 'Blur / redact',
    icon: 'M4 4h5v5H4zM15 4h5v5h-5zM9.5 9.5h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z',
  },
];
