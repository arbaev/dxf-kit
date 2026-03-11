import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  parseDxf,
  createThreeObjectsFromDXF,
  loadDefaultFont,
  useCamera,
  useOrbitControls,
} from "dxf-render";

export function DxfViewer({ dxfText }: { dxfText: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const frustumSize = 100;
    const aspect = width / height;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000,
    );

    const { fitCameraToBox } = useCamera();
    const { initControls, cleanup } = useOrbitControls();

    let disposed = false;

    (async () => {
      await loadDefaultFont();
      const dxf = parseDxf(dxfText);
      const { group } = await createThreeObjectsFromDXF(dxf);
      if (disposed) return;

      scene.add(group);
      const controls = initControls(camera, canvas);
      controls.addEventListener("change", () => renderer.render(scene, camera));

      const box = new THREE.Box3().setFromObject(group);
      fitCameraToBox(box, camera);
      renderer.render(scene, camera);
    })();

    return () => {
      disposed = true;
      cleanup();
      renderer.dispose();
    };
  }, [dxfText]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "calc(100vh - 60px)" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
