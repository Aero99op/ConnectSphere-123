/**
 * filter-types.ts
 * Core types for the 1000+ AR Filter System in ConnectSphere.
 */

export type ARCategory =
  | 'headwear'     // Hats, crowns, horns, halos
  | 'eyewear'      // Glasses, goggles, monocles, eye-glow
  | 'facial'       // Masks, moustaches, beards, face-paint
  | 'environment'  // Weather, particles, frame overlays
  | 'distort'     // Face distortions, glitch
  | 'legendary';   // Full epic sets (Snapchat-style)

export type Point = { x: number; y: number };

export interface ARComponent {
  type: 'sticker' | 'shape' | 'particle' | 'shader' | 'canvas';
  id: string;
  name: string;
  emoji?: string;
  assetUrl?: string; // For later 3D/Image support
  render: (ctx: CanvasRenderingContext2D, landmarks: any, w: number, h: number, options: any) => void;
}

export interface ARRecipe {
  id: string;
  name: string;
  emoji: string;
  category: ARCategory;
  components: string[]; // List of component IDs to layer
  options?: Record<string, any>;
}
