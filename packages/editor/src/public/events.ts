export const EVT = {
  BAND_SELECTED: "band:selected",
  BAND_UPDATED: "band:updated",
  BAND_IMPORTED: "band:imported",
  CAPABILITY_MOVED: "cap:moved",
  VIEW_MODE_CHANGED: "viewmode:changed",
  TOAST: "toast:show",
} as const;

export function dispatch<T>(event: string, detail?: T) {
  document.dispatchEvent(new CustomEvent(event, { detail, bubbles: true }));
}

export function listen<T>(event: string, handler: (detail: T) => void): () => void {
  const fn = (e: Event) => handler((e as CustomEvent<T>).detail);
  document.addEventListener(event, fn);
  return () => document.removeEventListener(event, fn);
}
