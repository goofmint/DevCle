/**
 * Generic Dialog Component
 *
 * Reusable modal dialog component with the following features:
 * - Display modal dialog with title, content, and actions
 * - Close on overlay click or ESC key
 * - React Portal for rendering outside parent DOM hierarchy
 * - Accessibility support (role, aria-* attributes)
 * - Dark mode support
 * - Responsive design
 *
 * Usage:
 * ```tsx
 * <Dialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Dialog Title"
 *   actions={<>
 *     <button onClick={handleCancel}>Cancel</button>
 *     <button onClick={handleConfirm}>Confirm</button>
 *   </>}
 * >
 *   <p>Dialog content goes here</p>
 * </Dialog>
 * ```
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

/**
 * Dialog component props
 */
export interface DialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
  /**
   * Callback fired when the dialog should be closed
   */
  onClose: () => void;
  /**
   * Dialog title
   */
  title: string;
  /**
   * Dialog content
   */
  children: React.ReactNode;
  /**
   * Optional action buttons (e.g., Cancel/Confirm)
   */
  actions?: React.ReactNode;
}

/**
 * Dialog component
 *
 * Renders a modal dialog using React Portal to ensure it appears above all other content.
 * Supports keyboard navigation (ESC to close) and overlay click to close.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  actions,
}: DialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  /**
   * Handle ESC key press to close dialog
   */
  useEffect(() => {
    if (!isOpen) return;

    // Store currently focused element to restore focus when dialog closes
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus the dialog when it opens
    if (dialogRef.current) {
      dialogRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previously focused element when dialog closes
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  /**
   * Handle overlay click to close dialog
   *
   * Only closes if the click target is the overlay itself,
   * not when clicking on the dialog content.
   */
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // Don't render anything if dialog is not open
  if (!isOpen) return null;

  // Render dialog using React Portal (directly under document.body)
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 transition-opacity"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
      >
        {/* Dialog Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="dialog-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close dialog"
          >
            <Icon icon="mdi:close" width={24} height={24} />
          </button>
        </div>

        {/* Dialog Content */}
        <div className="px-6 py-4 text-gray-700 dark:text-gray-300">
          {children}
        </div>

        {/* Dialog Actions */}
        {actions && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
