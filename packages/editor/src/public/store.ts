import type { BandDocument } from "@bands/format";

export interface AppState {
  bands: BandDocument[];
  selectedIndex: number | null;
  searchQuery: string;
  dirty: boolean;
  loaded: boolean;
}

type Listener = (state: AppState, key: string) => void;

const initial: AppState = {
  bands: [],
  selectedIndex: null,
  searchQuery: "",
  dirty: false,
  loaded: false,
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "untitled";
}

class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = { ...initial };
    // Load bands from server
    this.loadBands();
  }

  private async loadBands() {
    try {
      const res = await fetch("/api/bands");
      const data = await res.json();
      if (Array.isArray(data.bands) && data.bands.length > 0) {
        this.state.bands = data.bands;

        // Try to select band matching URL slug
        const path = location.pathname.replace(/^\//, "");
        if (path) {
          const idx = this.state.bands.findIndex((b) => slugify(b.band) === path);
          this.state.selectedIndex = idx !== -1 ? idx : 0;
        } else {
          this.state.selectedIndex = 0;
        }
      }
    } catch (e) {
      console.error("Failed to load bands:", e);
    }
    this.state.loaded = true;
    this.notify("bands");
    this.notify("selectedIndex");
  }

  get(): AppState {
    return this.state;
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]) {
    this.state[key] = value;
    this.notify(key);
  }

  /** Get the currently selected band, or null */
  currentBand(): BandDocument | null {
    const { bands, selectedIndex } = this.state;
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= bands.length) return null;
    return bands[selectedIndex];
  }

  /** Update the currently selected band in-place */
  updateCurrentBand(updater: (band: BandDocument) => void) {
    const band = this.currentBand();
    if (!band) return;
    updater(band);
    this.state.dirty = true;
    this.notify("bands");
  }

  /** Add a new band and select it */
  addBand(band: BandDocument) {
    this.state.bands.push(band);
    this.state.selectedIndex = this.state.bands.length - 1;
    this.state.dirty = false;
    this.notify("bands");
    this.notify("selectedIndex");
  }

  /** Remove band at index */
  removeBand(index: number) {
    this.state.bands.splice(index, 1);
    if (this.state.selectedIndex !== null) {
      if (this.state.selectedIndex >= this.state.bands.length) {
        this.state.selectedIndex = this.state.bands.length > 0 ? this.state.bands.length - 1 : null;
      }
    }
    this.notify("bands");
    this.notify("selectedIndex");
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(key: string) {
    for (const fn of this.listeners) fn(this.state, key);
  }
}

export const store = new Store();

// Sync URL when selectedIndex changes
store.subscribe((state, key) => {
  if (key === "selectedIndex" || key === "bands") {
    const band = store.currentBand();
    const slug = band ? slugify(band.band) : "";
    const target = slug ? `/${slug}` : "/";
    if (location.pathname !== target) {
      history.replaceState(null, "", target);
    }
  }
});
