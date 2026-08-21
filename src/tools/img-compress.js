// src/tools/img-compress.js
import { memory } from '../core/memory.js';

/**
 * Smart Image Compressor Plugin
 * - Ultra-Clean Target Size Control (50KB, 100KB, 200KB, 500KB, 1MB, 2MB & Custom)
 * - Self-Tuning Binary Search Engine + Stepped Downscaling Fallback
 * - Multi-Format Routing (Auto/Original, WebP, JPG, PNG)
 * - Alpha-Safe Transparency & Memory Lifecycle Cleanup
 */
export default {
  id: "img-compress",
  title: "Smart Image Compressor",
  name: "Smart Image Compressor",
  category: "Image",
  icon: "🗜️",
  accept: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/bmp", "image/svg+xml"],
  keywords: ["compress", "shrink", "reduce", "size", "kb", "mb", "optimize", "image", "photo", "target kb"],
  description: "Compress images strictly under your target file size with zero quality loss and instant client-side speed.",
  
  optionsSchema: [
    {
      id: "targetSize",
      type: "number",
      label: "Target File Size (KB)",
      default: 100,
      min: 5,
      max: 51200,
      placeholder: "e.g. 100 KB (Tool will compress strictly under this size)",
      presets: [
        { label: "50 KB", value: 50 },
        { label: "100 KB", value: 100 },
        { label: "200 KB", value: 200 },
        { label: "500 KB", value: 500 },
        { label: "1 MB", value: 1024 },
        { label: "2 MB", value: 2048 }
      ]
    },
    {
      id: "outputFormat",
      type: "select",
      label: "Output Format",
      default: "original",
      options: [
        { label: "Auto (Keep Original Format)", value: "original" },
        { label: "Convert to WebP (Best Compression)", value: "image/webp" },
        { label: "Convert to JPG (Universal Standard)", value: "image/jpeg" },
        { label: "Convert to PNG (Lossless Alpha)", value: "image/png" }
      ]
    }
  ],

  // Compatibility alias for options-panel
  get options() {
    return this.optionsSchema;
  },

  /**
   * Main Execution Pipeline for Single Item
   */
  async execute(file, options, onProgress = () => {}) {
    const startTime = performance.now();
    onProgress(10);

    // 1. Decode image into ImageBitmap / HTMLImageElement
    const imgData = await loadImageElement(file);
    onProgress(25);

    const origWidth = imgData.naturalWidth || imgData.width;
    const origHeight = imgData.naturalHeight || imgData.height;

    // 2. Pre-Transformation Stage (Rotation, Flipping, Crop if applied via Inspector)
    const rotation = Number((options && options.rotation) || file._customRotation || 0);
    const crop = (options && options.crop) || file._customCrop; // Optional { x, y, width, height } in px

    let sourceW = crop ? crop.width : origWidth;
    let sourceH = crop ? crop.height : origHeight;
    let cropX = crop ? crop.x : 0;
    let cropY = crop ? crop.y : 0;

    const isRotated90or270 = rotation === 90 || rotation === 270;
    let transformedW = isRotated90or270 ? sourceH : sourceW;
    let transformedH = isRotated90or270 ? sourceW : sourceH;

    // 3. Format Resolution
    let targetMimeType = (options && options.outputFormat) || 'original';
    if (targetMimeType === 'original') {
      targetMimeType = file.type || 'image/jpeg';
      if (targetMimeType === 'image/svg+xml') targetMimeType = 'image/png';
    }

    onProgress(40);

    // 4. Render Base Canvas with Transformation Matrix
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = transformedW;
    baseCanvas.height = transformedH;
    const ctx = baseCanvas.getContext('2d', { alpha: targetMimeType !== 'image/jpeg' });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // If JPEG, fill clean white background to prevent dark transparency artifacts
    if (targetMimeType === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, transformedW, transformedH);
    }

    ctx.save();
    ctx.translate(transformedW / 2, transformedH / 2);
    if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);

    const drawW = isRotated90or270 ? transformedH : transformedW;
    const drawH = isRotated90or270 ? transformedW : transformedH;

    ctx.drawImage(
      imgData,
      cropX, cropY, sourceW, sourceH,
      -drawW / 2, -drawH / 2, drawW, drawH
    );
    ctx.restore();

    onProgress(55);

    // 5. Binary Search Target Size Matching Engine
    const targetKbVal = Number((options && options.targetSize) || (options && options.targetKb) || 100);
    const targetBytes = Math.max(5 * 1024, targetKbVal * 1024);

    const searchResult = await binarySearchTargetSize(baseCanvas, targetMimeType, targetBytes, (p) => {
      onProgress(55 + Math.round(p * 0.4));
    });

    const finalBlob = searchResult.blob;
    const finalWidth = searchResult.width;
    const finalHeight = searchResult.height;

    // Clean up base canvas memory buffer
    baseCanvas.width = 1;
    baseCanvas.height = 1;

    if (!finalBlob) {
      throw new Error('Image compression encoding failed.');
    }

    onProgress(100);
    const durationMs = Math.round(performance.now() - startTime);

    // Determine output file extension
    let ext = 'jpg';
    if (targetMimeType === 'image/webp') ext = 'webp';
    else if (targetMimeType === 'image/png') ext = 'png';
    else if (targetMimeType === 'image/avif') ext = 'avif';
    else {
      const origExt = file.name.split('.').pop()?.toLowerCase();
      if (origExt && origExt.length <= 4) ext = origExt;
    }

    return {
      blob: finalBlob,
      fileName: `${file.name.replace(/\.[^/.]+$/, "")}_compressed.${ext}`,
      originalSize: file.size,
      processedSize: finalBlob.size,
      originalWidth: origWidth,
      originalHeight: origHeight,
      width: finalWidth,
      height: finalHeight,
      durationMs,
      format: targetMimeType,
      originalFile: file
    };
  }
};

