// Importing "dxf-lit" for its side effect registers <dxf-viewer> (and the
// dxf-layer-panel / dxf-properties-panel / dxf-ruler sub-elements) as Custom
// Elements, and augments HTMLElementTagNameMap so the queries below are typed.
import "dxf-lit";
import type { PickingEvent } from "dxf-lit";

const viewer = document.querySelector("dxf-viewer")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const themeBtn = document.getElementById("theme-btn") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLSpanElement;

// 1. Imperative methods — load a user-picked file through the element's API.
//    (The declarative `url` attribute handles the initial sample on its own.)
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  viewer.url = ""; // stop the sample from reloading
  viewer.fileName = file.name;
  status.textContent = `Loading ${file.name}…`;
  await viewer.loadDXFFromText(await file.text());
});

// 2. Attributes / properties — toggling the `dark-theme` attribute re-themes
//    the Shadow DOM reactively, just like any native element attribute.
themeBtn.addEventListener("click", () => {
  viewer.darkTheme = !viewer.darkTheme;
});

// 3. Custom Events — since native slots can't receive data, the viewer surfaces
//    its state through bubbling Custom Events instead of scoped slots.
viewer.addEventListener("dxf-loaded", (e) => {
  const ok = (e as CustomEvent<boolean>).detail;
  status.textContent = ok ? "Loaded ✓ — click an entity" : "Failed to load";
});

viewer.addEventListener("entity-click", (e) => {
  const pick = (e as CustomEvent<PickingEvent>).detail;
  status.textContent = `Clicked ${pick.type} on layer "${pick.layer}"`;
});

viewer.addEventListener("error", (e) => {
  // The viewer dispatches a CustomEvent named "error"; the cast goes through Event
  // because the DOM's built-in "error" event (ErrorEvent) shadows the name in the type map.
  status.textContent = `Error: ${(e as Event as CustomEvent<string>).detail}`;
});
