import * as THREE from "three";
import {
  parseDxf,
  createThreeObjectsFromDXF,
  loadDefaultFont,
  useCamera,
  useOrbitControls,
} from "dxf-render";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const container = document.getElementById("canvas-container") as HTMLDivElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const status = document.getElementById("status") as HTMLSpanElement;

// Three.js setup
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const frustumSize = 100;
let aspect = container.clientWidth / container.clientHeight;

const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  0.1,
  1000,
);

const { fitCameraToBox } = useCamera();
const { initControls } = useOrbitControls();

renderer.setSize(container.clientWidth, container.clientHeight);

const controls = initControls(camera, canvas);
controls.addEventListener("change", () => renderer.render(scene, camera));

// Resize handling
window.addEventListener("resize", () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  aspect = w / h;
  camera.left = (frustumSize * aspect) / -2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = frustumSize / -2;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.render(scene, camera);
});

// DXF rendering
let currentGroup: THREE.Group | null = null;

async function renderDxf(text: string) {
  status.textContent = "Loading font...";
  await loadDefaultFont();

  status.textContent = "Parsing DXF...";
  const dxf = parseDxf(text);

  status.textContent = "Rendering...";
  const { group } = await createThreeObjectsFromDXF(dxf);

  // Remove previous drawing
  if (currentGroup) {
    scene.remove(currentGroup);
  }

  currentGroup = group;
  scene.add(group);

  const box = new THREE.Box3().setFromObject(group);
  fitCameraToBox(box, camera);
  renderer.render(scene, camera);

  status.textContent = `Rendered ${dxf.entities.length} entities`;
}

// File input handler
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  status.textContent = `Reading ${file.name}...`;
  const reader = new FileReader();
  reader.onload = () => renderDxf(reader.result as string);
  reader.readAsText(file);
});

// Make label clickable
document.querySelector("#toolbar label")?.addEventListener("click", () => {
  fileInput.click();
});
