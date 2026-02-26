class BandToolbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<div class="toolbar"></div>`;
  }
}

customElements.define("band-toolbar", BandToolbar);
