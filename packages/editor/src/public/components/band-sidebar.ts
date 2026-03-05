import { store } from "../store";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

class BandSidebar extends HTMLElement {
  private unsub?: () => void;

  connectedCallback() {
    this.innerHTML = `
      <div class="sidebar">
        <div class="sidebar-header">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <h2>Bands</h2>
            <button id="new-band-btn" title="New Band" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--color-accent);line-height:1;padding:0">+</button>
          </div>
          <band-search></band-search>
        </div>
        <div class="band-list" id="band-list"></div>
        <div class="sidebar-header sidebar-header--skills">
          <h2>Skills</h2>
        </div>
        <div class="skill-list" id="skill-list"></div>
      </div>
    `;

    this.querySelector("#new-band-btn")!.addEventListener("click", () => {
      store.addBand({ band: "", icon: "🎵", description: "" });
    });

    this.unsub = store.subscribe((_, key) => {
      if (key === "bands" || key === "searchQuery" || key === "selectedIndex" || key === "selectedSkillIndex") this.updateList();
      if (key === "skills" || key === "selectedSkillIndex") this.updateSkillList();
    });
    this.updateList();
    this.updateSkillList();
  }

  disconnectedCallback() {
    this.unsub?.();
  }

  private updateList() {
    const state = store.get();
    const query = state.searchQuery.toLowerCase();
    const filtered = state.bands
      .map((b, i) => ({ band: b, index: i }))
      .filter(({ band }) => band.band.toLowerCase().includes(query));

    const listEl = this.querySelector("#band-list")!;
    listEl.innerHTML = filtered.map(({ band, index }) => `
      <div class="band-item${index === state.selectedIndex ? " band-item--selected" : ""}" data-index="${index}">
        <band-mini-card data-index="${index}"></band-mini-card>
      </div>
    `).join("");

    // Set band data on mini-cards
    listEl.querySelectorAll<any>("band-mini-card").forEach((card) => {
      const idx = Number(card.dataset.index);
      card.band = state.bands[idx];
    });

    listEl.querySelectorAll(".band-item").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number((el as HTMLElement).dataset.index);
        store.set("selectedIndex", idx);
      });
    });
  }

  private updateSkillList() {
    const state = store.get();
    const listEl = this.querySelector("#skill-list")!;

    listEl.innerHTML = state.skills.map((skill, index) => `
      <div class="band-item skill-item${index === state.selectedSkillIndex ? " band-item--selected" : ""}" data-skill-index="${index}">
        <div class="mini-card">
          <span class="mini-card-icon">${skill.band?.icon || "📦"}</span>
          <div class="mini-card-info">
            <span class="mini-card-name">${esc(skill.name)}</span>
            <span class="mini-card-meta">${esc(skill.description).slice(0, 60)}${skill.description.length > 60 ? "..." : ""}</span>
          </div>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".skill-item").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number((el as HTMLElement).dataset.skillIndex);
        store.selectSkill(idx);
      });
    });
  }
}

customElements.define("band-sidebar", BandSidebar);
