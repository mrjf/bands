// Leaf components
import "./components/band-mini-card";
import "./components/band-search";
import "./components/emoji-picker";
import "./components/band-raw";
import "./components/toast-notification";

// Editor components
import "./components/band-compact";
import "./components/band-toolbar";

// Containers
import "./components/band-sidebar";
import "./components/band-editor";
import "./components/band-app";

// Handle ?reset=1 query param
const params = new URLSearchParams(location.search);
if (params.get("reset") === "1") {
  localStorage.removeItem("bands-state");
  location.href = location.pathname;
}
