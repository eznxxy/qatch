import type { ReportDetails } from '@qatch/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Logo } from '@/components/Logo';
import {
  type Annotation,
  type AnnotationColor,
  commitHistory,
  createHistory,
  type History,
  redoHistory,
  undoHistory,
} from '@/lib/annotations';
import type { CanvasView } from '@/lib/canvas-fit';
import { closeCurrentTab } from '@/lib/chrome-api';
import { downloadBlob } from '@/lib/download';
import { screenshotFileName } from '@/lib/download-name';
import type { Draft } from '@/lib/draft';
import { parseDraftId } from '@/lib/draft-id';
import { deleteDraft } from '@/lib/draft-store';
import { editorCommandFor, isTypingTarget } from '@/lib/editor-shortcuts';
import { hasWorkToLose } from '@/lib/work-to-lose';

import { AnnotationCanvas } from './AnnotationCanvas';
import type { AnnotationEngine } from './annotation-engine';
import { AnnotationToolbar } from './AnnotationToolbar';
import { EditorHeader } from './EditorHeader';
import { ReportPanel } from './ReportPanel';
import type { Tool } from './tools';
import { useDraft } from './use-draft';
import { combineSaveStatus, useDraftSaver } from './use-draft-saver';

const MODE_LABELS: Record<Draft['mode'], string> = {
  visible: 'Screenshot · visible area',
  full: 'Screenshot · full page',
  region: 'Screenshot · region',
};

const writeDetails = (draft: Draft, details: ReportDetails): Draft => ({ ...draft, details });
const writeAnnotations = (draft: Draft, annotations: Annotation[]): Draft => ({
  ...draft,
  annotations,
});

export function App() {
  const state = useDraft(parseDraftId(window.location.search));

  if (state.kind !== 'ready') {
    return (
      <div className="notice">
        <Logo size={32} />
        {state.kind === 'loading' && <p role="status">Loading capture…</p>}
        {state.kind === 'missing' && (
          <p role="alert">
            This capture no longer exists. Start a new capture from the Qatch button.
          </p>
        )}
        {state.kind === 'error' && (
          <p role="alert">Couldn&apos;t load this capture. Reload the page to try again.</p>
        )}
      </div>
    );
  }

  return <Editor draft={state.draft} imageUrl={state.imageUrl} />;
}

function Editor({ draft, imageUrl }: { draft: Draft; imageUrl: string }) {
  const [details, setDetails] = useState(draft.details);
  const detailsSaver = useDraftSaver(draft.id, writeDetails);

  const [history, setHistory] = useState<History>(() => createHistory(draft.annotations));
  const annotationsSaver = useDraftSaver(draft.id, writeAnnotations);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<AnnotationColor>('#E5484D');
  const [view, setView] = useState<CanvasView>('fit');
  const engineRef = useRef<AnnotationEngine | null>(null);

  const [discarding, setDiscarding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState(false);

  // Save annotations whenever they change (not for the initial state loaded from the draft).
  const loaded = useRef(history.present);
  const saveAnnotations = annotationsSaver.save;
  useEffect(() => {
    if (history.present !== loaded.current) saveAnnotations(history.present);
  }, [history.present, saveAnnotations]);

  const onAnnotationsChange = useCallback((next: Annotation[]) => {
    setHistory((h) => commitHistory(h, next));
  }, []);
  const undo = useCallback(() => {
    setHistory(undoHistory);
  }, []);
  const redo = useCallback(() => {
    setHistory(redoHistory);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = editorCommandFor(event, isTypingTarget(event.target));
      if (command === 'undo') undo();
      else if (command === 'redo') redo();
      else if (command !== 'delete' || !engineRef.current?.deleteSelection()) return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [undo, redo]);

  // Closing the editor deletes the draft (P1-6), so ask first when there is something to lose. Chrome shows
  // its own "Leave site?" dialog (also on reload, which is harmless) and only after the user interacted.
  const workToLose = hasWorkToLose(history.present, details);
  const leavingOnPurpose = useRef(false);
  useEffect(() => {
    if (!workToLose) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!leavingOnPurpose.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [workToLose]);

  function updateDetails(patch: Partial<ReportDetails>) {
    const next = { ...details, ...patch };
    setDetails(next);
    detailsSaver.save(next);
  }

  async function download() {
    const engine = engineRef.current;
    if (!engine) return;
    setDownloading(true);
    setExportError(false);
    try {
      downloadBlob(await engine.exportPng(), screenshotFileName(draft.page.url, draft.createdAt));
    } catch (error) {
      console.error('[qatch] PNG export failed', error);
      setExportError(true);
    } finally {
      setDownloading(false);
    }
  }

  async function discard() {
    if (!window.confirm('Discard this capture? It will be deleted from this device.')) return;
    setDiscarding(true);
    leavingOnPurpose.current = true; // already confirmed above; no second "Leave site?" prompt
    try {
      await deleteDraft(draft.id);
      await closeCurrentTab();
    } catch (error) {
      console.error('[qatch] failed to discard draft', error);
      leavingOnPurpose.current = false;
      setDiscarding(false);
    }
  }

  const pageName = draft.page.title || draft.page.url;

  return (
    <div className="editor">
      <EditorHeader
        kindLabel={MODE_LABELS[draft.mode]}
        saveStatus={combineSaveStatus(detailsSaver.status, annotationsSaver.status)}
        discarding={discarding}
        onDiscard={() => void discard()}
      />
      <div className="workspace">
        <main className="workspace__main">
          <AnnotationToolbar
            view={view}
            onViewChange={setView}
            tool={tool}
            onToolChange={setTool}
            color={color}
            onColorChange={setColor}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onUndo={undo}
            onRedo={redo}
            onDownload={() => void download()}
            downloading={downloading}
          />
          <div className="stage">
            {/* Page title/URL are untrusted page data: rendered only as text (React escapes them). */}
            <AnnotationCanvas
              imageUrl={imageUrl}
              label={`Screenshot of ${pageName}`}
              annotations={history.present}
              tool={tool}
              color={color}
              view={view}
              fitWidthOnly={draft.mode === 'full'}
              onChange={onAnnotationsChange}
              engineRef={engineRef}
            />
          </div>
          <p className="stage__note" role={exportError ? 'alert' : undefined}>
            {exportError
              ? "Couldn't export the PNG. Please try again."
              : 'Blurred areas are flattened into the uploaded image. The original pixels never leave your device.'}
          </p>
        </main>
        <ReportPanel draft={draft} details={details} onDetailsChange={updateDetails} />
      </div>
    </div>
  );
}
