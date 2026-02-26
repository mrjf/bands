import { store } from "../store";

class BandEditor extends HTMLElement {
  private unsub?: () => void;
  private lastSelectedIndex: number | null = null;

  connectedCallback() {
    this.unsub = store.subscribe((_, key) => {
      // Only re-render when selection changes, NOT when band content changes
      if (key === "selectedIndex") {
        const newIndex = store.get().selectedIndex;
        if (newIndex !== this.lastSelectedIndex) {
          this.lastSelectedIndex = newIndex;
          this.render();
        }
      }
    });
    this.lastSelectedIndex = store.get().selectedIndex;
    this.render();
  }

  disconnectedCallback() {
    this.unsub?.();
  }

  private render() {
    const band = store.currentBand();

    if (!band) {
      this.innerHTML = `
        <div class="editor-main">
          <div class="empty-state">
            <span class="icon">🎸</span>
            <p>Select a band or create a new one</p>
          </div>
        </div>
      `;
      return;
    }

    this.innerHTML = `
      <div class="editor-main">
        <band-toolbar></band-toolbar>
        <band-compact></band-compact>
        <band-raw></band-raw>
      </div>
    `;
  }
}

customElements.define("band-editor", BandEditor);
