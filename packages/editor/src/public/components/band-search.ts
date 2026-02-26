import { store } from "../store";

class BandSearch extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<input class="search-input" type="text" placeholder="Search bands..." value="${store.get().searchQuery}">`;
    this.querySelector("input")!.addEventListener("input", (e) => {
      store.set("searchQuery", (e.target as HTMLInputElement).value);
    });
  }
}

customElements.define("band-search", BandSearch);
