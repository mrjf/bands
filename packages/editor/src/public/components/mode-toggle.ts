import { store } from "../store";

const MODES = ["declared", "effective", "unresolved", "raw"] as const;

class ModeToggle extends HTMLElement {
  private unsub?: () => void;

  connectedCallback() {
    this.unsub = store.subscribe((_, key) => {
      if (key === "viewMode") this.render();
    });
    this.render();
  }

  disconnectedCallback() {
    this.unsub?.();
  }

  private render() {
    const current = store.get().viewMode;
    this.innerHTML = `
      <div class="mode-toggle">
        ${MODES.map((mode) => `
          <button data-mode="${mode}" data-active="${mode === current}">${mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
        `).join("")}
      </div>
    `;

    this.querySelectorAll<HTMLElement>("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        store.set("viewMode", btn.dataset.mode as typeof current);
      });
    });
  }
}

customElements.define("mode-toggle", ModeToggle);
