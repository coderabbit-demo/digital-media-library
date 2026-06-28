import { useEffect, useRef } from 'react';
import { PostUpdateForm, type ComposeInitial } from './PostUpdateForm';
import { Icon } from './Icon';

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  /** Optional pre-filled values (e.g., when composing from a Discover item). */
  initial?: ComposeInitial;
}

/**
 * Modal overlay for composing an activity update (MD3 dialog). Opened from the
 * home left column's "Post an update" action. Closes on a successful post, on
 * Escape, or on a scrim click.
 */
export function ComposeDialog({ open, onClose, initial }: ComposeDialogProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog (the title field) when it opens.
    document.getElementById('pf-title')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        // Close only when the scrim itself (not the surface) is clicked.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Share what you’re doing now"
        ref={surfaceRef}
      >
        <div className="modal__header">
          <h2 className="modal__title">Share what you’re doing now</h2>
          <button
            type="button"
            className="md3-icon-button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <Icon name="close" />
          </button>
        </div>
        <PostUpdateForm onPosted={onClose} initial={initial} />
      </div>
    </div>
  );
}
