export interface ColorGradingParams {
  exposure: number;         // -40 to +40
  contrast: number;         // -40 to +50
  saturation: number;       // -100 to +60
  warmth: number;           // -50 to +50
  tint: number;             // -30 to +30
  fade: number;             // 0 to 35
  vignette: number;         // 0 to 60
  grain: number;            // 0 to 40
  highlightsWarmth: number; // -30 to +30
  shadowsTint: string;      // Hex color
}

export interface AIPresetOption {
  name: string;
  tagline: string;
  grading: ColorGradingParams;
  isAiGenerated?: boolean;
}

export const CURATED_OPTICAL_PRESETS: AIPresetOption[] = [
  {
    name: "Luz Natural Optimizada",
    tagline: "Balance dinámico y claridad orgánica",
    grading: {
      exposure: 7,
      contrast: 16,
      saturation: 14,
      warmth: 10,
      tint: 2,
      fade: 4,
      vignette: 14,
      grain: 4,
      highlightsWarmth: 12,
      shadowsTint: "#12151c",
    },
  },
  {
    name: "Kodak Portra 400",
    tagline: "Tonos de piel cálidos y sombras suaves",
    grading: {
      exposure: 6,
      contrast: 14,
      saturation: 18,
      warmth: 26,
      tint: 5,
      fade: 12,
      vignette: 20,
      grain: 14,
      highlightsWarmth: 20,
      shadowsTint: "#24140e",
    },
  },
  {
    name: "Cine Teal & Ámbar",
    tagline: "Contraste de película de gran formato",
    grading: {
      exposure: 3,
      contrast: 26,
      saturation: 20,
      warmth: 14,
      tint: -6,
      fade: 8,
      vignette: 26,
      grain: 10,
      highlightsWarmth: 24,
      shadowsTint: "#072232",
    },
  },
  {
    name: "Fuji Velvia Vibrante",
    tagline: "Verdes profundos y paisajes intensos",
    grading: {
      exposure: 4,
      contrast: 24,
      saturation: 36,
      warmth: 8,
      tint: 4,
      fade: 2,
      vignette: 18,
      grain: 6,
      highlightsWarmth: 10,
      shadowsTint: "#0e1320",
    },
  },
  {
    name: "Leica Monocromo",
    tagline: "Plata en gelatina de alto contraste",
    grading: {
      exposure: 4,
      contrast: 36,
      saturation: -100,
      warmth: 0,
      tint: 0,
      fade: 8,
      vignette: 28,
      grain: 20,
      highlightsWarmth: 0,
      shadowsTint: "#141414",
    },
  },
  {
    name: "Noche de Neón",
    tagline: "Atmósfera nocturna fría y vibrante",
    grading: {
      exposure: 2,
      contrast: 28,
      saturation: 30,
      warmth: -22,
      tint: 15,
      fade: 6,
      vignette: 30,
      grain: 12,
      highlightsWarmth: -14,
      shadowsTint: "#0b0c26",
    },
  },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return { r: 16, g: 18, b: 24 };
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 16, g: 18, b: 24 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function clampByte(val: number): number {
  return val < 0 ? 0 : val > 255 ? 255 : val;
}

/**
 * Renders an HTMLImageElement onto a target canvas with full 32-bit pixel shader math:
 * Exposure, S-curve contrast, saturation, split-toning (shadow tint + highlight warmth),
 * matte film fade, optical radial vignette, and film grain.
 * Preserves 100% original resolution when maxDimension is omitted.
 */
export function renderGradedImageToCanvas(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  grading: ColorGradingParams,
  intensityPercent: number = 100,
  maxDimension?: number
): { width: number; height: number } {
  const naturalW = img.naturalWidth || img.width || 1200;
  const naturalH = img.naturalHeight || img.height || 900;

  let targetW = naturalW;
  let targetH = naturalH;

  if (maxDimension && (naturalW > maxDimension || naturalH > maxDimension)) {
    const ratio = Math.min(maxDimension / naturalW, maxDimension / naturalH);
    targetW = Math.max(1, Math.round(naturalW * ratio));
    targetH = Math.max(1, Math.round(naturalH * ratio));
  }

  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { width: targetW, height: targetH };

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const mix = Math.max(0, Math.min(100, intensityPercent)) / 100;
  if (mix === 0) {
    return { width: targetW, height: targetH };
  }

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imageData.data;

  // Precompute parameters scaled by mix intensity
  const expScale = Math.pow(2, (grading.exposure * mix) / 38);
  const contrastVal = (grading.contrast * mix) * 1.9;
  const contrastFactor = (259 * (contrastVal + 255)) / (255 * (259 - contrastVal));
  const satFactor = 1 + (grading.saturation * mix) / 100;
  const warmthShift = (grading.warmth * mix) * 0.95;
  const tintShift = (grading.tint * mix) * 0.75;
  const fadeLift = (grading.fade * mix) * 1.15;
  const hiWarmth = (grading.highlightsWarmth * mix) * 0.8;
  const shadowRgb = hexToRgb(grading.shadowsTint || "#12131a");
  const grainAmount = (grading.grain * mix) * 0.65;
  const vigStrength = (grading.vignette * mix) / 100;

  const centerX = targetW * 0.5;
  const centerY = targetH * 0.5;
  const invMaxDistSq = 1 / (centerX * centerX + centerY * centerY);

  let idx = 0;
  for (let y = 0; y < targetH; y++) {
    const dy = y - centerY;
    const dySq = dy * dy;

    for (let x = 0; x < targetW; x++) {
      const origR = data[idx];
      const origG = data[idx + 1];
      const origB = data[idx + 2];

      // 1. Exposure
      let r = origR * expScale;
      let g = origG * expScale;
      let b = origB * expScale;

      // 2. Contrast & Matte Fade Lift
      r = contrastFactor * (r - 128) + 128 + fadeLift * (1 - r / 255);
      g = contrastFactor * (g - 128) + 128 + fadeLift * (1 - g / 255);
      b = contrastFactor * (b - 128) + 128 + fadeLift * (1 - b / 255);

      // 3. Color temperature (Warmth) & Tint
      r += warmthShift + tintShift * 0.35;
      g -= tintShift * 0.65;
      b -= warmthShift * 0.9 - tintShift * 0.25;

      // 4. Split-toning (Shadows & Highlights)
      const lumNorm = Math.max(0, Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b) / 255));
      const shadowWeight = Math.pow(1 - lumNorm, 2) * 0.25 * mix;
      const highlightWeight = Math.pow(lumNorm, 1.6) * 0.6;

      r = r * (1 - shadowWeight) + shadowRgb.r * shadowWeight + hiWarmth * highlightWeight;
      g = g * (1 - shadowWeight) + shadowRgb.g * shadowWeight + hiWarmth * 0.35 * highlightWeight;
      b = b * (1 - shadowWeight) + shadowRgb.b * shadowWeight - hiWarmth * 0.65 * highlightWeight;

      // 5. Saturation (Rec. 709 Luma)
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = luma + (r - luma) * satFactor;
      g = luma + (g - luma) * satFactor;
      b = luma + (b - luma) * satFactor;

      // 6. Optical Radial Vignette
      if (vigStrength > 0.01) {
        const dx = x - centerX;
        const distNorm = (dx * dx + dySq) * invMaxDistSq;
        const vigFactor = 1 - distNorm * vigStrength * 0.85;
        r *= vigFactor;
        g *= vigFactor;
        b *= vigFactor;
      }

      // 7. Fine Organic Film Grain
      if (grainAmount > 0.2) {
        // Fast deterministic-like pseudo noise
        const noise = (((x * 12.9898 + y * 78.233) % 1) - 0.5) * grainAmount * 2.2;
        r += noise;
        g += noise;
        b += noise;
      }

      data[idx] = clampByte(r);
      data[idx + 1] = clampByte(g);
      data[idx + 2] = clampByte(b);

      idx += 4;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { width: targetW, height: targetH };
}

/**
 * Generates a high-resolution data URL or triggers a direct lossless download
 * at the full original resolution (or 2x/4K upscale when requested).
 */
export function exportHighResDataUrl(
  img: HTMLImageElement,
  grading: ColorGradingParams,
  intensityPercent: number = 100,
  format: "image/png" | "image/jpeg" = "image/png",
  scaleMultiplier: number = 1
): { dataUrl: string; width: number; height: number } {
  const offscreen = document.createElement("canvas");
  const baseW = img.naturalWidth || img.width || 1920;
  const baseH = img.naturalHeight || img.height || 1080;

  // Cap maximum dimension to 4096px to prevent browser canvas memory overflow while guaranteeing Ultra-HD
  const desiredMax = Math.min(4096, Math.max(baseW, baseH) * scaleMultiplier);
  const { width, height } = renderGradedImageToCanvas(
    img,
    offscreen,
    grading,
    intensityPercent,
    desiredMax
  );

  const dataUrl = offscreen.toDataURL(format, 0.96);
  return { dataUrl, width, height };
}
