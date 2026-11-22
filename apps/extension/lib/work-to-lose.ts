// P1-6 follow-up: closing the editor deletes the draft, so warn first, but only when closing would throw away
// something the user added. A bare screenshot (or only a changed severity/visibility) closes silently.

import type { ReportDetails } from '@qatch/shared';

import type { Annotation } from './annotations';

export function hasWorkToLose(annotations: readonly Annotation[], details: ReportDetails): boolean {
  return (
    annotations.length > 0 ||
    details.title.trim() !== '' ||
    details.description.trim() !== '' ||
    details.tags.length > 0
  );
}