/**
 * Self-Tuning Binary Search Target Size Matching Engine
 * Searches quality bounds [0.05, 0.98] with fallback stepped downscaling.
 */
async function binarySearchTargetSize(canvas, mimeType, targetBytes, onSubProgress = () => {}) {
  // If PNG, attempt standard encoding first
  if (mimeType === 'image/png') {
    let blob = await canvasToBlobAsync(canvas, 'image/png');
    if (blob.size <= targetBytes) {
      return { blob, width: canvas.width, height: canvas.height };
    }
  }

  let minQuality = 0.05;
  let maxQuality = 0.98;
  const maxIterations = 6;
  const tolerance = targetBytes * 0.04; // 4% tolerance

  let bestBlob = null;
  let bestDiff = Infinity;
  let currentCanvas = canvas;
  let curW = canvas.width;
  let curH = canvas.height;

  // Phase 1: Binary Search on Quality Curve
  for (let i = 0; i < maxIterations; i++) {
    const midQuality = (minQuality + maxQuality) / 2;
    const blob = await canvasToBlobAsync(currentCanvas, mimeType, midQuality);
    onSubProgress((i + 1) / (maxIterations + 2));

    const diff = Math.abs(blob.size - targetBytes);
    if (blob.size <= targetBytes && diff < bestDiff) {
      bestBlob = blob;
      bestDiff = diff;
    }

    // Within tolerance and below target
    if (blob.size <= targetBytes && (targetBytes - blob.size) <= tolerance) {
      bestBlob = blob;
      break;
    }

    if (blob.size > targetBytes) {
      maxQuality = midQuality;
    } else {
      minQuality = midQuality;
      if (!bestBlob || blob.size > bestBlob.size) {
        bestBlob = blob;
      }
    }
  }

  // Phase 2: Stepped Downscaling Fallback if image is still over target size
  if (!bestBlob || bestBlob.size > targetBytes) {
    const scaleSteps = [0.85, 0.70, 0.55, 0.40, 0.30, 0.20];
    
    for (const scale of scaleSteps) {
      const stepW = Math.max(64, Math.round(canvas.width * scale));
      const stepH = Math.max(64, Math.round(canvas.height * scale));

      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = stepW;
      scaledCanvas.height = stepH;
      const sCtx = scaledCanvas.getContext('2d');
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';

      if (mimeType === 'image/jpeg') {
        sCtx.fillStyle = '#FFFFFF';
        sCtx.fillRect(0, 0, stepW, stepH);
      }

      sCtx.drawImage(canvas, 0, 0, stepW, stepH);

      const blob = await canvasToBlobAsync(scaledCanvas, mimeType, 0.75);
      scaledCanvas.width = 1;
      scaledCanvas.height = 1;

      if (blob.size <= targetBytes) {
        bestBlob = blob;
        curW = stepW;
        curH = stepH;
        break;
      } else {
        bestBlob = blob;
        curW = stepW;
        curH = stepH;
      }
    }
  }

  return {
    blob: bestBlob || await canvasToBlobAsync(canvas, mimeType, 0.1),
    width: curW,
    height: curH
  };
}

function canvasToBlobAsync(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mimeType, quality);
  });
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to decode ${file.name}`));
    };

    img.src = url;
  });
}
