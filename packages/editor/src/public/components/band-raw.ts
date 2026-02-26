import { store } from "../store";
import { exportBandMd, parseBandMd } from "@bands/format";

class BandRaw extends HTMLElement {
  private unsub?: () => void;
  private ignoreNextUpdate = false;

  connectedCallback() {
    this.unsub = store.subscribe((_, key) => {
      if (key === "bands" && !this.ignoreNextUpdate) {
        this.updateContent();
      }
      this.ignoreNextUpdate = false;
    });
    this.render();
  }

  disconnectedCallback() {
    this.unsub?.();
  }

  private render() {
    this.innerHTML = `
      <div class="raw-editor">
        <div class="raw-highlight" id="raw-highlight"></div>
        <textarea class="raw-textarea" id="raw-textarea" spellcheck="false"></textarea>
      </div>
    `;
    const textarea = this.querySelector("#raw-textarea") as HTMLTextAreaElement;
    const highlight = this.querySelector("#raw-highlight") as HTMLDivElement;

    // Sync scroll between textarea and highlight overlay
    textarea.addEventListener("scroll", () => {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    });

    // Update highlighting and store on every input (reactive)
    textarea.addEventListener("input", () => {
      this.highlightYaml(textarea.value, highlight);

      // Parse and update store immediately (even with errors, use what we can parse)
      const result = parseBandMd(textarea.value);
      this.ignoreNextUpdate = true;
      store.updateCurrentBand(b => {
        // Clear existing fields and apply parsed document
        const keys = Object.keys(b) as (keyof typeof b)[];
        for (const key of keys) {
          if (key !== "body") delete b[key];
        }
        Object.assign(b, result.document);
      });
    });

    this.updateContent();
  }

  private updateContent() {
    const band = store.currentBand();
    const textarea = this.querySelector("#raw-textarea") as HTMLTextAreaElement;
    const highlight = this.querySelector("#raw-highlight") as HTMLDivElement;
    if (!textarea || !highlight || !band) return;
    const yaml = exportBandMd(band);
    textarea.value = yaml;
    this.highlightYaml(yaml, highlight);
  }

  private esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  private highlightYaml(text: string, el: HTMLDivElement) {
    const lines = text.split("\n");
    const highlighted = lines.map(line => {
      // Frontmatter delimiter
      if (line === "---") {
        return `<span class="hl-delimiter">${line}</span>`;
      }

      // Comment
      if (line.trim().startsWith("#")) {
        return `<span class="hl-comment">${this.esc(line)}</span>`;
      }

      // Key: value line
      const keyMatch = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(:)(.*)$/);
      if (keyMatch) {
        const [, indent, key, colon, rest] = keyMatch;
        return `${indent}<span class="hl-key">${key}</span><span class="hl-colon">${colon}</span>${this.highlightValue(rest)}`;
      }

      // List item
      const listMatch = line.match(/^(\s*)(- )(.*)$/);
      if (listMatch) {
        const [, indent, bullet, value] = listMatch;
        return `${indent}<span class="hl-bullet">${bullet}</span>${this.highlightValue(value)}`;
      }

      return this.esc(line);
    }).join("\n");

    el.innerHTML = highlighted + "\n";
  }

  private highlightValue(value: string): string {
    if (!value.trim()) return value;

    // Quoted string
    if (/^\s*".*"$/.test(value) || /^\s*'.*'$/.test(value)) {
      return `<span class="hl-string">${this.esc(value)}</span>`;
    }

    // URL
    if (/https?:\/\//.test(value)) {
      return `<span class="hl-url">${this.esc(value)}</span>`;
    }

    // Number
    if (/^\s*-?\d+\.?\d*$/.test(value.trim())) {
      return `<span class="hl-number">${this.esc(value)}</span>`;
    }

    // Boolean
    if (/^\s*(true|false)$/.test(value.trim())) {
      return `<span class="hl-boolean">${this.esc(value)}</span>`;
    }

    // Plain value (could be a string without quotes)
    return `<span class="hl-value">${this.esc(value)}</span>`;
  }
}

customElements.define("band-raw", BandRaw);
