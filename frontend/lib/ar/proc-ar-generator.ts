/**
 * proc-ar-generator.ts
 * Procedural generation for 1000+ AR filter recipes.
 */

import { ARCategory, ARRecipe } from './filter-types';

const CATEGORIES: ARCategory[] = ['headwear', 'eyewear', 'facial', 'environment', 'distort', 'legendary'];

const HEADWEAR_OPTS = ['halo', 'crown', 'horns', 'cat_ears', 'top_hat', 'none'];
const EYEWEAR_OPTS = ['shades', 'laser_eyes', 'monocle', 'cyber_goggles', 'none'];
const FACIAL_OPTS = ['moustache', 'beard', 'blush', 'mask', 'none'];
const ENV_OPTS = ['snow', 'fire', 'rain', 'matrix', 'none'];
const EMOJIS = ['🔥', '✨', '💎', '💀', '👽', '🤡', '🌈', '🌪️', '❄️', '🌋', '🍀', '🍎', '🍔', '🍺', '🎮', '💡', '❤️', '💔', '⚡', '💣'];

export function generateAllFilters(): ARRecipe[] {
  const filters: ARRecipe[] = [];

  // Generate 1000+ filters deterministically
  for (let i = 0; i < 1050; i++) {
    const headIdx = i % HEADWEAR_OPTS.length;
    const eyeIdx = Math.floor(i / HEADWEAR_OPTS.length) % EYEWEAR_OPTS.length;
    const facialIdx = Math.floor(i / (HEADWEAR_OPTS.length * EYEWEAR_OPTS.length)) % FACIAL_OPTS.length;
    const envIdx = Math.floor(i / (HEADWEAR_OPTS.length * EYEWEAR_OPTS.length * FACIAL_OPTS.length)) % ENV_OPTS.length;
    
    // Choose emoji sticker
    const emojiIdx = i % EMOJIS.length;

    const components: string[] = [];
    if (HEADWEAR_OPTS[headIdx] !== 'none') components.push(HEADWEAR_OPTS[headIdx]);
    if (EYEWEAR_OPTS[eyeIdx] !== 'none') components.push(EYEWEAR_OPTS[eyeIdx]);
    if (FACIAL_OPTS[facialIdx] !== 'none') components.push(FACIAL_OPTS[facialIdx]);
    if (ENV_OPTS[envIdx] !== 'none') components.push(ENV_OPTS[envIdx]);

    // Add a random emoji sticker for extra variety
    components.push('emoji_sticker');

    filters.push({
      id: `filter-${i}`,
      name: `AR Effect #${i + 1}`,
      emoji: EMOJIS[emojiIdx],
      category: CATEGORIES[i % CATEGORIES.length],
      components,
      options: {
        emoji: EMOJIS[emojiIdx],
        point: i % 2 === 0 ? 'aboveHead' : 'noseTip',
        scale: 0.3 + (i % 5) * 0.1,
        color: `hsl(${i % 360}, 70%, 50%)`,
      }
    });
  }

  return filters;
}

export function getFilterById(id: string): ARRecipe | undefined {
    // We can just find it or regenerate it on the fly for better memory
    const index = parseInt(id.replace('filter-', ''));
    if (isNaN(index)) return undefined;
    
    // Regenerate just this one
    const headIdx = index % HEADWEAR_OPTS.length;
    const eyeIdx = Math.floor(index / HEADWEAR_OPTS.length) % EYEWEAR_OPTS.length;
    const facialIdx = Math.floor(index / (HEADWEAR_OPTS.length * EYEWEAR_OPTS.length)) % FACIAL_OPTS.length;
    const envIdx = Math.floor(index / (HEADWEAR_OPTS.length * EYEWEAR_OPTS.length * FACIAL_OPTS.length)) % ENV_OPTS.length;
    const emojiIdx = index % EMOJIS.length;

    const components: string[] = [];
    if (HEADWEAR_OPTS[headIdx] !== 'none') components.push(HEADWEAR_OPTS[headIdx]);
    if (EYEWEAR_OPTS[eyeIdx] !== 'none') components.push(EYEWEAR_OPTS[eyeIdx]);
    if (FACIAL_OPTS[facialIdx] !== 'none') components.push(FACIAL_OPTS[facialIdx]);
    if (ENV_OPTS[envIdx] !== 'none') components.push(ENV_OPTS[envIdx]);
    components.push('emoji_sticker');

    return {
      id: `filter-${index}`,
      name: `AR Effect #${index + 1}`,
      emoji: EMOJIS[emojiIdx],
      category: CATEGORIES[index % CATEGORIES.length],
      components,
      options: {
        emoji: EMOJIS[emojiIdx],
        point: index % 2 === 0 ? 'aboveHead' : 'noseTip',
        scale: 0.4,
        color: `hsl(${index % 360}, 70%, 50%)`,
      }
    };
}
