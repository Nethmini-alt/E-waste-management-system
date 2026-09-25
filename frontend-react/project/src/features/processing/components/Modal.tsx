import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Buttons row pinned under the scrolling body. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** While true (e.g. a request is in flight) Esc / backdrop / X will not close the dialog. */
  busy?: boolean;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

/**
 * Glass dialog. Rendered through a portal because the app shell animates its content with a
 * CSS transform, which would otherwise trap `position: fixed` inside the content column.
 */
export const Modal: React.FC<ModalProps> = ({ open, onClose, title, subtitle, children, footer, size = 'md', busy = false }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass relative flex max-h-[92vh] w-full ${SIZES[size]} flex-col rounded-3xl`}
        style={{ background: 'rgba(255,255,255,0.92)' }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-ink-600">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-full p-1.5 text-ink-600 transition hover:bg-mint-50 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-mint-100 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
