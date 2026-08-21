// src/tools/svg-to-png.js
export default {
  id: "svg-to-png",
  title: "SVG to PNG",
  category: "Vector",
  icon: "🎨",
  accept: ["image/svg+xml", ".svg"],
  keywords: ["svg", "png", "vector", "rasterize", "convert", "scale", "retina"],
  description: "Rasterize vector SVG files into crisp, high-resolution PNGs at 1x, 2x, or 4x Retina scale.",
  
  options: [
    {
      id: "scale",
      label: "Export Scale Multiplier",
      type: "select",
      default: "2",
      options: [
        { label: "1x Standard (100%)", value: "1" },
        { label: "2x High-DPI / Retina (200%)", value: "2" },
        { label: "4x Ultra HD (400%)", value: "4" }
      ]
    }
  ],

  async execute(file, options, onProgress = () => {}) {
    return new Promise(async (resolve, reject) => {
      onProgress(15);
      try {
        const text = await file.text();
        const svgBlob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
          URL.revokeObjectURL(url);
          onProgress(40);

          const multiplier = Number((options && options.scale) || 2);
          const width = (img.naturalWidth || img.width || 800) * multiplier;
          const height = (img.naturalHeight || img.height || 600) * multiplier;

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          onProgress(80);

          canvas.toBlob((blob) => {
            canvas.width = 1;
            canvas.height = 1;

            if (!blob) return reject(new Error('Rasterization failed'));
            onProgress(100);

            resolve({
              blob: blob,
              fileName: file.name.replace(/\.[^/.]+$/, "") + `@${multiplier}x.png`,
              originalSize: file.size,
              processedSize: blob.size
            });
          }, 'image/png');
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to parse SVG graphics'));
        };

        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  }
};
