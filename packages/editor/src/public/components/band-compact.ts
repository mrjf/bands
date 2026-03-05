import { store } from "../store";
import { EXECUTION_TARGETS, formatBytes, formatDuration, formatCost } from "@bands/format";
import type { ExecutionTarget, BandDocument, Limits, PermissionCategories, EnvConfig, Contract } from "@bands/format";

type PermCategory = keyof PermissionCategories;
type PermColumn = "allow" | "deny" | "insist";
type EnvField = keyof EnvConfig;

const PERM_CATEGORIES: { key: PermCategory; label: string; placeholder: string; tooltip: string }[] = [
  { key: "tools", label: "Tools", placeholder: "https://github.com/owner/repo/tree/main/tool", tooltip: "External tool definitions the band can invoke" },
  { key: "skills", label: "Skills", placeholder: "https://github.com/owner/repo or ./local/path", tooltip: "Reusable skill packages (GitHub URLs or local paths)" },
  { key: "mcps", label: "MCPs", placeholder: "https://github.com/owner/repo/tree/main/mcp", tooltip: "Model Context Protocol servers for external integrations" },
  { key: "apis", label: "APIs", placeholder: "https://github.com/owner/repo/tree/main/api", tooltip: "API definitions the band can call" },
  { key: "read", label: "Read", placeholder: "./data/**, ./config.json", tooltip: "File paths the band can read (glob patterns)" },
  { key: "write", label: "Write", placeholder: "./output/**, /tmp/**", tooltip: "File paths the band can write (glob patterns)" },
  { key: "cli", label: "CLI", placeholder: "python *, jq *, npm run *", tooltip: "Shell commands the band can execute (glob patterns)" },
  { key: "net", label: "Network", placeholder: "api.github.com, *.amazonaws.com", tooltip: "Network hosts the band can access (glob patterns)" },
];

type LimitType = "bytes" | "duration" | "cost";

interface LimitDef {
  key: keyof Limits;
  label: string;
  type: LimitType;
  placeholder: string;
  presets: string[];
  tooltip: string;
}

const LIMIT_DEFS: LimitDef[] = [
  { key: "maxInputBytes", label: "Input", type: "bytes", placeholder: "1m", presets: ["64k", "256k", "1m", "10m", "100m"], tooltip: "Maximum size of input data the band can receive" },
  { key: "maxOutputBytes", label: "Output", type: "bytes", placeholder: "10m", presets: ["256k", "1m", "10m", "100m", "1g"], tooltip: "Maximum size of output data the band can produce" },
  { key: "maxRuntimeMs", label: "Runtime", type: "duration", placeholder: "30s", presets: ["1s", "10s", "30s", "5m", "30m"], tooltip: "Maximum execution time before the band is terminated" },
  { key: "maxCostDollars", label: "Cost", type: "cost", placeholder: "$0.10", presets: ["$0.01", "$0.10", "$1", "$10", "$100"], tooltip: "Maximum dollar cost allowed for this band invocation" },
];

function formatLimitValue(val: number | string | undefined, type: LimitType): string {
  if (val === undefined) return "";
  if (typeof val === "string") return val;
  switch (type) {
    case "bytes": return formatBytes(val);
    case "duration": return formatDuration(val);
    case "cost": return formatCost(val);
  }
}

const ENV_DEFS: { key: EnvField; label: string; placeholder: string; tooltip: string }[] = [
  { key: "secrets", label: "Secrets", placeholder: "API_KEY or API_KEY=xxx or API_KEY<==OTHER_KEY", tooltip: "Sensitive values (masked in logs). Use VAR, VAR=value, or VAR<==OTHER" },
  { key: "variables", label: "Variables", placeholder: "NODE_ENV or NODE_ENV=production", tooltip: "Non-sensitive environment variables passed to the band" },
];

const OPTIONAL_FIELDS = ["execution", "extends", "includes"] as const;
type OptionalField = typeof OPTIONAL_FIELDS[number];

