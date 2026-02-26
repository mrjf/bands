// Searchable emoji picker with categories

interface EmojiEntry {
  e: string;    // emoji
  n: string;    // name (lowercase, for search)
}

const CATEGORIES: { label: string; icon: string; emojis: EmojiEntry[] }[] = [
  {
    label: "Frequent", icon: "🕐", emojis: [
      { e: "🎵", n: "music note" }, { e: "🚀", n: "rocket" }, { e: "🤖", n: "robot" }, { e: "🧠", n: "brain" },
      { e: "💡", n: "light bulb idea" }, { e: "🔧", n: "wrench tool" }, { e: "⚡", n: "lightning bolt zap" },
      { e: "🔥", n: "fire hot" }, { e: "💎", n: "gem diamond" }, { e: "🎯", n: "target dart bullseye" },
      { e: "🛡️", n: "shield security" }, { e: "📦", n: "package box" }, { e: "🌐", n: "globe web" },
      { e: "💻", n: "laptop computer" }, { e: "📊", n: "chart graph" }, { e: "🔍", n: "search magnify" },
    ]
  },
  {
    label: "Smileys", icon: "😀", emojis: [
      { e: "😀", n: "grinning face happy" }, { e: "😃", n: "smiley face" }, { e: "😄", n: "smile" },
      { e: "😁", n: "beaming grin" }, { e: "😆", n: "laughing" }, { e: "😅", n: "sweat smile" },
      { e: "🤣", n: "rofl rolling floor laughing" }, { e: "😂", n: "joy tears" }, { e: "🙂", n: "slight smile" },
      { e: "😉", n: "wink" }, { e: "😊", n: "blush happy" }, { e: "😇", n: "angel halo" },
      { e: "🥰", n: "love hearts face" }, { e: "😍", n: "heart eyes love" }, { e: "🤩", n: "star struck" },
      { e: "😎", n: "cool sunglasses" }, { e: "🤓", n: "nerd glasses" }, { e: "🧐", n: "monocle" },
      { e: "🤔", n: "thinking hmm" }, { e: "🤗", n: "hugging hug" }, { e: "🤫", n: "shush quiet" },
      { e: "😶", n: "mute silent" }, { e: "😏", n: "smirk" }, { e: "🫡", n: "salute" },
      { e: "🤠", n: "cowboy hat" }, { e: "😈", n: "devil imp" }, { e: "👻", n: "ghost" },
      { e: "💀", n: "skull dead" }, { e: "👽", n: "alien" }, { e: "🤖", n: "robot" },
      { e: "💩", n: "poop" }, { e: "🫠", n: "melting" },
    ]
  },
  {
    label: "People", icon: "👋", emojis: [
      { e: "👋", n: "wave hello" }, { e: "🤚", n: "raised hand" }, { e: "✋", n: "hand stop" },
      { e: "🖖", n: "vulcan spock" }, { e: "👌", n: "ok okay" }, { e: "🤌", n: "pinched fingers" },
      { e: "✌️", n: "peace victory" }, { e: "🤞", n: "crossed fingers luck" }, { e: "🫰", n: "hand heart" },
      { e: "🤟", n: "love you" }, { e: "🤘", n: "rock metal horns" }, { e: "👍", n: "thumbs up" },
      { e: "👎", n: "thumbs down" }, { e: "👊", n: "fist bump" }, { e: "✊", n: "raised fist" },
      { e: "🤝", n: "handshake deal" }, { e: "👏", n: "clap applause" }, { e: "🙌", n: "raise hands celebrate" },
      { e: "💪", n: "flexed bicep strong muscle" }, { e: "🦾", n: "mechanical arm prosthetic" },
      { e: "🧑‍💻", n: "technologist developer coder" }, { e: "🧑‍🔬", n: "scientist researcher" },
      { e: "🧑‍🎨", n: "artist designer" }, { e: "🧑‍🚀", n: "astronaut space" },
      { e: "🧑‍🏫", n: "teacher instructor" }, { e: "🧑‍⚕️", n: "health worker doctor" },
      { e: "🥷", n: "ninja stealth" }, { e: "🧙", n: "mage wizard magic" },
      { e: "🦸", n: "superhero" }, { e: "🧑‍🤝‍🧑", n: "people group team" },
    ]
  },
  {
    label: "Nature", icon: "🌿", emojis: [
      { e: "🐶", n: "dog puppy" }, { e: "🐱", n: "cat kitty" }, { e: "🐭", n: "mouse" },
      { e: "🦊", n: "fox" }, { e: "🐻", n: "bear" }, { e: "🐼", n: "panda" },
      { e: "🐨", n: "koala" }, { e: "🦁", n: "lion" }, { e: "🐸", n: "frog" },
      { e: "🐙", n: "octopus" }, { e: "🦋", n: "butterfly" }, { e: "🐝", n: "bee honeybee" },
      { e: "🐳", n: "whale" }, { e: "🦈", n: "shark" }, { e: "🦅", n: "eagle" },
      { e: "🦉", n: "owl" }, { e: "🐍", n: "snake" }, { e: "🦎", n: "lizard" },
      { e: "🐢", n: "turtle" }, { e: "🐉", n: "dragon" }, { e: "🦄", n: "unicorn" },
      { e: "🌲", n: "evergreen tree pine" }, { e: "🌳", n: "deciduous tree" }, { e: "🌴", n: "palm tree" },
      { e: "🍀", n: "four leaf clover luck" }, { e: "🌺", n: "hibiscus flower" }, { e: "🌸", n: "cherry blossom" },
      { e: "🌻", n: "sunflower" }, { e: "🍄", n: "mushroom" }, { e: "🌊", n: "wave ocean water" },
      { e: "🌍", n: "globe earth world" }, { e: "🌎", n: "globe americas" }, { e: "🌏", n: "globe asia" },
      { e: "⭐", n: "star" }, { e: "🌟", n: "glowing star sparkle" }, { e: "✨", n: "sparkles magic" },
      { e: "☀️", n: "sun" }, { e: "🌙", n: "moon crescent" }, { e: "🌈", n: "rainbow" },
      { e: "☁️", n: "cloud" }, { e: "⛈️", n: "storm thunder" }, { e: "❄️", n: "snowflake cold" },
    ]
  },
  {
    label: "Food", icon: "🍕", emojis: [
      { e: "🍎", n: "apple red" }, { e: "🍊", n: "orange tangerine" }, { e: "🍋", n: "lemon" },
      { e: "🍇", n: "grapes" }, { e: "🍉", n: "watermelon" }, { e: "🍓", n: "strawberry" },
      { e: "🫐", n: "blueberry" }, { e: "🍑", n: "peach" }, { e: "🥑", n: "avocado" },
      { e: "🌶️", n: "hot pepper chili" }, { e: "🍕", n: "pizza" }, { e: "🍔", n: "hamburger burger" },
      { e: "🌮", n: "taco" }, { e: "🍜", n: "ramen noodle soup" }, { e: "🍣", n: "sushi" },
      { e: "🧁", n: "cupcake" }, { e: "🍰", n: "cake shortcake" }, { e: "🍩", n: "donut doughnut" },
      { e: "🍪", n: "cookie" }, { e: "🍫", n: "chocolate" }, { e: "☕", n: "coffee hot beverage" },
      { e: "🍵", n: "tea" }, { e: "🧋", n: "boba bubble tea" }, { e: "🍺", n: "beer" },
    ]
  },
  {
    label: "Objects", icon: "💻", emojis: [
      { e: "💻", n: "laptop computer" }, { e: "🖥️", n: "desktop monitor" }, { e: "⌨️", n: "keyboard" },
      { e: "🖱️", n: "mouse computer" }, { e: "📱", n: "mobile phone smartphone" }, { e: "📡", n: "satellite antenna" },
      { e: "🔋", n: "battery" }, { e: "🔌", n: "plug electric" }, { e: "💾", n: "floppy disk save" },
      { e: "💿", n: "cd disc" }, { e: "📀", n: "dvd" }, { e: "🧮", n: "abacus calculator" },
      { e: "🔧", n: "wrench tool" }, { e: "🔩", n: "nut bolt" }, { e: "⚙️", n: "gear settings cog" },
      { e: "🛠️", n: "hammer wrench tools" }, { e: "⛏️", n: "pick axe mine" }, { e: "🗡️", n: "dagger knife" },
      { e: "🔑", n: "key" }, { e: "🗝️", n: "old key vintage" }, { e: "🔒", n: "lock locked" },
      { e: "🔓", n: "unlock unlocked" }, { e: "🔐", n: "lock key security" }, { e: "🛡️", n: "shield security protect" },
      { e: "📦", n: "package box" }, { e: "📮", n: "mailbox post" }, { e: "📨", n: "envelope email" },
      { e: "📋", n: "clipboard" }, { e: "📝", n: "memo note write" }, { e: "📁", n: "folder directory" },
      { e: "📂", n: "open folder" }, { e: "🗂️", n: "card index file" }, { e: "📄", n: "document page" },
      { e: "📊", n: "bar chart graph stats" }, { e: "📈", n: "chart trending up growth" }, { e: "📉", n: "chart trending down" },
      { e: "🧪", n: "test tube experiment" }, { e: "🔬", n: "microscope science" }, { e: "🔭", n: "telescope" },
      { e: "🧬", n: "dna genetics" }, { e: "🩺", n: "stethoscope health" }, { e: "💊", n: "pill medicine" },
      { e: "🧲", n: "magnet" }, { e: "🪝", n: "hook" }, { e: "🧰", n: "toolbox" },
      { e: "🏷️", n: "label tag" }, { e: "🔖", n: "bookmark" }, { e: "📌", n: "pin pushpin" },
      { e: "🔔", n: "bell notification" }, { e: "🔕", n: "muted bell silent" }, { e: "📢", n: "loudspeaker announce" },
      { e: "💬", n: "speech bubble chat message" }, { e: "💭", n: "thought bubble" }, { e: "🗯️", n: "anger bubble" },
    ]
  },
  {
    label: "Tech", icon: "⚡", emojis: [
      { e: "⚡", n: "lightning bolt zap electric" }, { e: "🔥", n: "fire hot flame" },
      { e: "💥", n: "boom explosion collision" }, { e: "🌀", n: "cyclone spin spiral" },
      { e: "🕸️", n: "web spider" }, { e: "🧩", n: "puzzle piece jigsaw" },
      { e: "🎛️", n: "control knobs dial" }, { e: "🎚️", n: "slider level" },
      { e: "📡", n: "satellite dish antenna signal" }, { e: "🏗️", n: "building construction crane" },
      { e: "🏭", n: "factory industry" }, { e: "⛓️", n: "chain link" },
      { e: "🔗", n: "link chain url" }, { e: "🧿", n: "nazar amulet eye" },
      { e: "🔮", n: "crystal ball predict magic" }, { e: "🪄", n: "magic wand" },
      { e: "🌐", n: "globe web internet" }, { e: "🛸", n: "ufo flying saucer" },
      { e: "🚀", n: "rocket launch ship space" }, { e: "🛰️", n: "satellite orbit" },
      { e: "🤖", n: "robot bot ai" }, { e: "🧠", n: "brain think smart intelligence" },
      { e: "👁️", n: "eye vision watch" }, { e: "🫀", n: "anatomical heart" },
      { e: "💡", n: "light bulb idea" }, { e: "🔋", n: "battery power energy" },
      { e: "⏱️", n: "stopwatch timer" }, { e: "⏰", n: "alarm clock time" },
      { e: "🏴‍☠️", n: "pirate flag jolly roger" }, { e: "🚩", n: "flag red alert" },
      { e: "🏁", n: "checkered flag finish race" }, { e: "🎌", n: "crossed flags" },
    ]
  },
  {
    label: "Symbols", icon: "💠", emojis: [
      { e: "❤️", n: "red heart love" }, { e: "🧡", n: "orange heart" }, { e: "💛", n: "yellow heart" },
      { e: "💚", n: "green heart" }, { e: "💙", n: "blue heart" }, { e: "💜", n: "purple heart" },
      { e: "🖤", n: "black heart" }, { e: "🤍", n: "white heart" }, { e: "💔", n: "broken heart" },
      { e: "💯", n: "hundred percent perfect score" }, { e: "💢", n: "anger" },
      { e: "💠", n: "diamond dot cute" }, { e: "💎", n: "gem diamond jewel" },
      { e: "🔴", n: "red circle" }, { e: "🟠", n: "orange circle" }, { e: "🟡", n: "yellow circle" },
      { e: "🟢", n: "green circle" }, { e: "🔵", n: "blue circle" }, { e: "🟣", n: "purple circle" },
      { e: "⚪", n: "white circle" }, { e: "⚫", n: "black circle" },
      { e: "🟥", n: "red square" }, { e: "🟧", n: "orange square" }, { e: "🟨", n: "yellow square" },
      { e: "🟩", n: "green square" }, { e: "🟦", n: "blue square" }, { e: "🟪", n: "purple square" },
      { e: "⬛", n: "black square" }, { e: "⬜", n: "white square" },
      { e: "▶️", n: "play" }, { e: "⏸️", n: "pause" }, { e: "⏹️", n: "stop" },
      { e: "♻️", n: "recycle" }, { e: "✅", n: "check mark done" }, { e: "❌", n: "cross mark x no" },
      { e: "❓", n: "question mark" }, { e: "❗", n: "exclamation mark" }, { e: "‼️", n: "double exclamation" },
      { e: "⚠️", n: "warning caution" }, { e: "🚫", n: "prohibited no ban" }, { e: "♾️", n: "infinity" },
    ]
  },
  {
    label: "Activities", icon: "🎮", emojis: [
      { e: "🎮", n: "video game controller" }, { e: "🕹️", n: "joystick arcade" },
      { e: "🎲", n: "dice game" }, { e: "🧩", n: "puzzle piece" }, { e: "♟️", n: "chess pawn" },
      { e: "🎯", n: "direct hit target bullseye" }, { e: "🎳", n: "bowling" },
      { e: "🎸", n: "guitar" }, { e: "🎹", n: "piano keyboard music" }, { e: "🥁", n: "drum" },
      { e: "🎺", n: "trumpet horn" }, { e: "🎻", n: "violin" }, { e: "🎤", n: "microphone sing karaoke" },
      { e: "🎧", n: "headphones music" }, { e: "🎵", n: "musical note" }, { e: "🎶", n: "musical notes" },
      { e: "🎨", n: "palette art paint" }, { e: "🖌️", n: "paintbrush" }, { e: "🖍️", n: "crayon" },
      { e: "📸", n: "camera photo" }, { e: "🎬", n: "clapper movie film" }, { e: "🎭", n: "theater masks drama" },
      { e: "🎪", n: "circus tent" }, { e: "🎟️", n: "ticket admission" },
      { e: "🏆", n: "trophy winner champion" }, { e: "🥇", n: "gold medal first" },
      { e: "🥈", n: "silver medal second" }, { e: "🥉", n: "bronze medal third" },
      { e: "📚", n: "books library read" }, { e: "🎓", n: "graduation cap education" },
      { e: "🏫", n: "school" }, { e: "🏛️", n: "classical building museum" },
    ]
  },
  {
    label: "Travel", icon: "🚀", emojis: [
      { e: "🚗", n: "car automobile" }, { e: "🚕", n: "taxi cab" }, { e: "🚌", n: "bus" },
      { e: "🚀", n: "rocket launch space" }, { e: "✈️", n: "airplane plane flight" },
      { e: "🛸", n: "flying saucer ufo" }, { e: "🚁", n: "helicopter" }, { e: "⛵", n: "sailboat" },
      { e: "🚢", n: "ship cruise" }, { e: "🏠", n: "house home" }, { e: "🏢", n: "office building" },
      { e: "🏗️", n: "building construction" }, { e: "🏭", n: "factory" }, { e: "🏰", n: "castle" },
      { e: "⛺", n: "tent camping" }, { e: "🗼", n: "tower" }, { e: "🗽", n: "statue liberty" },
      { e: "🗻", n: "mountain fuji" }, { e: "🏔️", n: "snow capped mountain" }, { e: "🌋", n: "volcano" },
    ]
  },
  {
    label: "Flags", icon: "🏳️", emojis: [
      { e: "🏳️", n: "white flag" }, { e: "🏴", n: "black flag" }, { e: "🏁", n: "checkered flag race" },
      { e: "🚩", n: "triangular flag red" }, { e: "🏴‍☠️", n: "pirate flag" }, { e: "🎌", n: "crossed flags" },
      { e: "🏳️‍🌈", n: "rainbow flag pride" },
    ]
  },
];

