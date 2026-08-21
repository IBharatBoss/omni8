// src/tools/img-to-png.js
export default {
  id: "img-to-png",
  title: "Image to PNG",
  category: "Image",
  icon: "💎",
  accept: ["image/jpeg", "image/webp", "image/bmp", "image/svg+xml", "image/avif"],
  keywords: ["convert", "png", "lossless", "image", "photo", "transparent", "alpha"],
  description: "Losslessly transform images to crystal-clear PNG format with full alpha transparency.",
  
  options: [
    {
      id: "background",
      label: "Background",
      type: "select",
      default: "transparent",
      options: [
        { label: "Preserve Transparency", value: "transparent" },
        { label: "Solid White (#FFFFFF)", value: "#FFFFFF" },
        { label: "Solid Black (#000000)", value: "#000000" }
      ]
    }
  ],

  async execute(file, options, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      onProgress(10);
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        onProgress(35);
        
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (options && options.background && options.background !== 'transparent') {
          ctx.fillStyle = options.background;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);
        onProgress(75);
        
        canvas.toBlob((blob) => {
          canvas.width = 1;
          canvas.height = 1;

          if (!blob) {
            return reject(new Error('PNG export failed'));
          }
          onProgress(100);
          resolve({
            blob: blob,
            fileName: file.name.replace(/\.[^/.]+$/, "") + ".png",
            originalSize: file.size,
            processedSize: blob.size
          });
        }, 'image/png');
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image file'));
      };

      img.src = url;
    });
  }
};
