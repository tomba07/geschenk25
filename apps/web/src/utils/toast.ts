export type ToastTone = 'success' | 'error' | 'info';

export interface ToastRequest {
  message: string;
  tone: ToastTone;
}

const TOAST_EVENT = 'geschenk:toast';

export function showToast(message: string, tone: ToastTone = 'info'): void {
  window.dispatchEvent(new CustomEvent<ToastRequest>(TOAST_EVENT, {
    detail: {
      message,
      tone,
    },
  }));
}

export function showSuccessToast(message: string): void {
  showToast(message, 'success');
}

export function showErrorToast(message: string): void {
  showToast(message, 'error');
}

export function showInfoToast(message: string): void {
  showToast(message, 'info');
}

export { TOAST_EVENT };
