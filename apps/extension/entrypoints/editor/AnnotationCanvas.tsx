import { type RefObject, useEffect, useRef, useState } from 'react';

import type { Annotation, AnnotationColor } from '@/lib/annotations';

import { AnnotationEngine } from './annotation-engine';
import type { Tool } from './tools';

interface AnnotationCanvasProps {
  imageUrl: string;
  /** Accessible name, e.g. "Screenshot of Checkout". */
  label: string;
  annotations: Annotation[];
  tool: Tool;
  color: AnnotationColor;
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
  onChange,
  engineRef,
}: AnnotationCanvasProps) {
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
      engine.fit(host.clientWidth);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    fit();
    return () => {
      observer.disconnect();
    };
  }, [engine]);

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
      className="stage__canvas"
      role="img"
      aria-label={`${label}, ${String(annotations.length)} annotation${annotations.length === 1 ? '' : 's'}`}
    />
  );
}
