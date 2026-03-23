/**
 * AR Engine - ConnectSphere
 * Snapchat-style face filters using MediaPipe Face Landmarker (loaded from CDN at runtime)
 * + Canvas 2D composite for overlays. Three.js available for heavy 3D if needed.
 *
 * Architecture:
 *   Raw Camera Stream → Hidden <video> → AnimationFrame Loop → Canvas Processing
 *   → Canvas.captureStream() → Processed MediaStream → WebRTC PeerConnection
 *
 * All MediaPipe models are fetched from Google's CDN (not bundled), so no Cloudflare size issues.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
import { RENDERS, LANDMARK } from './ar-primitives';
import { getFilterById } from './proc-ar-generator';

export type ARFilterId = string; // Supports 'none', 'beauty', 'blur_bg', and 'filter-0'...'filter-999'

export interface ARFilter {
  id: ARFilterId;
  name: string;
  emoji: string;
  description: string;
}

// ─── MediaPipe Dynamic Loader ─────────────────────────────────────────────────
let faceLandmarker: any = null;
let isLoaderActive: boolean = false;

async function loadMediaPipe(): Promise<any> {
  if (faceLandmarker) return faceLandmarker;
  
  // Use a promise to prevent multiple concurrent loads
  if (isLoaderActive) {
    while (isLoaderActive) {
      await new Promise(r => setTimeout(r, 100));
      if (faceLandmarker) return faceLandmarker;
    }
    return faceLandmarker;
  }

  isLoaderActive = true;
  try {
    let FaceLandmarker: any;
    let FilesetResolver: any;

    try {
      // Use webpackIgnore: true to prevent Next.js from trying to bundle the URL at build time
      // This is CRITICAL for Cloudflare/Vercel builds to pass
      // @ts-ignore - Dynamic URL import
      const mpVision = await import(/* webpackIgnore: true */ 'https://esm.sh/@mediapipe/tasks-vision@0.10.3');
      FaceLandmarker = mpVision.FaceLandmarker;
      FilesetResolver = mpVision.FilesetResolver;
    } catch (e) {
      console.warn("[AREngine] ESM import failed, trying script tag fallback...", e);
      // Fallback: If dynamic import fails, try to load via script tag
      await new Promise((resolve, reject) => {
        if ((window as any).FaceLandmarker) return resolve(true);
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.js";
        script.onload = () => resolve(true);
        script.onerror = reject;
        document.head.appendChild(script);
      });
      FaceLandmarker = (window as any).FaceLandmarker;
      FilesetResolver = (window as any).FilesetResolver;
    }

    if (!FaceLandmarker || !FilesetResolver) {
        throw new Error("MediaPipe components not found in window or module");
    }

    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });

    return faceLandmarker;
  } catch (err) {
    console.error("[AREngine] Could not load MediaPipe from ESM:", err);
    throw err;
  } finally {
    isLoaderActive = false;
  }
}

// ─── AR Engine Class ──────────────────────────────────────────────────────────
export class AREngine {
  private videoEl: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private processedStream: MediaStream;
  private animFrame: number = 0;
  private activeFilter: ARFilterId = 'none';
  private isRunning: boolean = false;
  private rawStream: MediaStream;

  constructor(rawStream: MediaStream) {
    this.rawStream = rawStream;

    this.videoEl = document.createElement('video');
    this.videoEl.srcObject = rawStream;
    this.videoEl.autoplay = true;
    this.videoEl.playsInline = true;
    this.videoEl.muted = true;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

    this.processedStream = this.canvas.captureStream(30);

    rawStream.getAudioTracks().forEach((track) => {
      this.processedStream.addTrack(track);
    });
  }

  getProcessedStream(): MediaStream {
    return this.processedStream;
  }

  setFilter(filterId: ARFilterId) {
    this.activeFilter = filterId;
  }

  async start() {
    await this.videoEl.play();
    this.isRunning = true;
    loadMediaPipe().catch(() => {});
    this.loop();
  }

  stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animFrame);
    this.rawStream.getTracks().forEach((t) => t.stop());
  }

  private async loop() {
    if (!this.isRunning) return;

    const { videoWidth: vw, videoHeight: vh } = this.videoEl;
    if (vw > 0 && vh > 0) {
      if (this.canvas.width !== vw || this.canvas.height !== vh) {
        this.canvas.width = vw;
        this.canvas.height = vh;
      }

      this.ctx.drawImage(this.videoEl, 0, 0, vw, vh);
      await this.applyFilter(vw, vh);
    }

    this.animFrame = requestAnimationFrame(() => this.loop());
  }

  private async applyFilter(w: number, h: number) {
    const filterId = this.activeFilter;
    if (filterId === 'none') return;

    // Special built-in filters
    if (filterId === 'beauty') {
        this.applyBeauty(w, h);
        return;
    }
    if (filterId === 'blur_bg') {
        this.applyBlurBg(w, h);
        return;
    }

    // Procedural AR Filters
    const recipe = getFilterById(filterId);
    if (!recipe) return;

    let landmarks: any = null;
    try {
      const mp = await loadMediaPipe();
      if (mp) {
        // Use video timestamp for better sync
        const results = mp.detectForVideo(this.videoEl, this.videoEl.currentTime * 1000);
        if (results?.faceLandmarks?.[0]) {
          landmarks = results.faceLandmarks[0];
          
          if (Math.random() < 0.01) {
            console.log("[AREngine] 🎯 Face detected with 478 landmarks");
          }
        } else {
          if (Math.random() < 0.01) {
            console.warn("[AREngine] ⚠️ No face detected in frame");
          }
        }
      } else {
        if (Math.random() < 0.01) {
          console.warn("[AREngine] ⏳ Loading MediaPipe...");
        }
      }
    } catch (e) {
      console.error("[AREngine] Detection failed:", e);
    }

    // Render each component in the recipe
    recipe.components.forEach(compKey => {
        const renderer = RENDERS[compKey];
        if (renderer) {
            renderer(this.ctx, landmarks, w, h, recipe.options || {});
        }
    });
  }

  private applyBeauty(w: number, h: number) {
    this.ctx.save();
    // Premium "Beauty" - Surface blur style using multiple layers
    this.ctx.globalAlpha = 0.4;
    this.ctx.filter = 'blur(4px) saturate(1.1) brightness(1.05)';
    this.ctx.drawImage(this.videoEl, 0, 0, w, h);
    this.ctx.globalAlpha = 1.0;
    this.ctx.filter = 'contrast(1.05)';
    // Masking the beauty to face area would be better, but for now global "glow" is premium
    this.ctx.restore();
  }

  private applyBlurBg(w: number, h: number) {
    this.ctx.save();
    this.ctx.filter = 'blur(20px) saturate(0.8)';
    this.ctx.drawImage(this.videoEl, 0, 0, w, h);
    this.ctx.filter = 'none';
    
    // Smooth transition for background blur
    this.ctx.beginPath();
    this.ctx.ellipse(w / 2, h / 2, w * 0.3, h * 0.45, 0, 0, Math.PI * 2);
    this.ctx.clip();
    this.ctx.drawImage(this.videoEl, 0, 0, w, h);
    this.ctx.restore();
  }
  // Helper: Rounded rectangle path
  private roundRect(x: number, y: number, width: number, height: number, radius: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }
}
