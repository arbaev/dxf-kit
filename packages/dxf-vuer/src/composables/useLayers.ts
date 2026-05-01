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
   */
  getStorageKey?: () => string | null | undefined;
}

const isStorageAvailable = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function useLayers(options?: UseLayersOptions) {
  const layers = ref<Map<string, LayerState>>(new Map());

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
    const hidden: string[] = [];
    layers.value.forEach((l) => {
      if (!l.visible && !l.frozen) hidden.push(l.name);
    });
    try {
      window.localStorage.setItem(key, JSON.stringify(hidden));
    } catch {
      // Quota exceeded or storage disabled — silently skip
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

    // Apply persisted visibility (silently ignores names that no longer exist)
    const hidden = loadHiddenFromStorage();
    if (hidden.size > 0) {
      newLayers.forEach((layer) => {
        if (!layer.frozen && hidden.has(layer.name)) {
          layer.visible = false;
        }
      });
    }

    layers.value = newLayers;
  };

  const toggleLayerVisibility = (layerName: string) => {
    const layer = layers.value.get(layerName);
    if (layer && !layer.frozen) {
      layer.visible = !layer.visible;
      persistHiddenToStorage();
    }
  };

  const showAllLayers = () => {
    layers.value.forEach((layer) => {
      if (!layer.frozen) layer.visible = true;
    });
    persistHiddenToStorage();
  };

  const hideAllLayers = () => {
    layers.value.forEach((layer) => {
      layer.visible = false;
    });
    persistHiddenToStorage();
  };

  const visibleLayerNames = computed(() => {
    const names = new Set<string>();
    layers.value.forEach((layer) => {
      if (layer.visible) names.add(layer.name);
    });
    return names;
  });

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
    initLayers,
    toggleLayerVisibility,
    showAllLayers,
    hideAllLayers,
    updateLayerThemeColors,
    clearLayers,
  };
}
