// src/tools/pdf-split.js
export default {
  id: "pdf-split",
  title: "PDF Splitter",
  category: "PDF",
  icon: "✂️",
  accept: ["application/pdf", ".pdf"],
  keywords: ["split", "extract", "separate", "pdf", "document", "pages", "unbundle"],
  description: "Split PDF pages into separate documents or extract individual pages locally.",
  
  options: [
    {
      id: "splitMode",
      label: "Split Mode",
      type: "select",
      default: "all_pages",
      options: [
        { label: "Split All Pages (ZIP Package)", value: "all_pages" },
        { label: "Extract Page 1 Only", value: "first_page" }
      ]
    }
  ],

  async execute(file, options, onProgress = () => {}) {
    onProgress(10);
    // Dynamic import to keep app boot 100% instant and decoupled
    const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    
    onProgress(20);
    const arrayBuffer = await file.arrayBuffer();
    const originalPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pageCount = originalPdf.getPageCount();
    
    if (pageCount === 0) {
      throw new Error("The selected PDF file contains no pages.");
    }

    const splitMode = (options && options.splitMode) || 'all_pages';

    if (splitMode === 'first_page' || pageCount === 1) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(originalPdf, [0]);
      newPdf.addPage(copiedPage);
      
      onProgress(80);
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      onProgress(100);

      return {
        blob: blob,
        fileName: file.name.replace(/\.[^/.]+$/, "") + "_page1.pdf",
        originalSize: file.size,
        processedSize: blob.size
      };
    }

    // Split all pages into a ZIP
    const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
    const zip = new JSZip();
    const baseName = file.name.replace(/\.[^/.]+$/, "");

    for (let i = 0; i < pageCount; i++) {
      const singlePdf = await PDFDocument.create();
      const [copiedPage] = await singlePdf.copyPages(originalPdf, [i]);
      singlePdf.addPage(copiedPage);

      const pdfBytes = await singlePdf.save();
      zip.file(`${baseName}_page_${i + 1}.pdf`, pdfBytes);

      const progress = 20 + Math.round(((i + 1) / pageCount) * 65);
      onProgress(progress);
    }

    onProgress(90);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    onProgress(100);

    return {
      blob: zipBlob,
      fileName: `${baseName}_split_pages.zip`,
      originalSize: file.size,
      processedSize: zipBlob.size
    };
  }
};
