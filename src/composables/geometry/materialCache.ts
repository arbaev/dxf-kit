import * as THREE from "three";
import { ACI7_COLOR, resolveAci7Hex } from "@/utils/colorResolver";

/**
 * Consolidated cache for Three.js materials used during DXF rendering.
 * Materials are cached per color key to avoid creating duplicates.
 * Theme-dependent materials (ACI 7) are tracked for instant dark mode switching.
 */
export class MaterialCacheStore {
  readonly line = new Map<string, THREE.LineBasicMaterial>();
  readonly mesh = new Map<string, THREE.MeshBasicMaterial>();
  readonly points = new Map<string, THREE.PointsMaterial>();

  /** Materials whose color depends on theme (ACI 7 sentinel) */
  readonly themeMaterials = new Set<THREE.Material & { color: THREE.Color }>();

  /** Current dark theme state */
  darkTheme = false;

  /** Resolve color string — replaces ACI7 sentinel with concrete hex */
  resolveColor(color: string): string {
    return color === ACI7_COLOR ? resolveAci7Hex(this.darkTheme) : color;
  }

  /** Update all theme-dependent materials for new theme */
  switchTheme(darkTheme: boolean): void {
    this.darkTheme = darkTheme;
    const hex = resolveAci7Hex(darkTheme);
    for (const mat of this.themeMaterials) {
      mat.color.set(hex);
    }
  }

  /** Dispose all cached materials and clear the maps */
  disposeAll(): void {
    for (const mat of this.line.values()) mat.dispose();
    this.line.clear();
    for (const mat of this.mesh.values()) mat.dispose();
    this.mesh.clear();
    for (const mat of this.points.values()) mat.dispose();
    this.points.clear();
    this.themeMaterials.clear();
  }
}
