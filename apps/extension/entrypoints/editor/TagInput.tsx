import { REPORT_TAG_MAX_CHARS, REPORT_TAGS_MAX_COUNT } from '@qatch/shared/config';
import { type KeyboardEvent, useState } from 'react';

import { CloseIcon } from '@/components/icons';
import { addTag, removeTag } from '@/lib/tags';

interface TagInputProps {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

/** Chips plus a text box: Enter or comma adds a tag, Backspace in an empty box removes the last one. */
export function TagInput({ id, tags, onChange }: TagInputProps) {
  const [text, setText] = useState('');
  const full = tags.length >= REPORT_TAGS_MAX_COUNT;

  function commit() {
    if (!text.trim()) return;
    onChange(addTag(tags, text));
    setText('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && text === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="tags">
      <ul className="tags__list" aria-label="Tags">
        {tags.map((tag) => (
          <li key={tag} className="tag">
            {tag}
            <button
              type="button"
              className="tag__remove"
              aria-label={`Remove tag ${tag}`}
              onClick={() => {
                onChange(removeTag(tags, tag));
              }}
            >
              <CloseIcon size={12} strokeWidth={2.2} />
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        type="text"
        className="tags__input"
        value={text}
        maxLength={REPORT_TAG_MAX_CHARS}
        disabled={full}
        placeholder={full ? `Up to ${REPORT_TAGS_MAX_COUNT} tags` : 'Add tag'}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      <span id={`${id}-hint`} className="visually-hidden">
        Press Enter or comma to add a tag.
      </span>
    </div>
  );
}
