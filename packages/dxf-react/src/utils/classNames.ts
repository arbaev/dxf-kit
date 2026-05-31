/**
 * Tiny className joiner. Merges the built-in `.dxfk-*` hook class with any extra
 * class names (from the `classes` prop or conditional modifiers) explicitly.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
