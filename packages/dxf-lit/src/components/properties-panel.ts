import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import type { PickingEvent } from "dxf-interaction";
import { getEntityProperties, type PropertySection } from "../utils/entityProperties";

/**
 * `<dxf-properties-panel>` — read-only entity property listing. Internal
 * sub-component used by `<dxf-viewer>`; a 1:1 port of dxf-react's
 * `PropertiesPanel`. State (expand/collapse) is encapsulated here.
 */
export class DxfPropertiesPanelElement extends LitElement {
  static override styles = css`
    :host {
      display: block;
      pointer-events: auto;
    }
    .dxfk-properties-panel {
      background-color: rgba(255, 255, 255, 0.95);
      border: 1px solid var(--dxfk-border-color, #e0e0e0);
      border-radius: var(--dxfk-border-radius, 4px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      max-height: 50vh;
      display: flex;
      flex-direction: column;
      min-width: 220px;
      max-width: 320px;
    }
    .dxfk-properties-panel--collapsed { max-height: none; }
    .dxfk-properties-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      cursor: pointer;
      user-select: none;
      border-bottom: 1px solid var(--dxfk-border-color, #e0e0e0);
      flex-shrink: 0;
      gap: 6px;
    }
    .dxfk-properties-panel--collapsed .dxfk-properties-panel-header { border-bottom: none; }
    .dxfk-properties-panel-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--dxfk-text-color, #212121);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dxfk-properties-panel-type {
      font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
      font-size: 11px;
      background: rgba(0, 0, 0, 0.06);
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 600;
    }
    .dxfk-properties-panel-collapse {
      background: none;
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      color: var(--dxfk-text-secondary, #757575);
      padding: 0 4px;
      line-height: 1;
    }
    .dxfk-properties-panel-body { overflow-y: auto; padding: 4px 0; }
    .dxfk-properties-empty {
      padding: 12px;
      font-size: 12px;
      font-style: italic;
      color: var(--dxfk-text-secondary, #757575);
      text-align: center;
    }
    .dxfk-properties-section + .dxfk-properties-section {
      border-top: 1px solid var(--dxfk-border-color, #e0e0e0);
      margin-top: 4px;
      padding-top: 4px;
    }
    .dxfk-properties-section-title {
      margin: 0;
      padding: 4px 10px 2px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--dxfk-text-secondary, #757575);
    }
    .dxfk-properties-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 10px;
      font-size: 12px;
      min-width: 0;
    }
    .dxfk-properties-label {
      flex-shrink: 0;
      width: 96px;
      color: var(--dxfk-text-secondary, #757575);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dxfk-properties-value-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }
    .dxfk-properties-swatch {
      flex-shrink: 0;
      width: 12px;
      height: 12px;
      border-radius: 2px;
      border: 1px solid rgba(0, 0, 0, 0.15);
    }
    .dxfk-properties-value {
      color: var(--dxfk-text-color, #212121);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dxfk-properties-value--mono {
      font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
      font-size: 11px;
    }
    /* Dark theme */
    :host([dark-theme]) .dxfk-properties-panel {
      background-color: rgba(30, 30, 30, 0.95);
      border-color: #444;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }
    :host([dark-theme]) .dxfk-properties-panel-header { border-bottom-color: #444; }
    :host([dark-theme]) .dxfk-properties-panel-title { color: #e0e0e0; }
    :host([dark-theme]) .dxfk-properties-panel-type { background: rgba(255, 255, 255, 0.08); color: #e0e0e0; }
    :host([dark-theme]) .dxfk-properties-panel-collapse { color: #aaa; }
    :host([dark-theme]) .dxfk-properties-section + .dxfk-properties-section { border-top-color: #444; }
    :host([dark-theme]) .dxfk-properties-section-title { color: #888; }
    :host([dark-theme]) .dxfk-properties-label { color: #888; }
    :host([dark-theme]) .dxfk-properties-value { color: #e0e0e0; }
    :host([dark-theme]) .dxfk-properties-swatch { border-color: rgba(255, 255, 255, 0.2); }
    :host([dark-theme]) .dxfk-properties-empty { color: #888; }
    @media (max-width: 768px) {
      .dxfk-properties-panel { min-width: 180px; max-width: 240px; max-height: 40%; }
      .dxfk-properties-label { width: 80px; }
    }
  `;

  /** Picking event of the currently selected entity, or null. */
  @property({ attribute: false }) event: PickingEvent | null = null;
  @property({ type: Boolean, reflect: true, attribute: "dark-theme" }) darkTheme = false;

  @state() private _isExpanded = true;

  private get _sections(): PropertySection[] {
    if (!this.event?.entity) return [];
    return getEntityProperties(this.event.entity);
  }

  private _toggle = (): void => {
    this._isExpanded = !this._isExpanded;
  };

  private _onHeaderKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._toggle();
    }
  };

  override render() {
    const event = this.event;
    return html`
      <div
        class=${classMap({
          "dxfk-properties-panel": true,
          "dxfk-properties-panel--collapsed": !this._isExpanded,
        })}
        part="properties-panel"
        role="region"
        aria-label="Entity properties panel"
      >
        <div
          class="dxfk-properties-panel-header"
          role="button"
          tabindex="0"
          aria-expanded=${this._isExpanded}
          aria-label=${this._isExpanded ? "Collapse properties panel" : "Expand properties panel"}
          @click=${this._toggle}
          @keydown=${this._onHeaderKeyDown}
        >
          <span class="dxfk-properties-panel-title">
            Properties${event
              ? html`: <code class="dxfk-properties-panel-type">${event.type}</code>`
              : nothing}
          </span>
          <button
            class="dxfk-properties-panel-collapse"
            title=${this._isExpanded ? "Collapse" : "Expand"}
            aria-label=${this._isExpanded ? "Collapse" : "Expand"}
            tabindex="-1"
          >
            ${this._isExpanded ? "−" : "+"}
          </button>
        </div>

        ${this._isExpanded
          ? html`
              <div class="dxfk-properties-panel-body">
                ${!event
                  ? html`<div class="dxfk-properties-empty">Click an entity to inspect its properties.</div>`
                  : this._sections.map(
                      (section) => html`
                        <div class="dxfk-properties-section">
                          <h4 class="dxfk-properties-section-title">${section.title}</h4>
                          ${section.rows.map(
                            (row) => html`
                              <div class="dxfk-properties-row">
                                <span class="dxfk-properties-label">${row.label}</span>
                                <span class="dxfk-properties-value-wrap">
                                  ${row.swatch
                                    ? html`<span
                                        class="dxfk-properties-swatch"
                                        style=${styleMap({ backgroundColor: row.swatch })}
                                        aria-hidden="true"
                                      ></span>`
                                    : nothing}
                                  <span
                                    class=${classMap({
                                      "dxfk-properties-value": true,
                                      "dxfk-properties-value--mono": !!row.mono,
                                    })}
                                    title=${row.value}
                                    >${row.value}</span
                                  >
                                </span>
                              </div>
                            `,
                          )}
                        </div>
                      `,
                    )}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
