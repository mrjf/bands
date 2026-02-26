import { store } from "../store";

class BandApp extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="app-shell">
        <band-sidebar></band-sidebar>
        <band-editor></band-editor>
      </div>
      <toast-notification></toast-notification>
    `;
  }
}

customElements.define("band-app", BandApp);
