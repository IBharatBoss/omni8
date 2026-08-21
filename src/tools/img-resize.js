// src/tools/img-resize.js
export default {
  id: "img-resize",
  title: "Image Resizer",
  category: "Image",
  icon: "📐",
  accept: ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/avif"],
  keywords: ["resize", "scale", "dimensions", "width", "height", "pixels", "photo"],
  description: "Accurately scale image dimensions by percentage or target width/height with smooth bicubic interpolation.",
  
  options: [
    {
      id: "scalePercent",
      label: "Scale Percentage",
      type: "range",
      min: 10,
      max: 200,
      step: 5,
      default: 50,
      unit: "%"
    }
  ],

  async execute(file, options, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      onProgress(15);
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        onProgress(40);

        const factor = ((options && options.scalePercent) || 50) / 100;
        const targetWidth = Math.max(1, Math.round((img.naturalWidth || img.width) * factor));
        const targetHeight = Math.max(1, Math.round((img.naturalHeight || img.height) * factor));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        onProgress(80);

        const mimeType = file.type || 'image/png';

        canvas.toBlob((blob) => {
          canvas.width = 1;
          canvas.height = 1;

          if (!blob) return reject(new Error('Resize failed'));
          onProgress(100);

          resolve({
            blob: blob,
            fileName: file.name.replace(/\.[^/.]+$/, "") + `_${targetWidth}x${targetHeight}.` + (file.name.split('.').pop() || 'png'),
            originalSize: file.size,
            processedSize: blob.size
          });
        }, mimeType, 0.92);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image for resizing'));
      };

      img.src = url;
    });
  }
};
