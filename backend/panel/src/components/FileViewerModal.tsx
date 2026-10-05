import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, Download, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { getBlobErrorMessage } from '../utils/finance';
import { useModalBehaviour } from '../hooks/useModalBehaviour';

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // API path relative to the client base URL, e.g. /admin/deposits/3/receipt
  url: string | null;
  title: string;
  subtitle?: string;
  downloadName?: string;
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
};

const toolButtonClass =
  'p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition';

// Secure viewer for receipts, payout proofs and KYC documents.
// Files are fetched as blobs with the bearer header (never linked by URL) and the object URL is revoked on close.
export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  isOpen,
  onClose,
  url,
  title,
  subtitle,
  downloadName = 'document',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useModalBehaviour({ isOpen: isOpen && !!url, onClose, panelRef });

  useEffect(() => {
    if (!isOpen || !url) return;

    let currentUrl: string | null = null;
    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    setBlobUrl(null);
    setContentType('');
    setZoom(1);
    setRotation(0);

    const fetchFile = async () => {
      try {
        const response = await apiClient.get(url, { responseType: 'blob' });
        if (isCancelled) return;

        const type = String(response.headers['content-type'] || '').split(';')[0].trim();
        setContentType(type);

        const blob = new Blob([response.data], { type });
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch (err) {
        if (isCancelled) return;
        setError(await getBlobErrorMessage(err, 'The file could not be loaded. Check your permissions and try again.'));
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchFile();

    return () => {
      isCancelled = true;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [isOpen, url]);

  if (!isOpen || !url) return null;

  const isPdf = contentType.includes('pdf');

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${downloadName.replace(/\s+/g, '_')}${EXTENSIONS[contentType] || ''}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6">
      <div onClick={onClose} className="fixed inset-0 bg-black/85 backdrop-blur-md" />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-4xl h-[calc(100vh-1.5rem)] sm:h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn focus:outline-none"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#000000]/80">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-lg border border-brand-500/20 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id={titleId} className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h3>
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isPdf && blobUrl && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className={toolButtonClass}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className={toolButtonClass}
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className={toolButtonClass}
                  aria-label="Rotate"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {blobUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close viewer"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 bg-slate-100 dark:bg-[#000000] p-4 flex items-center justify-center overflow-auto relative">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400" role="status">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500 dark:text-brand-400" />
              <p className="text-sm font-medium">Loading file...</p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex flex-col items-center gap-3 text-center max-w-md p-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!isLoading && !error && blobUrl && (
            <>
              {isPdf ? (
                <iframe
                  src={blobUrl}
                  className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800"
                  title={title}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center overflow-auto">
                  <img
                    src={blobUrl}
                    alt={title}
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease-out',
                      maxHeight: '100%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                    }}
                    className="rounded-lg shadow-xl border border-slate-200 dark:border-slate-800"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
