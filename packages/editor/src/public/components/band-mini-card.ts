import type { BandDocument, PermissionCategories } from "@bands/format";

class BandMiniCard extends HTMLElement {
  static get observedAttributes() { return ["data-index"]; }

  attributeChangedCallback() { this.render(); }
  connectedCallback() { this.render(); }

  set band(b: BandDocument) {
    this._band = b;
    this.render();
  }

  private _band: BandDocument | null = null;

  private render() {
    const b = this._band;
    if (!b) return;

    const capCount = this.countCapabilities(b);
    const target = b.execution?.target;
    const targetLabel = target === "cloudflare" ? "CF" : target === "local-lima" ? "🖥️" : "";

    this.innerHTML = `
      <div class="mini-card">
        <span class="mini-card-icon">${b.icon || "🎵"}</span>
        <div class="mini-card-info">
          <span class="mini-card-name">${esc(b.band || "Untitled")}</span>
          <span class="mini-card-meta">${capCount > 0 ? `${capCount} caps` : ""}${targetLabel ? ` · ${targetLabel}` : ""}</span>
        </div>
      </div>
    `;
  }

  private countCapabilities(b: BandDocument): number {
    let count = 0;
    const categories = ["read", "write", "cli", "net"] as const;

    for (const col of ["allow", "deny", "insist"] as const) {
      const permCol = b[col] as PermissionCategories | undefined;
      if (!permCol) continue;
      for (const cat of categories) {
        const arr = permCol[cat];
        if (arr) count += arr.length;
      }
    }

    return count;
  }
}

function esc(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

customElements.define("band-mini-card", BandMiniCard);
