/**
 * ar-primitives.ts
 * Set of rendering functions for various AR parts.
 * Used by proc-ar-generator to create 1000+ filters.
 */

export const LANDMARK = {
  NOSE_TIP: 1,
  NOSE_BRIDGE: 6,
  LEFT_EYE_CENTER: 468,
  RIGHT_EYE_CENTER: 473,
  LEFT_EAR: 234,
  RIGHT_EAR: 454,
  FOREHEAD_TOP: 10,
  CHIN: 152,
  LEFT_CHEEK: 116,
  RIGHT_CHEEK: 345,
  LEFT_EYEBROW: 70,
  RIGHT_EYEBROW: 300,
};

const getPt = (idx: number, landmarks: any, w: number, h: number) => ({
  x: landmarks[idx].x * w,
  y: landmarks[idx].y * h,
});

// ─── Shared Drawing Helpers ──────────────────────────────────────────────────
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

// ─── Primitive Renderers ─────────────────────────────────────────────────────

export const RENDERS: Record<string, (ctx: CanvasRenderingContext2D, landmarks: any, w: number, h: number, opt: any) => void> = {
  // ── Headwear ──
  'halo': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const forehead = getPt(LANDMARK.FOREHEAD_TOP, lm, w, h);
    const leftEar = getPt(LANDMARK.LEFT_EAR, lm, w, h);
    const rightEar = getPt(LANDMARK.RIGHT_EAR, lm, w, h);
    const faceWidth = Math.abs(rightEar.x - leftEar.x);
    const cy = forehead.y - faceWidth * 0.4;
    const rx = faceWidth * 0.45;
    const ry = rx * 0.3;
    const color = opt.color || 'gold';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.ellipse(forehead.x, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  'crown': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const forehead = getPt(LANDMARK.FOREHEAD_TOP, lm, w, h);
    const leftEar = getPt(LANDMARK.LEFT_EAR, lm, w, h);
    const rightEar = getPt(LANDMARK.RIGHT_EAR, lm, w, h);
    const faceW = Math.abs(rightEar.x - leftEar.x);
    const cx = forehead.x;
    const cy = forehead.y;
    const cw = faceW * 0.8;
    const ch = cw * 0.4;
    const color = opt.color || '#FFD700';

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, cy);
    ctx.lineTo(cx - cw / 2, cy - ch);
    ctx.lineTo(cx - cw / 4, cy - ch * 0.6);
    ctx.lineTo(cx, cy - ch * 1.2);
    ctx.lineTo(cx + cw / 4, cy - ch * 0.6);
    ctx.lineTo(cx + cw / 2, cy - ch);
    ctx.lineTo(cx + cw / 2, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  'horns': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const forehead = getPt(LANDMARK.FOREHEAD_TOP, lm, w, h);
    const leftEar = getPt(LANDMARK.LEFT_EAR, lm, w, h);
    const rightEar = getPt(LANDMARK.RIGHT_EAR, lm, w, h);
    const faceW = Math.abs(rightEar.x - leftEar.x);
    const cy = forehead.y;
    const color = opt.color || '#ff0000';

    ctx.save();
    ctx.fillStyle = color;
    // Left Horn
    ctx.beginPath();
    ctx.moveTo(forehead.x - faceW * 0.2, cy);
    ctx.quadraticCurveTo(forehead.x - faceW * 0.4, cy - faceW * 0.5, forehead.x - faceW * 0.25, cy - faceW * 0.7);
    ctx.lineTo(forehead.x - faceW * 0.15, cy - faceW * 0.1);
    ctx.fill();
    // Right Horn
    ctx.beginPath();
    ctx.moveTo(forehead.x + faceW * 0.2, cy);
    ctx.quadraticCurveTo(forehead.x + faceW * 0.4, cy - faceW * 0.5, forehead.x + faceW * 0.25, cy - faceW * 0.7);
    ctx.lineTo(forehead.x + faceW * 0.15, cy - faceW * 0.1);
    ctx.fill();
    ctx.restore();
  },
  'cat_ears': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const forehead = getPt(LANDMARK.FOREHEAD_TOP, lm, w, h);
    const leftEar = getPt(LANDMARK.LEFT_EAR, lm, w, h);
    const rightEar = getPt(LANDMARK.RIGHT_EAR, lm, w, h);
    const faceW = Math.abs(rightEar.x - leftEar.x);
    const cy = forehead.y - faceW * 0.15;
    const earSize = faceW * 0.35;
    const color = opt.color || '#333';

    ctx.save();
    ctx.fillStyle = color;
    const drawEar = (x: number) => {
      ctx.beginPath();
      ctx.moveTo(x - earSize / 2, cy);
      ctx.lineTo(x, cy - earSize);
      ctx.lineTo(x + earSize / 2, cy);
      ctx.fill();
    };
    drawEar(forehead.x - faceW * 0.3);
    drawEar(forehead.x + faceW * 0.3);
    ctx.restore();
  },

  // ── Eyewear ──
  'shades': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const leftEar = getPt(LANDMARK.LEFT_EAR, lm, w, h);
    const rightEar = getPt(LANDMARK.RIGHT_EAR, lm, w, h);
    const bridge = getPt(LANDMARK.NOSE_BRIDGE, lm, w, h);
    const faceW = Math.abs(rightEar.x - leftEar.x);
    const glassW = faceW * 1.5;
    const x = bridge.x - glassW / 2;
    const y = bridge.y - faceW * 0.1;
    const lensW = glassW * 0.45;
    const lensH = faceW * 0.45;
    const color = opt.color || 'rgba(0,0,0,0.85)';

    ctx.save();
    ctx.fillStyle = color;
    roundRect(ctx, x, y, lensW, lensH, 10);
    ctx.fill();
    roundRect(ctx, x + glassW * 0.55, y, lensW, lensH, 10);
    ctx.fill();
    ctx.restore();
  },
  'laser_eyes': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const leftE = getPt(LANDMARK.LEFT_EYE_CENTER, lm, w, h);
    const rightE = getPt(LANDMARK.RIGHT_EYE_CENTER, lm, w, h);
    const color = opt.color || '#ff0000';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    const drawLaser = (pt: any) => {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + (Math.random() - 0.5) * 40, h);
      ctx.stroke();
    };
    drawLaser(leftE);
    drawLaser(rightE);
    ctx.restore();
  },
  'monocle': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const rightE = getPt(LANDMARK.RIGHT_EYE_CENTER, lm, w, h);
    const leftE = getPt(LANDMARK.LEFT_EYE_CENTER, lm, w, h);
    const faceW = Math.abs(rightE.x - leftE.x);
    const r = faceW * 0.4;

    ctx.save();
    ctx.strokeStyle = opt.color || '#8B4513';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(rightE.x, rightE.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // ── Facial ──
  'moustache': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const nose = getPt(LANDMARK.NOSE_TIP, lm, w, h);
    const leftC = getPt(LANDMARK.LEFT_CHEEK, lm, w, h);
    const rightC = getPt(LANDMARK.RIGHT_CHEEK, lm, w, h);
    const faceW = Math.abs(rightC.x - leftC.x);
    const mSize = faceW * 0.5;
    const color = opt.color || '#000';

    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${mSize}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('👨‍🦱', nose.x, nose.y + mSize * 0.3); // Juggad: used emoji or we can draw arc
    ctx.restore();
  },
  'beard': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const chin = getPt(LANDMARK.CHIN, lm, w, h);
    const leftC = getPt(LANDMARK.LEFT_CHEEK, lm, w, h);
    const rightC = getPt(LANDMARK.RIGHT_CHEEK, lm, w, h);
    const faceW = Math.abs(rightC.x - leftC.x);
    const color = opt.color || 'rgba(0,0,0,0.6)';

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(leftC.x, leftC.y);
    ctx.quadraticCurveTo(chin.x, chin.y + faceW * 0.4, rightC.x, rightC.y);
    ctx.lineTo(rightC.x, rightC.y - faceW * 0.2);
    ctx.quadraticCurveTo(chin.x, chin.y + faceW * 0.1, leftC.x, leftC.y - faceW * 0.2);
    ctx.fill();
    ctx.restore();
  },
  'venom_mask': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    // Use a small set of landmarks to outline the face
    const borderPoints = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
    borderPoints.forEach((idx, i) => {
      const p = getPt(idx, lm, w, h);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = 'white';
    const leftE = getPt(LANDMARK.LEFT_EYE_CENTER, lm, w, h);
    const rightE = getPt(LANDMARK.RIGHT_EYE_CENTER, lm, w, h);
    ctx.beginPath(); ctx.ellipse(leftE.x, leftE.y, 40, 20, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(rightE.x, rightE.y, 40, 20, -0.4, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  },

  // ── High-Quality Snapchat Style Overlays ──
  'dog_filter': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const nose = getPt(LANDMARK.NOSE_TIP, lm, w, h);
    const forehead = getPt(LANDMARK.FOREHEAD_TOP, lm, w, h);
    const leftEar = getPt(LANDMARK.LEFT_EAR, lm, w, h);
    const rightEar = getPt(LANDMARK.RIGHT_EAR, lm, w, h);
    const faceW = Math.abs(rightEar.x - leftEar.x);

    const img = new Image();
    img.src = '/ar/dog.png';
    if (!img.complete) return; // Wait for next frame if not loaded

    ctx.save();
    // Draw Ears
    const earW = faceW * 1.8;
    const earH = earW * 0.6;
    ctx.drawImage(img, forehead.x - earW / 2, forehead.y - earH / 1.5, earW, earH);
    ctx.restore();
  },

  'flower_crown': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const forehead = getPt(LANDMARK.FOREHEAD_TOP, lm, w, h);
    const leftEar = getPt(LANDMARK.LEFT_EAR, lm, w, h);
    const rightEar = getPt(LANDMARK.RIGHT_EAR, lm, w, h);
    const faceW = Math.abs(rightEar.x - leftEar.x);

    const img = new Image();
    img.src = '/ar/flowers.png';
    if (!img.complete) return;

    ctx.save();
    const crownW = faceW * 1.3;
    const crownH = crownW * 0.4;
    ctx.drawImage(img, forehead.x - crownW / 2, forehead.y - crownH, crownW, crownH);
    ctx.restore();
  },

  'retro_glasses': (ctx, lm, w, h, opt) => {
    if (!lm) return;
    const bridge = getPt(LANDMARK.NOSE_BRIDGE, lm, w, h);
    const leftEar = getPt(LANDMARK.LEFT_EAR, lm, w, h);
    const rightEar = getPt(LANDMARK.RIGHT_EAR, lm, w, h);
    const faceW = Math.abs(rightEar.x - leftEar.x);

    const img = new Image();
    img.src = '/ar/glasses.png';
    if (!img.complete) return;

    ctx.save();
    const gW = faceW * 1.2;
    const gH = gW * 0.45;
    ctx.drawImage(img, bridge.x - gW / 2, bridge.y - gH / 2, gW, gH);
    ctx.restore();
  },

  // ── Overlay / Emoji ──
  'emoji_sticker': (ctx, lm, w, h, opt) => {
    let pt: any;
    if (lm) {
        pt = getPt(LANDMARK[opt.point as keyof typeof LANDMARK || 'NOSE_TIP'], lm, w, h);
    } else {
        // Fallback to center if face missing but filter active
        pt = { x: w / 2, y: h / 2 - h * 0.2 };
    }
    const faceW = lm ? Math.abs(getPt(LANDMARK.RIGHT_EAR, lm, w, h).x - getPt(LANDMARK.LEFT_EAR, lm, w, h).x) : w * 0.3;
    const size = faceW * (opt.scale || 0.5);

    ctx.save();
    ctx.font = `${size}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(opt.emoji || '🔥', pt.x + (opt.ox || 0) * faceW, pt.y + (opt.oy || 0) * faceW);
    ctx.restore();
  },
  
  // ── Environmental ──
  'snow': (ctx, lm, w, h, opt) => {
    const now = Date.now() / 1000;
    ctx.save();
    ctx.fillStyle = 'white';
    for (let i = 0; i < (opt.count || 50); i++) {
        const x = (i * 137.5 + now * 20) % w;
        const y = (now * 100 + i * 40) % h;
        ctx.beginPath(); ctx.arc(x, y, 2 + (i%3), 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  },
  'matrix': (ctx, lm, w, h, opt) => {
    const now = Date.now() / 50;
    ctx.save();
    ctx.fillStyle = '#0f0';
    ctx.font = '10px monospace';
    for (let i = 0; i < 30; i++) {
        const x = (i * 40) % w;
        const y = (now + i * 100) % h;
        ctx.fillText(Math.random().toString(36).substr(2, 1), x, y);
    }
    ctx.restore();
  },
  'rain': (ctx, lm, w, h, opt) => {
    const now = Date.now() / 1000;
    ctx.save();
    ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 100; i++) {
        const x = (i * 17) % w;
        const y = (now * 800 + i * 20) % h;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10); ctx.stroke();
    }
    ctx.restore();
  },
  'fire': (ctx, lm, w, h, opt) => {
    const now = Date.now() / 100;
    ctx.save();
    for (let i = 0; i < 20; i++) {
        const x = (i * (w/20));
        const fh = 40 + Math.sin(i + now) * 30;
        const grad = ctx.createLinearGradient(x, h, x, h - fh);
        grad.addColorStop(0, 'red');
        grad.addColorStop(0.5, 'orange');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x, h - fh, w/20, fh);
    }
    ctx.restore();
  },
  'fire_frame': (ctx, lm, w, h, opt) => {
    const now = Date.now() / 100;
    ctx.save();
    for (let x = 0; x < w; x += 40) {
        const fh = 40 + Math.sin(x + now) * 20;
        ctx.fillStyle = `orange`;
        ctx.fillRect(x, h - fh, 40, fh);
    }
    ctx.restore();
  }
};
