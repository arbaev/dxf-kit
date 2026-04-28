import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { TAARenderPass } from "three/addons/postprocessing/TAARenderPass.js";
import { SSAARenderPass } from "three/addons/postprocessing/SSAARenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export type AntialiasingMode = "none" | "msaa" | "smaa" | "fxaa" | "taa" | "ssaa";

export interface CreateRendererOptions {
  aaMode?: AntialiasingMode;
  alpha?: boolean;
  preserveDrawingBuffer?: boolean;
}

/**
 * Create a Three.js WebGLRenderer with the antialias flag set per AA mode.
 * MSAA uses native hardware multisampling (antialias: true); other modes
 * apply post-processing via createComposer() and use antialias: false.
 */
export function createRenderer(opts: CreateRendererOptions = {}): THREE.WebGLRenderer {
  const { aaMode = "msaa", alpha = true, preserveDrawingBuffer = true } = opts;
  const renderer = new THREE.WebGLRenderer({
    antialias: aaMode === "msaa",
    alpha,
    preserveDrawingBuffer,
  });
  renderer.sortObjects = false;
  return renderer;
}

export interface CreateComposerOptions {
  aaMode: AntialiasingMode;
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
}

export interface AntialiasingPipeline {
  /** EffectComposer for post-processing AA modes; null for msaa/none (render direct). */
  composer: EffectComposer | null;
  /** Reference to TAARenderPass when aaMode === "taa", for accumulation control. */
  taaPass: (TAARenderPass & { accumulateIndex: number }) | null;
}

/**
 * Build the post-processing pipeline for the given AA mode.
 * Returns { composer: null, taaPass: null } for msaa/none — caller should
 * call renderer.render(scene, camera) directly. For other modes, returns a
 * configured EffectComposer to be invoked via composer.render().
 */
export function createComposer(opts: CreateComposerOptions): AntialiasingPipeline {
  const { aaMode, scene, camera, renderer } = opts;

  if (aaMode === "msaa" || aaMode === "none") {
    return { composer: null, taaPass: null };
  }

  const composer = new EffectComposer(renderer);
  let taaPass: AntialiasingPipeline["taaPass"] = null;

  if (aaMode === "taa") {
    const pass = new TAARenderPass(scene, camera) as TAARenderPass & {
      accumulateIndex: number;
    };
    pass.accumulate = true;
    composer.addPass(pass);
    taaPass = pass;
  } else if (aaMode === "ssaa") {
    composer.addPass(new SSAARenderPass(scene, camera));
  } else if (aaMode === "smaa") {
    composer.addPass(new RenderPass(scene, camera));
    const smaa = new SMAAPass();
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pixelRatio = renderer.getPixelRatio();
    smaa.setSize(size.x * pixelRatio, size.y * pixelRatio);
    composer.addPass(smaa);
  } else if (aaMode === "fxaa") {
    composer.addPass(new RenderPass(scene, camera));
    const fxaa = new FXAAPass();
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pixelRatio = renderer.getPixelRatio();
    fxaa.setSize(size.x * pixelRatio, size.y * pixelRatio);
    composer.addPass(fxaa);
  }

  // OutputPass converts from linear to sRGB color space for correct color display
  composer.addPass(new OutputPass());
  return { composer, taaPass };
}

/**
 * Returns true if the user has enabled "reduce motion" in their OS.
 * Use this to skip animations like TAA jitter accumulation.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
