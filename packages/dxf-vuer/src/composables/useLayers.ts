import { ref, computed } from "vue";
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

export interface UseLayersOptions {
  /**
   * Returns the localStorage key under which hidden layer names are persisted,
   * or null/undefined to disable persistence. Called fresh on every read/write,
   * so the consumer can derive the key from reactive state (e.g. file name).
   *
   * Ignored when the consumer is in controlled mode (see `getControlledHidden`).
   */
  getStorageKey?: () => string | null | undefined;
  /**
   * Controlled-mode hook: returns the externally-owned list of hidden layer
   * names, or `undefined` for uncontrolled mode.
   *
   * When this returns a non-undefined array, `useLayers` treats the consumer
   * as the source of truth — it applies the list during `initLayers` and on
   * `setHiddenLayers(...)`, and never reads/writes `localStorage`.
   */
  getControlledHidden?: () => readonly string[] | undefined;
  /**
   * Controlled-mode notification: called after `toggleLayerVisibility`,
   * `showAllLayers`, or `hideAllLayers` mutates state. Receives the new list
   * of hidden non-frozen layer names. Only invoked when `getControlledHidden`
   * returns a non-undefined array (i.e. the consumer is controlled).
   */
  onChange?: (hidden: string[]) => void;
}

const isStorageAvailable = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function useLayers(options?: UseLayersOptions) {
  const layers = ref<Map<string, LayerState>>(new Map());

  const isControlled = (): boolean =>
    options?.getControlledHidden?.() !== undefined;

  const loadHiddenFromStorage = (): Set<string> => {
    if (!isStorageAvailable()) return new Set();
    const key = options?.getStorageKey?.();
    if (!key) return new Set();
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((n) => typeof n === "string")) : new Set();
    } catch {
      return new Set();
    }
  };

  const persistHiddenToStorage = (): void => {
    if (!isStorageAvailable()) return;
    const key = options?.getStorageKey?.();
    if (!key) return;
    const hidden = computeCurrentHidden();
    try {
      window.localStorage.setItem(key, JSON.stringify(hidden));
    } catch {
      // Quota exceeded or storage disabled — silently skip
    }
  };

  const computeCurrentHidden = (): string[] => {
    const hidden: string[] = [];
    layers.value.forEach((l) => {
      if (!l.visible && !l.frozen) hidden.push(l.name);
    });
    return hidden;
  };

  const applyHiddenSetToLayers = (hiddenSet: Set<string>): void => {
    layers.value.forEach((layer) => {
      if (layer.frozen) return;
      layer.visible = !hiddenSet.has(layer.name);
    });
  };

  /**
   * Replace the visibility of all non-frozen layers with the given hidden-set.
   * Used by controlled-mode watchers in the consumer to push external updates
   * into `useLayers` without going through `toggleLayerVisibility`. Does NOT
   * call `onChange` — only state-mutating user actions do.
   */
  const setHiddenLayers = (hidden: readonly string[]): void => {
    applyHiddenSetToLayers(new Set(hidden));
  };

  const persistOrNotify = (): void => {
    if (isControlled()) {
      options!.onChange?.(computeCurrentHidden());
    } else {
      persistHiddenToStorage();
    }
  };

  const initLayers = (
    dxfLayers: Record<string, DxfLayer>,
    entityLayerCounts: Record<string, number>,
    darkTheme?: boolean,
  ) => {
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

    layers.value = newLayers;

    // Apply visibility from the source of truth: controlled-mode external list
    // overrides DXF defaults; uncontrolled mode falls back to localStorage.
    const controlled = options?.getControlledHidden?.();
    if (controlled !== undefined) {
      applyHiddenSetToLayers(new Set(controlled));
    } else {
      const hidden = loadHiddenFromStorage();
      if (hidden.size > 0) {
        newLayers.forEach((layer) => {
          if (!layer.frozen && hidden.has(layer.name)) {
            layer.visible = false;
          }
        });
      }
    }
  };

  const toggleLayerVisibility = (layerName: string) => {
    const layer = layers.value.get(layerName);
    if (layer && !layer.frozen) {
      layer.visible = !layer.visible;
      persistOrNotify();
    }
  };

  const showAllLayers = () => {
    layers.value.forEach((layer) => {
      if (!layer.frozen) layer.visible = true;
    });
    persistOrNotify();
  };

  const hideAllLayers = () => {
    layers.value.forEach((layer) => {
      layer.visible = false;
    });
    persistOrNotify();
  };

  const visibleLayerNames = computed(() => {
    const names = new Set<string>();
    layers.value.forEach((layer) => {
      if (layer.visible) names.add(layer.name);
    });
    return names;
  });

  const hiddenLayerNames = computed<string[]>(() => computeCurrentHidden());

  const layerList = computed(() => Array.from(layers.value.values()));

  const updateLayerThemeColors = (darkTheme: boolean) => {
    for (const layer of layers.value.values()) {
      if (layer.themeSentinel) {
        layer.color = resolveThemeColor(layer.themeSentinel, darkTheme);
      } else if (layer.isAci7) {
        layer.color = darkTheme ? "#ffffff" : "#000000";
      }
    }
  };

  const clearLayers = () => {
    layers.value = new Map();
  };

  return {
    layers,
    layerList,
    visibleLayerNames,
    hiddenLayerNames,
    initLayers,
    toggleLayerVisibility,
    showAllLayers,
    hideAllLayers,
    setHiddenLayers,
    updateLayerThemeColors,
    clearLayers,
  };
}
