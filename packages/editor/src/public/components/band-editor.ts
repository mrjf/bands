import { store } from "../store";

class BandEditor extends HTMLElement {
  private unsub?: () => void;
  private lastSelectedIndex: number | null = null;
  private lastSelectedSkillIndex: number | null = null;

  connectedCallback() {
    this.unsub = store.subscribe((_, key) => {
      if (key === "selectedIndex") {
        const newIndex = store.get().selectedIndex;
        if (newIndex !== this.lastSelectedIndex) {
          this.lastSelectedIndex = newIndex;
          this.lastSelectedSkillIndex = null;
          this.render();
        }
      }
      if (key === "selectedSkillIndex") {
        const newIndex = store.get().selectedSkillIndex;
        if (newIndex !== this.lastSelectedSkillIndex) {
          this.lastSelectedSkillIndex = newIndex;
          this.lastSelectedIndex = store.get().selectedIndex;
          this.render();
        }
      }
    });
    this.lastSelectedIndex = store.get().selectedIndex;
    this.lastSelectedSkillIndex = store.get().selectedSkillIndex;
    this.render();
  }

  disconnectedCallback() {
    this.unsub?.();
  }

  private render() {
    const skill = store.currentSkill();

    if (skill) {
      this.innerHTML = `
        <div class="editor-main">
          <div class="skill-detail">
            <div class="skill-detail-header">
              <span class="skill-detail-icon">${skill.band?.icon || "📦"}</span>
              <h2 class="skill-detail-name">${skill.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</h2>
            </div>
            <div class="skill-editors">
              <div class="skill-editor-section">
                <div class="skill-editor-label">SKILL.md</div>
                <code-viewer data-lang="markdown" id="cv-skill"></code-viewer>
              </div>
              <div class="skill-editor-section">
                <div class="skill-editor-label">BAND.md</div>
                <code-viewer data-lang="yaml" id="cv-band"></code-viewer>
              </div>
            </div>
          </div>
        </div>
      `;
      // Set content via property after DOM is created
      const cvSkill = this.querySelector("#cv-skill") as any;
      const cvBand = this.querySelector("#cv-band") as any;
      if (cvSkill) cvSkill.value = skill.skillSource;
      if (cvBand) cvBand.value = skill.bandSource;
      return;
    }

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
