// src/tools/img-to-jpg.js
export default {
  id: "img-to-jpg",
  title: "Image to JPG",
  category: "Image",
  icon: "📸",
  accept: ["image/png", "image/webp", "image/bmp", "image/svg+xml", "image/avif"],
  keywords: ["convert", "jpg", "jpeg", "flatten", "image", "photo"],
  description: "Convert images to JPEG format with customizable quality and solid background flattening.",
  
  options: [
    {
      id: "quality",
      label: "Compression Quality",
      type: "range",
      min: 5,
      max: 100,
      default: 85,
      unit: "%"
    },
    {
      id: "bgColor",
      label: "Background Color",
      type: "select",
      default: "#FFFFFF",
      options: [
        { label: "White (#FFFFFF)", value: "#FFFFFF" },
        { label: "Black (#000000)", value: "#000000" },
        { label: "Light Gray (#F0F0F0)", value: "#F0F0F0" }
      ]
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
        
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Fill solid background for alpha flattening
        ctx.fillStyle = (options && options.bgColor) || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 0, 0);
        onProgress(70);
        
        const quality = ((options && options.quality) || 85) / 100;
        
        canvas.toBlob((blob) => {
          canvas.width = 1;
          canvas.height = 1;

          if (!blob) {
            return reject(new Error('JPEG encoding failed'));
          }
          onProgress(100);
          resolve({
            blob: blob,
            fileName: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
            originalSize: file.size,
            processedSize: blob.size
          });
        }, 'image/jpeg', quality);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image file'));
      };

      img.src = url;
    });
  }
};
