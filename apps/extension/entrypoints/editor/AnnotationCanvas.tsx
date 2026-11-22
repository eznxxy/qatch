import { type RefObject, useEffect, useRef, useState } from 'react';

import type { Annotation, AnnotationColor } from '@/lib/annotations';
import type { CanvasView } from '@/lib/canvas-fit';

import { AnnotationEngine } from './annotation-engine';
import type { Tool } from './tools';

interface AnnotationCanvasProps {
  imageUrl: string;
  /** Accessible name, e.g. "Screenshot of Checkout". */
  label: string;
  annotations: Annotation[];
  tool: Tool;
  color: AnnotationColor;
  /** Fit to the available width, or actual size (1:1; the stage scrolls). */
  view: CanvasView;
  /** In fit mode, fit the width only and let the page scroll (tall full-page captures). */
  fitWidthOnly: boolean;
  onChange: (next: Annotation[]) => void;
  /** Gives the parent the engine for export, delete and keyboard shortcuts. */
  engineRef: RefObject<AnnotationEngine | null>;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export function AnnotationCanvas({
  imageUrl,
  label,
  annotations,
  tool,
  color,
  view,
  fitWidthOnly,
  onChange,
  engineRef,
}: AnnotationCanvasProps) {
  // contain: fit inside the stage (no page scroll); width: fit the width, page scrolls; actual: 1:1.
  const contain = view === 'fit' && !fitWidthOnly;
  const layout = view === 'actual' ? 'actual' : contain ? 'contain' : 'width';
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [engine, setEngine] = useState<AnnotationEngine | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // One engine per image. Fabric takes over the <canvas> and wraps it, so each mount gets its own
  // container that is removed once Fabric has let go of it.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mount = document.createElement('div');
    mount.className = 'stage__mount';
    const element = document.createElement('canvas');
    mount.appendChild(element);
    host.appendChild(mount);

    let cancelled = false;
    let created: AnnotationEngine | undefined;
    loadImage(imageUrl)
      .then((image) => {
        if (cancelled) return;
        created = new AnnotationEngine(element, image, (next) => {
          onChangeRef.current(next);
        });
        engineRef.current = created;
        setEngine(created);
      })
      .catch((error: unknown) => {
        console.error('[qatch] failed to load the screenshot', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (engineRef.current === created) engineRef.current = null;
      setEngine(null);
      void (created?.dispose() ?? Promise.resolve(true)).finally(() => {
        mount.remove();
      });
    };
  }, [imageUrl, engineRef]);

  useEffect(() => {
    engine?.setAnnotations(annotations);
  }, [engine, annotations]);

  useEffect(() => {
    engine?.setTool(tool, color);
  }, [engine, tool, color]);

  useEffect(() => {
    const host = hostRef.current;
    if (!engine || !host) return;
    const fit = () => {
      // In contain mode the host's height comes from the layout (the canvas is taken out of flow).
      const height = contain ? host.clientHeight : Infinity;
      engine.fit({ width: host.clientWidth, height }, view);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(host);

    // Browser zoom or a move to another screen changes devicePixelRatio, and with it the backing store
    // size, even when the CSS width stays the same. The query matches only the current ratio, so re-arm it.
    let dprQuery: MediaQueryList | undefined;
    const onDprChange = () => {
      fit();
      watchDpr();
    };
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${String(window.devicePixelRatio)}dppx)`);
      dprQuery.addEventListener('change', onDprChange);
    };
    watchDpr();
    fit();
    return () => {
      observer.disconnect();
      dprQuery?.removeEventListener('change', onDprChange);
    };
  }, [engine, view, contain]);

  if (failed) {
    return (
      <p className="stage__error" role="alert">
        Couldn&apos;t display the screenshot. Reload the page to try again.
      </p>
    );
  }

  return (
    <div
      ref={hostRef}
      className={`stage__canvas stage__canvas--${layout}`}
      role="img"
      aria-label={`${label}, ${String(annotations.length)} annotation${annotations.length === 1 ? '' : 's'}`}
    />
  );
}
