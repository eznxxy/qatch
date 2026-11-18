import type { ReportDetails, Severity, Visibility } from '@qatch/shared';
import { REPORT_DESCRIPTION_MAX_CHARS, REPORT_TITLE_MAX_CHARS } from '@qatch/shared/config';

import { TagInput } from './TagInput';

const SEVERITIES: { id: Severity; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical' },
];

const VISIBILITIES: { id: Visibility; label: string; hint: string }[] = [
  { id: 'private', label: 'Private', hint: 'Only you, after signing in' },
  { id: 'unlisted', label: 'Unlisted', hint: 'Anyone with the link (includes a secret token)' },
  { id: 'public', label: 'Public', hint: 'Anyone with the report address, no token needed' },
];

interface DetailsFormProps {
  details: ReportDetails;
  onChange: (patch: Partial<ReportDetails>) => void;
}

export function DetailsForm({ details, onChange }: DetailsFormProps) {
  return (
    <form
      className="details"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="field">
        <label htmlFor="q-title" className="field__label">
          Title <span className="field__required">*</span>
        </label>
        <input
          id="q-title"
          type="text"
          className="input"
          value={details.title}
          maxLength={REPORT_TITLE_MAX_CHARS}
          placeholder="What went wrong?"
          required
          aria-required="true"
          onChange={(event) => {
            onChange({ title: event.target.value });
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="q-desc" className="field__label">
          Description
        </label>
        <textarea
          id="q-desc"
          className="input input--multiline"
          rows={4}
          value={details.description}
          maxLength={REPORT_DESCRIPTION_MAX_CHARS}
          placeholder="Steps to reproduce, what you expected, what happened"
          onChange={(event) => {
            onChange({ description: event.target.value });
          }}
        />
      </div>

      <fieldset className="field">
        <legend className="field__label">Severity</legend>
        <div className="segmented segmented--4">
          {SEVERITIES.map(({ id, label }) => (
            <label key={id} className="segmented__option">
              <input
                type="radio"
                name="severity"
                value={id}
                className="visually-hidden"
                checked={details.severity === id}
                onChange={() => {
                  onChange({ severity: id });
                }}
              />
              <span className={`dot dot--${id}`} aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="q-tags" className="field__label">
          Tags
        </label>
        <TagInput
          id="q-tags"
          tags={details.tags}
          onChange={(tags) => {
            onChange({ tags });
          }}
        />
      </div>

      <fieldset className="field">
        <legend className="field__label">Who can open the link</legend>
        <div className="choices">
          {VISIBILITIES.map(({ id, label, hint }) => (
            <label key={id} className="choice">
              <input
                type="radio"
                name="visibility"
                value={id}
                className="choice__input"
                checked={details.visibility === id}
                aria-describedby={`vis-${id}-hint`}
                onChange={() => {
                  onChange({ visibility: id });
                }}
              />
              <span className="choice__text">
                <span className="choice__label">{label}</span>
                <span id={`vis-${id}-hint`} className="choice__hint">
                  {hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}
