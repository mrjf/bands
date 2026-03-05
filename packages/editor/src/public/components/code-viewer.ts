/**
 * Read-only code viewer with YAML/Markdown syntax highlighting.
 * Reuses the same raw-editor styling and highlight logic as band-raw.
 *
 * Usage: <code-viewer data-lang="yaml"></code-viewer>
 * Set .value property to update content.
 */
class CodeViewer extends HTMLElement {
  private _value = "";

  set value(v: string) {
    this._value = v;
    this.updateContent();
  }

  get value(): string {
    return this._value;
  }

  connectedCallback() {
    this.innerHTML = `
      <div class="raw-editor code-viewer-editor">
        <div class="raw-highlight" id="cv-highlight"></div>
        <div class="raw-textarea code-viewer-text" id="cv-text"></div>
      </div>
    `;
    this.updateContent();
  }

  private updateContent() {
    const highlight = this.querySelector("#cv-highlight") as HTMLDivElement;
    const text = this.querySelector("#cv-text") as HTMLDivElement;
    if (!highlight || !text) return;

    const lang = this.dataset.lang || "yaml";
    text.textContent = this._value;

    if (lang === "yaml") {
      this.highlightYaml(this._value, highlight);
    } else {
      this.highlightMarkdown(this._value, highlight);
    }

    // Sync scroll
    text.onscroll = () => {
      highlight.scrollTop = text.scrollTop;
      highlight.scrollLeft = text.scrollLeft;
    };
  }

  private esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  private highlightYaml(text: string, el: HTMLDivElement) {
    const lines = text.split("\n");
    const highlighted = lines.map(line => {
      if (line === "---") {
        return `<span class="hl-delimiter">${line}</span>`;
      }
      if (line.trim().startsWith("#")) {
        return `<span class="hl-comment">${this.esc(line)}</span>`;
      }
      const keyMatch = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(:)(.*)$/);
      if (keyMatch) {
        const [, indent, key, colon, rest] = keyMatch;
        return `${indent}<span class="hl-key">${key}</span><span class="hl-colon">${colon}</span>${this.highlightValue(rest)}`;
      }
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
    if (/^\s*".*"$/.test(value) || /^\s*'.*'$/.test(value)) {
      return `<span class="hl-string">${this.esc(value)}</span>`;
    }
    if (/https?:\/\//.test(value)) {
      return `<span class="hl-url">${this.esc(value)}</span>`;
    }
    if (/^\s*-?\d+\.?\d*$/.test(value.trim())) {
      return `<span class="hl-number">${this.esc(value)}</span>`;
    }
    if (/^\s*(true|false)$/.test(value.trim())) {
      return `<span class="hl-boolean">${this.esc(value)}</span>`;
    }
    return `<span class="hl-value">${this.esc(value)}</span>`;
  }

  private highlightMarkdown(text: string, el: HTMLDivElement) {
    const lines = text.split("\n");
    let inCodeBlock = false;
    const highlighted = lines.map(line => {
      // Frontmatter delimiters
      if (line === "---") {
        return `<span class="hl-delimiter">${line}</span>`;
      }
      // Code fence
      if (line.trimStart().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        return `<span class="hl-delimiter">${this.esc(line)}</span>`;
      }
      if (inCodeBlock) {
        return `<span class="hl-string">${this.esc(line)}</span>`;
      }
      // Headings
      const headingMatch = line.match(/^(#{1,6}\s)(.*)/);
      if (headingMatch) {
        return `<span class="hl-key">${this.esc(headingMatch[1])}</span><span class="hl-key">${this.esc(headingMatch[2])}</span>`;
      }
      // List items
      const listMatch = line.match(/^(\s*)([-*]\s)(.*)/);
      if (listMatch) {
        return `${listMatch[1]}<span class="hl-bullet">${this.esc(listMatch[2])}</span>${this.esc(listMatch[3])}`;
      }
      // Numbered list
      const numMatch = line.match(/^(\s*)(\d+\.\s)(.*)/);
      if (numMatch) {
        return `${numMatch[1]}<span class="hl-number">${this.esc(numMatch[2])}</span>${this.esc(numMatch[3])}`;
      }
      // Bold/italic markers
      return this.esc(line);
    }).join("\n");
    el.innerHTML = highlighted + "\n";
  }
}

customElements.define("code-viewer", CodeViewer);
