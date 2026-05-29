/**
 * Pure layer-grouping utility: split a list of layers into buckets sharing a
 * common name prefix (`A-WALL`, `A-DOOR` → group `A`).
 *
 * Framework-agnostic — no Three.js / Vue / DOM dependencies. Intended to be
 * consumed 1:1 by future React / Lit wrappers' layer panels.
 */

export interface LayerGroup<T> {
  /** Common prefix shared by all layers in this group. Empty string for the ungrouped bucket. */
  prefix: string;
  /** Layers belonging to this group, in input order. */
  layers: T[];
}

export interface GroupLayersByPrefixOptions {
  /**
   * Pattern that delimits the prefix. The prefix is everything before the
   * first match. Default: `/[-_]/` — splits on the first hyphen or
   * underscore, matching the AutoCAD / AIA layer-naming convention
   * (`A-WALL`, `M_PIPE_CHWS`). String values are treated as plain text.
   */
  separator?: RegExp | string;
  /**
   * Minimum number of layers sharing a prefix required to form a group.
   * Prefixes below the threshold collapse into the `""` (ungrouped) bucket.
   * Default: `2` — a unique-prefix layer is treated as ungrouped.
   */
  minGroupSize?: number;
}

const DEFAULT_SEPARATOR = /[-_]/;
const DEFAULT_MIN_GROUP_SIZE = 2;

type NamedLayer = { name: string };
type LayerInput = string | NamedLayer;

function getName<T extends LayerInput>(layer: T): string {
  return typeof layer === "string" ? layer : layer.name;
}

function extractPrefix(name: string, separator: RegExp | string): string {
  let idx: number;
  if (typeof separator === "string") {
    idx = separator.length === 0 ? -1 : name.indexOf(separator);
  } else {
    // Strip g/y flags so we don't share lastIndex across calls.
    const re = separator.global || separator.sticky
      ? new RegExp(separator.source, separator.flags.replace(/[gy]/g, ""))
      : separator;
    const m = re.exec(name);
    idx = m ? m.index : -1;
  }
  return idx > 0 ? name.slice(0, idx) : "";
}

/**
 * Group layers by their common name prefix.
 *
 * The prefix is the substring before the first match of `separator`. Layers
 * whose name has no separator, an empty prefix (e.g. `"-FOO"`), or a prefix
 * shared by fewer than `minGroupSize` layers fall into the synthetic
 * `prefix: ""` bucket.
 *
 * Returned groups are sorted alphabetically by `prefix`; the ungrouped
 * bucket (`""`) — when present — is always last. Within each group, layer
 * order matches the input.
 *
 * Accepts both raw `string[]` and `{ name: string }[]` inputs (compatible
 * with `LayerState[]` from `useLayers`).
 */
export function groupLayersByPrefix<T extends LayerInput>(
  layers: readonly T[],
  options?: GroupLayersByPrefixOptions,
): LayerGroup<T>[] {
  if (!layers || layers.length === 0) return [];

  const separator = options?.separator ?? DEFAULT_SEPARATOR;
  const minGroupSize = Math.max(1, options?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE);

  // First pass: count occurrences per prefix.
  const counts = new Map<string, number>();
  const prefixes: string[] = new Array(layers.length);
  for (let i = 0; i < layers.length; i++) {
    const prefix = extractPrefix(getName(layers[i]), separator);
    prefixes[i] = prefix;
    if (prefix !== "") counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }

  // Second pass: assemble groups + ungrouped bucket in input order.
  const groupByPrefix = new Map<string, LayerGroup<T>>();
  const ungrouped: T[] = [];
  for (let i = 0; i < layers.length; i++) {
    const prefix = prefixes[i];
    const survives = prefix !== "" && (counts.get(prefix) ?? 0) >= minGroupSize;
    if (survives) {
      let g = groupByPrefix.get(prefix);
      if (!g) {
        g = { prefix, layers: [] };
        groupByPrefix.set(prefix, g);
      }
      g.layers.push(layers[i]);
    } else {
      ungrouped.push(layers[i]);
    }
  }

  const groups = Array.from(groupByPrefix.values());
  groups.sort((a, b) => (a.prefix < b.prefix ? -1 : a.prefix > b.prefix ? 1 : 0));
  if (ungrouped.length > 0) groups.push({ prefix: "", layers: ungrouped });
  return groups;
}