class BandCompact extends HTMLElement {
  private openColumn: "allow" | "deny" | "insist" | "limits" | "env" | "contract" | null = null;
  private contractModes: { input?: "ref" | "inline"; output?: "ref" | "inline" } = {};
  private unsub?: () => void;

  connectedCallback() {
    this.render();
    this.unsub = store.subscribe((_, key) => {
      if (key === "bands") {
        const focused = document.activeElement as HTMLInputElement | null;
        const isOurFocus = focused && this.contains(focused);

        if (!isOurFocus) {
          // Focus is outside (e.g., in YAML editor) - full re-render
          this.render();
        } else {
          // Focus is inside - save position, re-render, restore focus
          const focusData = this.saveFocusState(focused);
          this.render();
          this.restoreFocusState(focusData);
        }
      }
    });
  }

  private saveFocusState(el: HTMLInputElement | null): { selector: string; cursorPos: number } | null {
    if (!el) return null;

    // Build a selector based on data attributes
    let selector = "";
    if (el.id) {
      selector = `#${el.id}`;
    } else if (el.dataset.col && el.dataset.cat && el.dataset.idx) {
      selector = `.cap-input[data-col="${el.dataset.col}"][data-cat="${el.dataset.cat}"][data-idx="${el.dataset.idx}"]`;
    } else if (el.dataset.env && el.dataset.idx) {
      selector = `.cap-input[data-env="${el.dataset.env}"][data-idx="${el.dataset.idx}"]`;
    } else if (el.dataset.limit) {
      selector = `.cap-input[data-limit="${el.dataset.limit}"]`;
    } else if (el.dataset.contract) {
      selector = `.contract-schema[data-contract="${el.dataset.contract}"]`;
    } else if (el.dataset.contractRef) {
      selector = `.contract-ref[data-contract-ref="${el.dataset.contractRef}"]`;
    }

    return selector ? { selector, cursorPos: el.selectionStart ?? el.value.length } : null;
  }

  private restoreFocusState(state: { selector: string; cursorPos: number } | null) {
    if (!state) return;

    const el = this.querySelector<HTMLInputElement>(state.selector);
    if (el) {
      el.focus();
      el.setSelectionRange(state.cursorPos, state.cursorPos);
    }
  }

  disconnectedCallback() {
    this.unsub?.();
  }

  private hasField(band: BandDocument, field: OptionalField): boolean {
    switch (field) {
      case "execution": return !!band.execution?.target;
      case "extends": return !!(band.extends?.length);
      case "includes": return !!(band.includes?.length);
    }
  }

  private getCapsByColumn(band: BandDocument, col: PermColumn): Array<{cat: PermCategory, val: string}> {
    const items: Array<{cat: PermCategory, val: string}> = [];
    const permCol = band[col];
    if (!permCol) return items;

    for (const cat of ["tools", "skills", "mcps", "apis", "fs", "cli", "net"] as const) {
      const arr = permCol[cat];
      if (!arr) continue;
      for (const v of arr) {
        const val = typeof v === "string" ? v : `${v.kind}:${v.ref}`;
        items.push({ cat, val });
      }
    }

    return items;
  }

  private getLimits(band: BandDocument): Array<{key: keyof Limits, val: number}> {
    const items: Array<{key: keyof Limits, val: number}> = [];
    if (!band.limit) return items;
    for (const def of LIMIT_DEFS) {
      if (band.limit[def.key] != null) {
        items.push({ key: def.key, val: band.limit[def.key]! });
      }
    }
    return items;
  }

