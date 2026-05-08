export interface ConfirmDialogRequest {
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

const CONFIRM_EVENT = 'geschenk:confirm-dialog';

export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void {
  const handled = window.dispatchEvent(new CustomEvent<ConfirmDialogRequest>(CONFIRM_EVENT, {
    cancelable: true,
    detail: {
      title,
      message,
      confirmText: 'Confirm',
      onConfirm,
      onCancel,
    },
  }));

  if (!handled) return;

  if (window.confirm(`${title}\n\n${message}`)) {
    onConfirm();
  } else {
    onCancel?.();
  }
}

export function confirmDestructive(
  title: string,
  message: string,
  _confirmText = 'Delete',
  onConfirm: () => void,
  onCancel?: () => void
): void {
  const handled = window.dispatchEvent(new CustomEvent<ConfirmDialogRequest>(CONFIRM_EVENT, {
    cancelable: true,
    detail: {
      title,
      message,
      confirmText: _confirmText,
      onConfirm,
      onCancel,
    },
  }));

  if (!handled) return;

  confirm(title, message, onConfirm, onCancel);
}

export { CONFIRM_EVENT };
