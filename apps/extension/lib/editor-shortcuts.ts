export type EditorCommand = 'undo' | 'redo' | 'delete';

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * The editor command for a key press, if any. `typing` is true when focus is in a text field (form inputs,
 * or Fabric's hidden textarea while editing a text annotation): those keys belong to the field.
 */
export function editorCommandFor(event: KeyLike, typing: boolean): EditorCommand | undefined {
  if (typing || event.altKey) return undefined;
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (mod && key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (mod && key === 'y' && !event.shiftKey) return 'redo';
  if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) return 'delete';
  return undefined;
}

/** True for elements that take text input. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset'].includes(
    type,
  );
}