// Build flat search index
const ALL_EMOJIS: EmojiEntry[] = [];
const seen = new Set<string>();
for (const cat of CATEGORIES) {
  for (const entry of cat.emojis) {
    if (!seen.has(entry.e)) {
      seen.add(entry.e);
      ALL_EMOJIS.push(entry);
    }
  }
}

class EmojiPickerInline extends HTMLElement {
  private activeCategory = 0;
  private searchQuery = "";

  connectedCallback() {
    this.render();
  }

  private render() {
    // Full render on first mount only — search input is stable
    if (!this.querySelector(".emoji-picker-container")) {
      this.innerHTML = `
        <div class="emoji-picker-container">
          <input class="emoji-search" type="text" placeholder="Search emoji...">
          <div class="emoji-tabs"></div>
          <div class="emoji-grid"></div>
          <div class="emoji-category-label"></div>
        </div>
      `;
      const input = this.querySelector<HTMLInputElement>(".emoji-search")!;
      input.addEventListener("input", () => {
        this.searchQuery = input.value;
        this.updateContent();
      });
      input.focus();
    }
    this.updateContent();
  }

  private updateContent() {
    const filtered = this.searchQuery
      ? ALL_EMOJIS.filter((e) => e.n.includes(this.searchQuery.toLowerCase()))
      : CATEGORIES[this.activeCategory].emojis;

    // Update tabs (hidden during search)
    const tabsEl = this.querySelector<HTMLElement>(".emoji-tabs")!;
    if (this.searchQuery) {
      tabsEl.style.display = "none";
    } else {
      tabsEl.style.display = "";
      tabsEl.innerHTML = CATEGORIES.map((cat, i) =>
        `<button class="emoji-tab ${i === this.activeCategory ? "active" : ""}" data-cat="${i}" title="${cat.label}">${cat.icon}</button>`
      ).join("");
      tabsEl.querySelectorAll<HTMLElement>(".emoji-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.activeCategory = Number(btn.dataset.cat);
          this.searchQuery = "";
          const input = this.querySelector<HTMLInputElement>(".emoji-search")!;
          input.value = "";
          this.updateContent();
        });
      });
    }

    // Update grid
    const gridEl = this.querySelector<HTMLElement>(".emoji-grid")!;
    gridEl.innerHTML = filtered.length === 0
      ? `<div class="emoji-empty">No emoji found</div>`
      : filtered.map((e) => `<button class="emoji-cell" data-emoji="${e.e}" title="${e.n}">${e.e}</button>`).join("");
    gridEl.querySelectorAll<HTMLElement>(".emoji-cell").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("emoji:selected", {
          detail: btn.dataset.emoji,
          bubbles: true,
        }));
      });
    });

    // Update category label
    const labelEl = this.querySelector<HTMLElement>(".emoji-category-label")!;
    if (this.searchQuery) {
      labelEl.style.display = "none";
    } else {
      labelEl.style.display = "";
      labelEl.textContent = CATEGORIES[this.activeCategory].label;
    }
  }
}

function esc(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

customElements.define("emoji-picker-inline", EmojiPickerInline);
