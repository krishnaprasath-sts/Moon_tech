"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getErrorMessage } from '@/lib/api';
import { Alert, Modal, secondaryButtonClass } from '@/components/ui/primitives';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PREVIEWABLE_TYPES = [...IMAGE_TYPES, 'application/pdf'];

interface ViewerState {
  title: string;
  loading: boolean;
  error: string;
  url: string;
  mimeType: string;
}

export interface FileViewer {
  /** Fetches the protected file and shows it in a modal. */
  open: (title: string, load: () => Promise<Blob>) => void;
  /** True while a file is being fetched. */
  busy: boolean;
  modal: React.ReactNode;
}

/**
 * Shows files that need the Authorization header: the blob is fetched with the
 * token and displayed through a temporary object URL that is revoked on close.
 */
export function useFileViewer(): FileViewer {
  const [state, setState] = useState<ViewerState | null>(null);
  const url = state?.url || '';

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const open = useCallback((title: string, load: () => Promise<Blob>) => {
    setState({ title, loading: true, error: '', url: '', mimeType: '' });
    load()
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setState((current) => {
          // Closed (or replaced) while loading: drop the result.
          if (!current || !current.loading || current.title !== title) {
            URL.revokeObjectURL(objectUrl);
            return current;
          }
          return { title, loading: false, error: '', url: objectUrl, mimeType: blob.type };
        });
      })
      .catch((err: unknown) => {
        setState((current) =>
          current && current.loading && current.title === title
            ? { title, loading: false, error: getErrorMessage(err, 'Unable to load the file.'), url: '', mimeType: '' }
            : current
        );
      });
  }, []);

  const close = useCallback(() => setState(null), []);

  const modal = state ? (
    <Modal title={state.title} onClose={close} width="max-w-2xl">
      {state.loading && <div className="h-64 rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />}
      {state.error && <Alert>{state.error}</Alert>}
      {state.url && (
        <div className="space-y-3">
          {IMAGE_TYPES.includes(state.mimeType) ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL of a protected file
            <img
              src={state.url}
              alt={state.title}
              className="max-h-[65vh] w-auto mx-auto rounded-xl border border-zinc-200 dark:border-white/10"
            />
          ) : state.mimeType === 'application/pdf' ? (
            <iframe
              src={state.url}
              title={state.title}
              className="w-full h-[65vh] rounded-xl border border-zinc-200 dark:border-white/10 bg-white"
            />
          ) : (
            <Alert tone="info">This file type cannot be previewed here. Download it to view it.</Alert>
          )}
          <div className="flex justify-end">
            {PREVIEWABLE_TYPES.includes(state.mimeType) ? (
              <a href={state.url} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in new tab</span>
              </a>
            ) : (
              // Unknown types are only ever downloaded, never rendered in this origin.
              <a href={state.url} download="document" className={secondaryButtonClass}>
                <span>Download file</span>
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  ) : null;

  return { open, busy: Boolean(state?.loading), modal };
}
