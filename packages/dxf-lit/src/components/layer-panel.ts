import { LitElement, html, css, nothing, svg, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { groupLayersByPrefix } from "dxf-render";
import type { GroupLayersByPrefixOptions, LayerGroup } from "dxf-render";
import type { LayerState } from "../controllers/layers";

const eyeIcon = svg`
  <svg class="dxfk-layer-icon-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
`;

const eyeOffIcon = svg`
  <svg class="dxfk-layer-icon-eye dxfk-layer-icon-eye--off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
`;

const frozenIcon = svg`
  <svg class="dxfk-layer-icon-frozen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
    <line x1="12" y1="2" x2="9" y2="5" />
    <line x1="12" y1="2" x2="15" y2="5" />
    <line x1="12" y1="22" x2="9" y2="19" />
    <line x1="12" y1="22" x2="15" y2="19" />
  </svg>
`;

const lockIcon = svg`
  <svg class="dxfk-layer-icon-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
`;

type GroupVisState = "all-visible" | "all-hidden" | "mixed" | "all-frozen";

function getGroupVisState(group: LayerGroup<LayerState>): GroupVisState {
  const toggleable = group.layers.filter((l) => !l.frozen);
  if (toggleable.length === 0) return "all-frozen";
  let visible = 0;
  for (const l of toggleable) if (l.visible) visible++;
  if (visible === 0) return "all-hidden";
  if (visible === toggleable.length) return "all-visible";
  return "mixed";
}

function getGroupVisibleCount(group: LayerGroup<LayerState>): number {
  let n = 0;
  for (const l of group.layers) if (l.visible && !l.frozen) n++;
  return n;
}

function getGroupTotalEntities(group: LayerGroup<LayerState>): number {
  let n = 0;
  for (const l of group.layers) n += l.entityCount;
  return n;
}

function groupToggleIcon(state: GroupVisState): TemplateResult {
  if (state === "mixed") {
    return svg`
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <path d="M12 4v16" stroke-width="1.5" />
        <path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="3" />
      </svg>`;
  }
  if (state === "all-hidden") {
    return svg`
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>`;
  }
  return svg`
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>`;
}

/**
 * `<dxf-layer-panel>` — layer-visibility list with filter + prefix grouping.
 * Internal sub-component used by `<dxf-viewer>`; a 1:1 port of dxf-react's
 * `LayerPanel`. Emits `toggle-layer` / `show-all` / `hide-all` / `layer-hover`
 * Custom Events; expand/filter/collapse state is encapsulated here.
 */
export class DxfLayerPanelElement extends LitElement {
  static override styles = css`
    :host { display: block; pointer-events: auto; }
    .dxfk-layer-panel {
      background-color: rgba(255, 255, 255, 0.95);
      border: 1px solid var(--dxfk-border-color, #e0e0e0);
      border-radius: var(--dxfk-border-radius, 4px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      max-height: 50vh;
      display: flex;
      flex-direction: column;
      min-width: 180px;
      max-width: 260px;
    }
    .dxfk-layer-panel--collapsed { max-height: none; }
    .dxfk-layer-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid var(--dxfk-border-color, #e0e0e0);
      flex-shrink: 0;
    }
    .dxfk-layer-panel--collapsed .dxfk-layer-panel-header { border-bottom: none; }
    .dxfk-layer-panel-title { font-size: 12px; font-weight: 600; color: var(--dxfk-text-color, #212121); }
    .dxfk-layer-panel-collapse {
      background: none; border: none; font-size: 16px; font-weight: 600;
      cursor: pointer; color: var(--dxfk-text-secondary, #757575); padding: 0 4px; line-height: 1;
    }
    .dxfk-layer-panel-body { overflow: hidden; display: flex; flex-direction: column; }
    .dxfk-layer-panel-actions {
      display: flex; gap: 4px; padding: 4px 10px;
      border-bottom: 1px solid var(--dxfk-border-color, #e0e0e0); flex-shrink: 0;
    }
    .dxfk-layer-panel-action {
      padding: 2px 8px; font-size: 11px; background: none;
      border: 1px solid var(--dxfk-border-color, #e0e0e0); border-radius: 3px;
      cursor: pointer; color: var(--dxfk-text-secondary, #757575); transition: all 0.15s;
    }
    .dxfk-layer-panel-action:hover { border-color: var(--dxfk-primary-color, #1040b0); color: var(--dxfk-primary-color, #1040b0); }
    .dxfk-layer-filter-wrapper {
      position: relative; padding: 4px 10px;
      border-bottom: 1px solid var(--dxfk-border-color, #e0e0e0); flex-shrink: 0;
    }
    .dxfk-layer-filter {
      width: 100%; padding: 3px 22px 3px 6px; font-size: 11px;
      border: 1px solid var(--dxfk-border-color, #e0e0e0); border-radius: 3px;
      background: white; color: var(--dxfk-text-color, #212121); outline: none; box-sizing: border-box;
    }
    .dxfk-layer-filter:focus { border-color: var(--dxfk-primary-color, #1040b0); }
    .dxfk-layer-filter::placeholder { color: var(--dxfk-text-secondary, #757575); }
    .dxfk-layer-filter-clear {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      width: 16px; height: 16px; padding: 0; border: none; background: none;
      font-size: 14px; line-height: 1; cursor: pointer; color: var(--dxfk-text-secondary, #757575);
    }
    .dxfk-layer-filter-clear:hover { color: var(--dxfk-text-color, #212121); }
    .dxfk-layer-empty {
      padding: 8px 10px; font-size: 11px; font-style: italic;
      color: var(--dxfk-text-secondary, #757575); text-align: center;
    }
    .dxfk-layer-list { overflow-y: auto; max-height: 300px; padding: 2px 0; }
    .dxfk-layer-item {
      display: flex; align-items: center; gap: 6px; padding: 4px 10px;
      cursor: pointer; transition: background-color 0.15s; font-size: 12px;
    }
    .dxfk-layer-item:hover { background-color: rgba(0, 0, 0, 0.04); }
    .dxfk-layer-item--hidden { opacity: 0.5; }
    .dxfk-layer-item--frozen { opacity: 0.35; cursor: not-allowed; }
    .dxfk-layer-item--in-group { padding-left: 22px; }
    .dxfk-layer-group { border-top: 1px solid var(--dxfk-border-color, #e0e0e0); }
    .dxfk-layer-group:first-child { border-top: none; }
    .dxfk-layer-group-header {
      display: flex; align-items: center; gap: 4px; padding: 4px 10px 4px 4px;
      cursor: pointer; user-select: none; font-size: 11px; font-weight: 600;
      color: var(--dxfk-text-secondary, #757575); background-color: rgba(0, 0, 0, 0.025);
      transition: background-color 0.15s;
    }
    .dxfk-layer-group-header:hover { background-color: rgba(0, 0, 0, 0.05); }
    .dxfk-layer-group-collapse {
      flex-shrink: 0; width: 18px; height: 18px; padding: 0; background: none; border: none;
      font-size: 14px; font-weight: 600; line-height: 1; cursor: pointer; color: var(--dxfk-text-secondary, #757575);
    }
    .dxfk-layer-group-name {
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: var(--dxfk-text-color, #212121); letter-spacing: 0.02em;
    }
    .dxfk-layer-group-count {
      flex-shrink: 0; font-size: 10px; font-weight: 500;
      color: var(--dxfk-text-secondary, #757575); white-space: nowrap;
    }
    .dxfk-layer-group-toggle {
      flex-shrink: 0; width: 22px; height: 22px; padding: 0; background: none; border: none;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
      color: var(--dxfk-text-color, #212121); border-radius: 3px; transition: background-color 0.15s;
    }
    .dxfk-layer-group-toggle:hover:not(:disabled) { background-color: rgba(0, 0, 0, 0.06); }
    .dxfk-layer-group-toggle:disabled { cursor: not-allowed; opacity: 0.4; }
    .dxfk-layer-group-toggle--all-hidden { color: var(--dxfk-text-secondary, #757575); }
    .dxfk-layer-group-toggle--mixed { color: var(--dxfk-text-color, #212121); opacity: 0.7; }
    .dxfk-layer-group-body { padding: 2px 0; }
    .dxfk-layer-icon-eye { flex-shrink: 0; color: var(--dxfk-text-color, #212121); }
    .dxfk-layer-icon-eye--off { color: var(--dxfk-text-secondary, #757575); }
    .dxfk-layer-icon-frozen { flex-shrink: 0; color: #5ba3d9; }
    .dxfk-layer-icon-lock { flex-shrink: 0; color: var(--dxfk-text-secondary, #757575); }
    .dxfk-layer-swatch {
      flex-shrink: 0; width: 12px; height: 12px; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.15);
    }
    .dxfk-layer-name {
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dxfk-text-color, #212121);
    }
    .dxfk-layer-count { flex-shrink: 0; font-size: 11px; color: var(--dxfk-text-secondary, #757575); }
    /* Dark theme */
    :host([dark-theme]) .dxfk-layer-panel {
      background-color: rgba(30, 30, 30, 0.95); border-color: #444; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }
    :host([dark-theme]) .dxfk-layer-panel-header { border-bottom-color: #444; }
    :host([dark-theme]) .dxfk-layer-panel-title { color: #e0e0e0; }
    :host([dark-theme]) .dxfk-layer-panel-collapse { color: #aaa; }
    :host([dark-theme]) .dxfk-layer-panel-actions { border-bottom-color: #444; }
    :host([dark-theme]) .dxfk-layer-panel-action { border-color: #555; color: #aaa; }
    :host([dark-theme]) .dxfk-layer-panel-action:hover { border-color: #6b8fd4; color: #6b8fd4; }
    :host([dark-theme]) .dxfk-layer-item:hover { background-color: rgba(255, 255, 255, 0.06); }
    :host([dark-theme]) .dxfk-layer-icon-eye { color: #e0e0e0; }
    :host([dark-theme]) .dxfk-layer-icon-eye--off { color: #666; }
    :host([dark-theme]) .dxfk-layer-name { color: #e0e0e0; }
    :host([dark-theme]) .dxfk-layer-count { color: #888; }
    :host([dark-theme]) .dxfk-layer-swatch { border-color: rgba(255, 255, 255, 0.2); }
    :host([dark-theme]) .dxfk-layer-group { border-top-color: #444; }
    :host([dark-theme]) .dxfk-layer-group-header { background-color: rgba(255, 255, 255, 0.04); color: #aaa; }
    :host([dark-theme]) .dxfk-layer-group-header:hover { background-color: rgba(255, 255, 255, 0.08); }
    :host([dark-theme]) .dxfk-layer-group-name { color: #e0e0e0; }
    :host([dark-theme]) .dxfk-layer-group-count,
    :host([dark-theme]) .dxfk-layer-group-collapse { color: #888; }
    :host([dark-theme]) .dxfk-layer-group-toggle { color: #e0e0e0; }
    :host([dark-theme]) .dxfk-layer-group-toggle:hover:not(:disabled) { background-color: rgba(255, 255, 255, 0.1); }
    :host([dark-theme]) .dxfk-layer-group-toggle--all-hidden { color: #666; }
    @media (max-width: 768px) {
      .dxfk-layer-panel { min-width: 150px; max-width: 200px; max-height: 40%; }
      .dxfk-layer-list { max-height: 200px; }
    }
  `;

  @property({ attribute: false }) layers: LayerState[] = [];
  @property({ type: Boolean, reflect: true, attribute: "dark-theme" }) darkTheme = false;
  @property({ attribute: false }) groupLayers: boolean | GroupLayersByPrefixOptions = false;

  @state() private _isExpanded = true;
  @state() private _filter = "";
  @state() private _collapsedGroups: Record<string, boolean> = {};

  private _emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private get _filteredLayers(): LayerState[] {
    const q = this._filter.trim().toLowerCase();
    if (!q) return this.layers;
    return this.layers.filter((l) => l.name.toLowerCase().includes(q));
  }

  private get _groups(): LayerGroup<LayerState>[] | null {
    if (!this.groupLayers) return null;
    const options = typeof this.groupLayers === "object" ? this.groupLayers : {};
    return groupLayersByPrefix(this._filteredLayers, options);
  }

  private _toggleExpanded = (): void => {
    this._isExpanded = !this._isExpanded;
  };

  private _onHeaderKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._toggleExpanded();
    }
  };

  private _toggleGroupCollapse(prefix: string): void {
    this._collapsedGroups = { ...this._collapsedGroups, [prefix]: !this._collapsedGroups[prefix] };
  }

  private _handleGroupToggle(group: LayerGroup<LayerState>): void {
    const state = getGroupVisState(group);
    if (state === "all-frozen") return;
    const shouldShow = state === "all-hidden";
    for (const l of group.layers) {
      if (l.frozen) continue;
      if (l.visible !== shouldShow) this._emit("toggle-layer", l.name);
    }
  }

  private _renderLayerItem(layer: LayerState, inGroup = false): TemplateResult {
    const toggle = (): void => {
      if (!layer.frozen) this._emit("toggle-layer", layer.name);
    };
    return html`
      <div
        class=${classMap({
          "dxfk-layer-item": true,
          "dxfk-layer-item--in-group": inGroup,
          "dxfk-layer-item--hidden": !layer.visible,
          "dxfk-layer-item--frozen": layer.frozen,
        })}
        role="button"
        tabindex=${layer.frozen ? -1 : 0}
        aria-pressed=${layer.visible}
        aria-disabled=${layer.frozen}
        aria-label=${`Toggle visibility of layer ${layer.name}`}
        @click=${toggle}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        @mouseenter=${() => {
          if (!layer.frozen) this._emit("layer-hover", layer.name);
        }}
        @mouseleave=${() => {
          if (!layer.frozen) this._emit("layer-hover", null);
        }}
      >
        ${layer.frozen ? frozenIcon : layer.visible ? eyeIcon : eyeOffIcon}
        ${layer.locked && !layer.frozen ? lockIcon : nothing}
        <span class="dxfk-layer-swatch" style=${styleMap({ backgroundColor: layer.color })}></span>
        <span class="dxfk-layer-name" title=${layer.name}>${layer.name}</span>
        <span class="dxfk-layer-count">${layer.entityCount}</span>
      </div>
    `;
  }

  private _renderGroup(group: LayerGroup<LayerState>): TemplateResult {
    const expanded = !this._collapsedGroups[group.prefix];
    const visState = getGroupVisState(group);
    return html`
      <div
        class=${classMap({ "dxfk-layer-group": true, "dxfk-layer-group--collapsed": !expanded })}
        role="group"
        aria-label=${`Layer group ${group.prefix}`}
      >
        <div
          class="dxfk-layer-group-header"
          role="button"
          tabindex="0"
          aria-expanded=${expanded}
          @click=${() => this._toggleGroupCollapse(group.prefix)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this._toggleGroupCollapse(group.prefix);
            }
          }}
        >
          <button class="dxfk-layer-group-collapse" tabindex="-1" title=${expanded ? "Collapse" : "Expand"}>
            ${expanded ? "−" : "+"}
          </button>
          <span class="dxfk-layer-group-name" title=${group.prefix}>${group.prefix}</span>
          <span class="dxfk-layer-group-count">
            ${getGroupVisibleCount(group)} / ${group.layers.length} · ${getGroupTotalEntities(group)}
          </span>
          <button
            class=${classMap({
              "dxfk-layer-group-toggle": true,
              [`dxfk-layer-group-toggle--${visState}`]: true,
            })}
            ?disabled=${visState === "all-frozen"}
            aria-pressed=${visState !== "all-hidden"}
            aria-label=${`Toggle visibility of group ${group.prefix}`}
            title=${visState === "all-hidden" ? "Show all in group" : "Hide all in group"}
            @click=${(e: Event) => {
              e.stopPropagation();
              this._handleGroupToggle(group);
            }}
          >
            ${groupToggleIcon(visState)}
          </button>
        </div>
        ${expanded
          ? html`<div class="dxfk-layer-group-body">
              ${group.layers.map((layer) => this._renderLayerItem(layer, true))}
            </div>`
          : nothing}
      </div>
    `;
  }

  override render() {
    const groups = this._groups;
    const realGroups = groups?.filter((g) => g.prefix !== "") ?? [];
    const ungroupedLayers = groups?.find((g) => g.prefix === "")?.layers ?? [];
    const filtered = this._filteredLayers;

    return html`
      <div
        class=${classMap({
          "dxfk-layer-panel": true,
          "dxfk-layer-panel--collapsed": !this._isExpanded,
        })}
        part="layer-panel"
        role="region"
        aria-label="Layer visibility panel"
      >
        <div
          class="dxfk-layer-panel-header"
          role="button"
          tabindex="0"
          aria-expanded=${this._isExpanded}
          aria-label=${this._isExpanded ? "Collapse layer panel" : "Expand layer panel"}
          @click=${this._toggleExpanded}
          @keydown=${this._onHeaderKeyDown}
        >
          <span class="dxfk-layer-panel-title">Layers (${this.layers.length})</span>
          <button class="dxfk-layer-panel-collapse" title=${this._isExpanded ? "Collapse" : "Expand"} tabindex="-1">
            ${this._isExpanded ? "−" : "+"}
          </button>
        </div>

        ${this._isExpanded
          ? html`
              <div class="dxfk-layer-panel-body">
                <div class="dxfk-layer-panel-actions">
                  <button
                    class="dxfk-layer-panel-action"
                    aria-label="Show all layers"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this._emit("show-all");
                    }}
                  >
                    All
                  </button>
                  <button
                    class="dxfk-layer-panel-action"
                    aria-label="Hide all layers"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this._emit("hide-all");
                    }}
                  >
                    None
                  </button>
                </div>

                ${this.layers.length > 5
                  ? html`
                      <div class="dxfk-layer-filter-wrapper">
                        <input
                          .value=${this._filter}
                          type="text"
                          class="dxfk-layer-filter"
                          placeholder="Filter layers…"
                          aria-label="Filter layers by name"
                          @input=${(e: Event) => {
                            this._filter = (e.target as HTMLInputElement).value;
                          }}
                          @click=${(e: Event) => e.stopPropagation()}
                        />
                        ${this._filter
                          ? html`<button
                              class="dxfk-layer-filter-clear"
                              aria-label="Clear filter"
                              @click=${(e: Event) => {
                                e.stopPropagation();
                                this._filter = "";
                              }}
                            >
                              ×
                            </button>`
                          : nothing}
                      </div>
                    `
                  : nothing}

                <div class="dxfk-layer-list">
                  ${filtered.length === 0
                    ? html`<div class="dxfk-layer-empty">No layers match "${this._filter}"</div>`
                    : nothing}
                  ${groups
                    ? html`
                        ${realGroups.map((group) => this._renderGroup(group))}
                        ${ungroupedLayers.map((layer) => this._renderLayerItem(layer))}
                      `
                    : filtered.map((layer) => this._renderLayerItem(layer))}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
