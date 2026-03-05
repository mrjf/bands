import type { BandDocument } from "@bands/format";

export interface SkillEntry {
  name: string;
  description: string;
  skillSource: string;
  bandSource: string;
  band: BandDocument;
}

export interface AppState {
  bands: BandDocument[];
  skills: SkillEntry[];
  selectedIndex: number | null;
  selectedSkillIndex: number | null;
  searchQuery: string;
  dirty: boolean;
  loaded: boolean;
}

type Listener = (state: AppState, key: string) => void;

const initial: AppState = {
  bands: [],
  skills: [],
  selectedIndex: null,
  selectedSkillIndex: null,
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
    // Load bands and skills from server
    this.loadBands();
    this.loadSkills();
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

  private async loadSkills() {
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      if (Array.isArray(data.skills)) {
        this.state.skills = data.skills;
        this.notify("skills");
      }
    } catch (e) {
      console.error("Failed to load skills:", e);
    }
  }

  get(): AppState {
    return this.state;
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]) {
    this.state[key] = value;
    // Selecting a band deselects any skill
    if (key === "selectedIndex" && value !== null && this.state.selectedSkillIndex !== null) {
      this.state.selectedSkillIndex = null;
      this.notify("selectedSkillIndex");
    }
    this.notify(key);
  }

  /** Select a skill (deselects any band) */
  selectSkill(index: number | null) {
    this.state.selectedSkillIndex = index;
    if (index !== null) {
      this.state.selectedIndex = null;
      this.notify("selectedIndex");
    }
    this.notify("selectedSkillIndex");
  }

  /** Get the currently selected skill, or null */
  currentSkill(): SkillEntry | null {
    const { skills, selectedSkillIndex } = this.state;
    if (selectedSkillIndex === null || selectedSkillIndex < 0 || selectedSkillIndex >= skills.length) return null;
    return skills[selectedSkillIndex];
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
