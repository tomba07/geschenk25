export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void {
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
  confirm(title, message, onConfirm, onCancel);
}