  private render() {
    const band = store.currentBand();
    if (!band) return;

    const allowItems = this.getCapsByColumn(band, "allow");
    const denyItems = this.getCapsByColumn(band, "deny");
    const insistItems = this.getCapsByColumn(band, "insist");
    const limitItems = this.getLimits(band);
    const envCount = (band.env?.secrets?.length ?? 0) + (band.env?.variables?.length ?? 0);
    const contractCount = (band.contract?.input ? 1 : 0) + (band.contract?.output ? 1 : 0);

    this.innerHTML = `
      <div class="compact">
        <!-- Identity row -->
        <div class="row row--identity">
          <button class="emoji-btn" id="emoji-trigger">${band.icon || "🎵"}</button>
          <input class="input input--name" id="name" placeholder="my-band-name">
          <div class="emoji-popup" id="emoji-popup" style="display:none"></div>
        </div>

        <!-- Description -->
        <div class="row">
          <input class="input input--full" id="desc" placeholder="description">
        </div>

        <!-- Four columns for capabilities and limits -->
        <div class="cap-tabs">
          <button class="cap-tab cap-tab--allow ${this.openColumn === "allow" ? "cap-tab--active" : ""}" data-col="allow">
            <span class="cap-icon">👍</span>
            <span class="cap-count">${allowItems.length || ""}</span>
          </button>
          <button class="cap-tab cap-tab--deny ${this.openColumn === "deny" ? "cap-tab--active" : ""}" data-col="deny">
            <span class="cap-icon">👎</span>
            <span class="cap-count">${denyItems.length || ""}</span>
          </button>
          <button class="cap-tab cap-tab--insist ${this.openColumn === "insist" ? "cap-tab--active" : ""}" data-col="insist">
            <span class="cap-icon">🫵</span>
            <span class="cap-count">${insistItems.length || ""}</span>
          </button>
          <button class="cap-tab cap-tab--limits ${this.openColumn === "limits" ? "cap-tab--active" : ""}" data-col="limits">
            <span class="cap-icon">🤏</span>
            <span class="cap-count">${limitItems.length || ""}</span>
          </button>
          <button class="cap-tab cap-tab--env ${this.openColumn === "env" ? "cap-tab--active" : ""}" data-col="env">
            <span class="cap-icon">🤫</span>
            <span class="cap-count">${envCount || ""}</span>
          </button>
          <button class="cap-tab cap-tab--contract ${this.openColumn === "contract" ? "cap-tab--active" : ""}" data-col="contract">
            <span class="cap-icon">📋</span>
            <span class="cap-count">${contractCount || ""}</span>
          </button>
        </div>
        ${this.openColumn === "allow" ? this.renderColumnPanel("allow", band) : ""}
        ${this.openColumn === "deny" ? this.renderColumnPanel("deny", band) : ""}
        ${this.openColumn === "insist" ? this.renderColumnPanel("insist", band) : ""}
        ${this.openColumn === "limits" ? this.renderLimitsPanel(band) : ""}
        ${this.openColumn === "env" ? this.renderEnvPanel(band) : ""}
        ${this.openColumn === "contract" ? this.renderContractPanel(band) : ""}

        <!-- Optional fields -->
        ${this.hasField(band, "execution") ? `
          <div class="row">
            <span class="label">runs on</span>
            <select class="select" id="execution">
              ${EXECUTION_TARGETS.map(t => `<option value="${t}" ${band.execution?.target === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
            <button class="remove-field" data-field="execution">×</button>
          </div>
        ` : ""}

        ${this.hasField(band, "extends") ? `
          <div class="row">
            <span class="label">extends</span>
            <div class="pills">${band.extends!.map(e => `<span class="pill">${esc(e)}<button class="pill-x" data-type="extends" data-val="${esc(e)}">×</button></span>`).join("")}</div>
            <button class="remove-field" data-field="extends">×</button>
          </div>
        ` : ""}

        ${this.hasField(band, "includes") ? `
          <div class="row">
            <span class="label">includes</span>
            <div class="pills">${band.includes!.map(e => `<span class="pill">${esc(e)}<button class="pill-x" data-type="includes" data-val="${esc(e)}">×</button></span>`).join("")}</div>
            <button class="remove-field" data-field="includes">×</button>
          </div>
        ` : ""}
      </div>
    `;

    this.wire();
  }

  private renderColumnPanel(col: PermColumn, band: BandDocument): string {
    const permCol = band[col] as PermissionCategories | undefined;

    return `
      <div class="cap-panel cap-panel--${col}">
        ${PERM_CATEGORIES.map(catDef => {
          const items = permCol?.[catDef.key] ?? [];
          const values = items.map((v: unknown) => typeof v === "string" ? v : `${(v as any).kind}:${(v as any).ref}`);
          // Always add an empty slot at the end for new entries
          const allValues = [...values, ""];

          return `
            <div class="cap-category">
              <div class="cap-category-header" title="${catDef.tooltip}">${catDef.label}</div>
              <div class="cap-category-items">
                ${allValues.map((val: string, idx: number) => {
                  const isLast = idx === allValues.length - 1;
                  const hasValue = val !== "";
                  return `
                  <div class="cap-input-row">
                    <input class="cap-input" type="text" data-col="${col}" data-cat="${catDef.key}" data-idx="${idx}" value="${esc(val)}" placeholder="${isLast ? catDef.placeholder : ""}">
                    ${hasValue
                      ? `<button class="cap-action cap-action--remove" data-col="${col}" data-cat="${catDef.key}" data-idx="${idx}">×</button>`
                      : `<span class="cap-action-spacer"></span>`
                    }
                  </div>
                `;}).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  private renderLimitsPanel(band: BandDocument): string {
    return `
      <div class="cap-panel cap-panel--limits">
        ${LIMIT_DEFS.map(def => {
          const val = band.limit?.[def.key];
          const displayVal = formatLimitValue(val, def.type);
          const hasValue = val != null;
          return `
            <div class="limit-row">
              <div class="limit-header">
                <span class="limit-label" title="${def.tooltip}">${def.label}</span>
                <div class="limit-presets">
                  ${def.presets.map(p => `<button class="limit-preset${displayVal === p ? " limit-preset--active" : ""}" data-limit="${def.key}" data-preset="${p}">${p}</button>`).join("")}
                </div>
              </div>
              <div class="cap-input-row">
                <input class="cap-input" type="text" data-limit="${def.key}" data-type="${def.type}" value="${displayVal}" placeholder="${def.placeholder}">
                ${hasValue
                  ? `<button class="cap-action cap-action--remove" data-limit="${def.key}">×</button>`
                  : `<span class="cap-action-spacer"></span>`
                }
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  private renderEnvPanel(band: BandDocument): string {
    return `
      <div class="cap-panel cap-panel--env">
        ${ENV_DEFS.map(def => {
          const items = band.env?.[def.key] ?? [];
          // Always add an empty slot at the end for new entries
          const allItems = [...items, ""];
          return `
            <div class="cap-category">
              <div class="cap-category-header" title="${def.tooltip}">${def.label}</div>
              <div class="cap-category-items">
                ${allItems.map((val: string, idx: number) => {
                  const isLast = idx === allItems.length - 1;
                  const hasValue = val !== "";
                  return `
                  <div class="cap-input-row">
                    <input class="cap-input" type="text" data-env="${def.key}" data-idx="${idx}" value="${esc(val)}" placeholder="${isLast ? def.placeholder : ""}">
                    ${hasValue
                      ? `<button class="cap-action cap-action--remove" data-env="${def.key}" data-idx="${idx}">×</button>`
                      : `<span class="cap-action-spacer"></span>`
                    }
                  </div>
                `;}).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  private getContractMode(field: "input" | "output", val: string | Record<string, unknown> | undefined): "ref" | "inline" {
    // Explicit override from toggle takes priority
    if (this.contractModes[field]) return this.contractModes[field]!;
    // Infer from value type
    if (typeof val === "object" && val !== null) return "inline";
    return "ref";
  }

  private renderContractField(field: "input" | "output", label: string, tooltip: string, val: string | Record<string, unknown> | undefined): string {
    const mode = this.getContractMode(field, val);
    const isInline = mode === "inline";
    const inlineJson = (typeof val === "object" && val !== null) ? JSON.stringify(val, null, 2) : "";
    const refStr = typeof val === "string" ? val : "";

    return `
      <div class="cap-category">
        <div class="cap-category-header" title="${tooltip}">${label}</div>
        <div class="contract-mode-toggle">
          <button class="contract-mode-btn${!isInline ? " contract-mode-btn--active" : ""}" data-contract-mode="${field}" data-mode="ref">Reference</button>
          <button class="contract-mode-btn${isInline ? " contract-mode-btn--active" : ""}" data-contract-mode="${field}" data-mode="inline">Inline</button>
        </div>
        ${isInline
          ? `<textarea class="contract-schema" data-contract="${field}" placeholder='{ "type": "object", "properties": { ... } }' spellcheck="false">${esc(inlineJson)}</textarea>`
          : `<input class="cap-input contract-ref" type="text" data-contract-ref="${field}" value="${esc(refStr)}" placeholder="./schema.json or https://...">`
        }
      </div>
    `;
  }

  private renderContractPanel(band: BandDocument): string {
    return `
      <div class="cap-panel cap-panel--contract">
        ${this.renderContractField("input", "Input Schema", "JSON Schema describing what this band accepts", band.contract?.input)}
        ${this.renderContractField("output", "Output Schema", "JSON Schema describing what this band returns", band.contract?.output)}
      </div>
    `;
  }

  private wire() {
    const band = store.currentBand();
    if (!band) return;

    // Name - set value programmatically and auto-convert to kebab-case
    const nameInput = this.querySelector("#name") as HTMLInputElement;
    if (nameInput) {
      nameInput.value = band.band;
      nameInput.addEventListener("input", () => {
        // Convert to kebab-case: lowercase, replace invalid chars with dash, collapse multiple dashes
        // But don't trim trailing dashes while typing (only collapse multiples)
        const kebab = nameInput.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
        store.updateCurrentBand(b => { b.band = kebab; });
      });
    }

    // Description - set value programmatically to avoid HTML escaping issues
    const descInput = this.querySelector("#desc") as HTMLInputElement;
    if (descInput) {
      descInput.value = band.description ?? "";
      descInput.addEventListener("input", (e) => {
        store.updateCurrentBand(b => { b.description = (e.target as HTMLInputElement).value || ""; });
      });
    }

    // Tab switching
    this.querySelectorAll<HTMLButtonElement>(".cap-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const col = btn.dataset.col as "allow" | "deny" | "insist" | "limits" | "env" | "contract";
        this.openColumn = this.openColumn === col ? null : col;
        this.render();
      });
    });

    // All capability inputs - unified handler for both existing and new items
    this.querySelectorAll<HTMLInputElement>(".cap-input[data-col][data-idx]").forEach(input => {
      input.addEventListener("input", () => {
        const col = input.dataset.col as PermColumn;
        const cat = input.dataset.cat as PermCategory;
        const idx = parseInt(input.dataset.idx!, 10);
        const val = input.value;

        store.updateCurrentBand(b => {
          if (!b[col]) b[col] = {};
          const permCol = b[col]!;
          if (!permCol[cat]) permCol[cat] = [];
          const arr = permCol[cat] as string[];

          if (idx < arr.length) {
            // Editing existing item
            if (val) {
              arr[idx] = val;
            } else {
              // Empty - remove the item
              arr.splice(idx, 1);
              if (arr.length === 0) delete permCol[cat];
              if (Object.keys(permCol).length === 0) delete b[col];
            }
          } else if (val) {
            // Adding new item (idx === arr.length, the empty slot)
            arr.push(val);
          }
        });
      });
    });

    // Remove capability items
    this.querySelectorAll<HTMLButtonElement>(".cap-action--remove[data-col]").forEach(btn => {
      btn.addEventListener("click", () => {
        const col = btn.dataset.col as PermColumn;
        const cat = btn.dataset.cat as PermCategory;
        const idx = parseInt(btn.dataset.idx!, 10);

        store.updateCurrentBand(b => {
          const permCol = b[col];
          if (!permCol || !permCol[cat]) return;
          const arr = permCol[cat] as unknown[];
          arr.splice(idx, 1);
          if (arr.length === 0) delete permCol[cat];
          if (Object.keys(permCol).length === 0) delete b[col];
        });
      });
    });

    // Limit preset buttons
    this.querySelectorAll<HTMLButtonElement>(".limit-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.limit as keyof Limits;
        const preset = btn.dataset.preset!;
        store.updateCurrentBand(b => {
          if (!b.limit) b.limit = {};
          b.limit[key] = preset;
        });
      });
    });

    // Edit limit values - reactive on every keystroke
    this.querySelectorAll<HTMLInputElement>(".cap-input[data-limit]").forEach(input => {
      input.addEventListener("input", () => {
        const key = input.dataset.limit as keyof Limits;
        const val = input.value.trim();
        store.updateCurrentBand(b => {
          if (val) {
            if (!b.limit) b.limit = {};
            b.limit[key] = val;
          } else if (b.limit) {
            delete b.limit[key];
            if (Object.keys(b.limit).length === 0) delete b.limit;
          }
        });
      });
    });

    // Remove limit items
    this.querySelectorAll<HTMLButtonElement>(".cap-action--remove[data-limit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.limit as keyof Limits;
        store.updateCurrentBand(b => {
          if (b.limit) {
            delete b.limit[key];
            if (Object.keys(b.limit).length === 0) delete b.limit;
          }
        });
      });
    });

    // All env inputs - unified handler for both existing and new items
    this.querySelectorAll<HTMLInputElement>(".cap-input[data-env][data-idx]").forEach(input => {
      input.addEventListener("input", () => {
        const field = input.dataset.env as EnvField;
        const idx = parseInt(input.dataset.idx!, 10);
        const val = input.value;

        store.updateCurrentBand(b => {
          if (!b.env) b.env = {};
          if (!b.env[field]) b.env[field] = [];
          const arr = b.env[field] as string[];

          if (idx < arr.length) {
            // Editing existing item
            if (val) {
              arr[idx] = val;
            } else {
              // Empty - remove the item
              arr.splice(idx, 1);
              if (arr.length === 0) delete b.env[field];
              if (Object.keys(b.env).length === 0) delete b.env;
            }
          } else if (val) {
            // Adding new item (idx === arr.length, the empty slot)
            arr.push(val);
          }
        });
      });
    });

    // Remove env items
    this.querySelectorAll<HTMLButtonElement>(".cap-action--remove[data-env]").forEach(btn => {
      btn.addEventListener("click", () => {
        const field = btn.dataset.env as EnvField;
        const idx = parseInt(btn.dataset.idx!, 10);

        store.updateCurrentBand(b => {
          if (!b.env || !b.env[field]) return;
          const arr = b.env[field] as string[];
          arr.splice(idx, 1);
          if (arr.length === 0) delete b.env[field];
          if (Object.keys(b.env).length === 0) delete b.env;
        });
      });
    });

    // Contract mode toggle buttons
    this.querySelectorAll<HTMLButtonElement>(".contract-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const field = btn.dataset.contractMode as "input" | "output";
        const mode = btn.dataset.mode as "ref" | "inline";
        this.contractModes[field] = mode;
        store.updateCurrentBand(b => {
          if (mode === "ref") {
            // Switch to reference — clear inline value
            if (b.contract) {
              delete b.contract[field];
              if (!b.contract.input && !b.contract.output) delete b.contract;
            }
          } else {
            // Switch to inline — clear ref value
            if (b.contract && typeof b.contract[field] === "string") {
              delete b.contract[field];
              if (!b.contract.input && !b.contract.output) delete b.contract;
            }
          }
        });
      });
    });

    // Contract inline schema textareas
    // Only update the store when JSON is valid or field is cleared.
    // Invalid JSON just shows the error indicator — no store update, no re-render.
    this.querySelectorAll<HTMLTextAreaElement>(".contract-schema").forEach(textarea => {
      textarea.addEventListener("input", () => {
        const field = textarea.dataset.contract as "input" | "output";
        const val = textarea.value.trim();
        if (!val) {
          store.updateCurrentBand(b => {
            if (b.contract) {
              delete b.contract[field];
              if (!b.contract.input && !b.contract.output) delete b.contract;
            }
          });
          textarea.classList.remove("contract-schema--error");
          return;
        }
        try {
          const parsed = JSON.parse(val);
          if (typeof parsed === "object" && parsed !== null) {
            store.updateCurrentBand(b => {
              if (!b.contract) b.contract = {};
              b.contract[field] = parsed;
            });
            textarea.classList.remove("contract-schema--error");
          }
        } catch {
          textarea.classList.add("contract-schema--error");
        }
      });
    });

    // Contract reference inputs
    this.querySelectorAll<HTMLInputElement>(".contract-ref").forEach(input => {
      input.addEventListener("input", () => {
        const field = input.dataset.contractRef as "input" | "output";
        const val = input.value;
        store.updateCurrentBand(b => {
          if (val) {
            if (!b.contract) b.contract = {};
            b.contract[field] = val;
          } else {
            if (b.contract) {
              delete b.contract[field];
              if (!b.contract.input && !b.contract.output) delete b.contract;
            }
          }
        });
      });
    });

    // Execution
    this.querySelector("#execution")?.addEventListener("change", (e) => {
      store.updateCurrentBand(b => { b.execution = { target: (e.target as HTMLSelectElement).value as ExecutionTarget }; });
    });

    // Remove field buttons
    this.querySelectorAll<HTMLButtonElement>(".remove-field").forEach(btn => {
      btn.addEventListener("click", () => {
        const field = btn.dataset.field as OptionalField;
        store.updateCurrentBand(b => {
          switch (field) {
            case "execution": delete b.execution; break;
            case "extends": delete b.extends; break;
            case "includes": delete b.includes; break;
          }
        });
      });
    });

    // Remove pill buttons (extends/includes)
    this.querySelectorAll<HTMLButtonElement>(".pill-x").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type as "extends" | "includes";
        const val = btn.dataset.val!;
        store.updateCurrentBand(b => {
          if (b[type]) {
            b[type] = b[type]!.filter(v => v !== val);
            if (b[type]!.length === 0) delete b[type];
          }
        });
      });
    });

    // Emoji picker
    const emojiBtn = this.querySelector("#emoji-trigger") as HTMLElement;
    const emojiPopup = this.querySelector("#emoji-popup") as HTMLElement;
    emojiBtn?.addEventListener("click", () => {
      if (emojiPopup.style.display === "none") {
        // Position below the button
        const rect = emojiBtn.getBoundingClientRect();
        emojiPopup.style.top = `${rect.bottom + 8}px`;
        emojiPopup.style.left = `${rect.left}px`;
        emojiPopup.style.display = "block";
        emojiPopup.innerHTML = "<emoji-picker-inline></emoji-picker-inline>";
      } else {
        emojiPopup.style.display = "none";
      }
    });
    this.addEventListener("emoji:selected", ((e: CustomEvent) => {
      store.updateCurrentBand(b => { b.icon = e.detail; });
    }) as EventListener);

  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

customElements.define("band-compact", BandCompact);
