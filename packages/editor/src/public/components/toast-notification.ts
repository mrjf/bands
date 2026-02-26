import { listen, EVT } from "../events";

class ToastNotification extends HTMLElement {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cleanup?: () => void;

  connectedCallback() {
    this.innerHTML = `<div class="toast" id="toast"></div>`;
    this.cleanup = listen<string>(EVT.TOAST, (msg) => this.show(msg));
  }

  disconnectedCallback() {
    this.cleanup?.();
  }

  private show(message: string) {
    const el = this.querySelector("#toast") as HTMLElement;
    el.textContent = message;
    el.classList.add("visible");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      el.classList.remove("visible");
    }, 2500);
  }
}

customElements.define("toast-notification", ToastNotification);
