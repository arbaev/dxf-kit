import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { DxfLayer } from "dxf-render";
import { rgbNumberToHex, ACI_PALETTE, resolveThemeColor } from "dxf-render";

export interface LayerState {
  name: string;
  visible: boolean;
  frozen: boolean;
  locked: boolean;
  color: string;
  entityCount: number;
  /** True when layer color is ACI 7/255 (theme-dependent) */
  isAci7: boolean;
  /** Sentinel key for theme-adaptive colors (ACI 7/255, 250-252) */
  themeSentinel?: string;
}

export interface LayersControllerOptions {
  /** localStorage key for persisting hidden layers, or null/undefined to disable. */
  getStorageKey?: () => string | null | undefined;
  /** Controlled-mode hook: the externally-owned hidden-layer list, or undefined. */
  getControlledHidden?: () => readonly string[] | undefined;
  /** Controlled-mode notification after a user mutation. */
  onChange?: (hidden: string[]) => void;
}

const isStorageAvailable = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

/**
 * Layer-visibility state as a Lit ReactiveController. Ported from dxf-react's
 * `useLayers`: the authoritative `Map` is read synchronously by the getters
 * (right after a mutation — e.g. by the viewer's `syncLayerVisibility`) and a
 * snapshot array (`layerList`) drives rendering via `host.requestUpdate()`.
 */
export class LayersController implements ReactiveController {
  layerList: LayerState[] = [];
  private layers = new Map<string, LayerState>();

  constructor(
    private host: ReactiveControllerHost,
    private options: LayersControllerOptions = {},
  ) {
    host.addController(this);
  }

  hostDisconnected(): void {
    // nothing to tear down — state is GC'd with the controller
  }

  private commit(): void {
    this.layerList = Array.from(this.layers.values());
    this.host.requestUpdate();
  }

  private isControlled(): boolean {
    return this.options.getControlledHidden?.() !== undefined;
  }

  private loadHiddenFromStorage(): Set<string> {
    if (!isStorageAvailable()) return new Set();
    const key = this.options.getStorageKey?.();
    if (!key) return new Set();
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((n) => typeof n === "string")) : new Set();
    } catch {
      return new Set();
    }
  }

  private computeCurrentHidden(): string[] {
    const hidden: string[] = [];
    this.layers.forEach((l) => {
      if (!l.visible && !l.frozen) hidden.push(l.name);
    });
    return hidden;
  }

  private persistHiddenToStorage(): void {
    if (!isStorageAvailable()) return;
    const key = this.options.getStorageKey?.();
    if (!key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(this.computeCurrentHidden()));
    } catch {
      // Quota exceeded or storage disabled — silently skip
    }
  }

  private applyHiddenSetToLayers(hiddenSet: Set<string>): void {
    this.layers.forEach((layer) => {
      if (layer.frozen) return;
      layer.visible = !hiddenSet.has(layer.name);
    });
  }

  private persistOrNotify(): void {
    if (this.isControlled()) {
      this.options.onChange?.(this.computeCurrentHidden());
    } else {
      this.persistHiddenToStorage();
    }
  }

  /** Replace the visibility of all non-frozen layers with the given hidden-set. */
  setHiddenLayers(hidden: readonly string[]): void {
    this.applyHiddenSetToLayers(new Set(hidden));
    this.commit();
  }

  initLayers(
    dxfLayers: Record<string, DxfLayer>,
    entityLayerCounts: Record<string, number>,
    darkTheme?: boolean,
  ): void {
    const newLayers = new Map<string, LayerState>();
    for (const [name, layer] of Object.entries(dxfLayers)) {
      const ci = layer.colorIndex;
      const isAci7 = ci === 7 || ci === 255;
      const isGrayAdaptive = ci >= 250 && ci <= 251;
      const themeSentinel = isAci7 ? "\0ACI7" : isGrayAdaptive ? "\0ACI" + ci : undefined;
      let color = "#FFFFFF";
      if (ci >= 1 && ci <= 255) {
        color = themeSentinel
          ? resolveThemeColor(themeSentinel, darkTheme)
          : rgbNumberToHex(ACI_PALETTE[ci]);
      }

      newLayers.set(name, {
        name,
        visible: layer.visible && !layer.frozen,
        frozen: layer.frozen,
        locked: layer.locked ?? false,
        color,
        entityCount: entityLayerCounts[name] || 0,
        isAci7: isAci7 || isGrayAdaptive,
        themeSentinel,
      });
    }

    // Add layers referenced by entities but missing from the LAYER table
    const aci7Color = darkTheme ? "#ffffff" : "#000000";
    for (const [name, count] of Object.entries(entityLayerCounts)) {
      if (!newLayers.has(name)) {
        newLayers.set(name, {
          name,
          visible: true,
          frozen: false,
          locked: false,
          color: aci7Color,
          entityCount: count,
          isAci7: true,
        });
      }
    }

    this.layers = newLayers;

    // Apply visibility from the source of truth: controlled-mode external list
    // overrides DXF defaults; uncontrolled mode falls back to localStorage.
    const controlled = this.options.getControlledHidden?.();
    if (controlled !== undefined) {
      this.applyHiddenSetToLayers(new Set(controlled));
    } else {
      const hidden = this.loadHiddenFromStorage();
      if (hidden.size > 0) {
        newLayers.forEach((layer) => {
          if (!layer.frozen && hidden.has(layer.name)) {
            layer.visible = false;
          }
        });
      }
    }

    this.commit();
  }

  toggleLayerVisibility(layerName: string): void {
    const layer = this.layers.get(layerName);
    if (layer && !layer.frozen) {
      layer.visible = !layer.visible;
      this.persistOrNotify();
      this.commit();
    }
  }

  showAllLayers(): void {
    this.layers.forEach((layer) => {
      if (!layer.frozen) layer.visible = true;
    });
    this.persistOrNotify();
    this.commit();
  }

  hideAllLayers(): void {
    this.layers.forEach((layer) => {
      layer.visible = false;
    });
    this.persistOrNotify();
    this.commit();
  }

  /** Current set of visible layer names — read synchronously from the map. */
  getVisibleLayerNames(): Set<string> {
    const names = new Set<string>();
    this.layers.forEach((layer) => {
      if (layer.visible) names.add(layer.name);
    });
    return names;
  }

  /** Current hidden (non-frozen, not-visible) layer names. */
  getHiddenLayerNames(): string[] {
    return this.computeCurrentHidden();
  }

  updateLayerThemeColors(darkTheme: boolean): void {
    for (const layer of this.layers.values()) {
      if (layer.themeSentinel) {
        layer.color = resolveThemeColor(layer.themeSentinel, darkTheme);
      } else if (layer.isAci7) {
        layer.color = darkTheme ? "#ffffff" : "#000000";
      }
    }
    this.commit();
  }

  clearLayers(): void {
    this.layers = new Map();
    this.commit();
  }
}
