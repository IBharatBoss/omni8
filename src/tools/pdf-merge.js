// src/tools/pdf-merge.js
export default {
  id: "pdf-merge",
  title: "PDF Merger",
  category: "PDF",
  icon: "📑",
  accept: ["application/pdf", ".pdf"],
  keywords: ["merge", "combine", "join", "pdf", "document", "stitch"],
  description: "Merge multiple PDF files into a single structured document directly in your browser.",
  
  options: [],
  batchExecute: true,

  async executeBatch(files, options, onProgress = () => {}) {
    if (!files || files.length < 2) {
      throw new Error("Please add at least 2 PDF files to merge.");
    }
    
    onProgress(5);
    // Dynamic import to keep app boot 100% instant and decoupled
    const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
    
    onProgress(15);
    const mergedPdf = await PDFDocument.create();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
      
      const percent = 15 + Math.round(((i + 1) / files.length) * 75);
      onProgress(percent);
    }
    
    onProgress(92);
    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    onProgress(100);
    
    return {
      blob: blob,
      fileName: `merged_omnitools_${Date.now()}.pdf`,
      originalSize: files.reduce((acc, f) => acc + f.size, 0),
      processedSize: blob.size
    };
  }
};
