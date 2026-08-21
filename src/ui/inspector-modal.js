// src/ui/inspector-modal.js
import { memory } from '../core/memory.js';
import { lockBackgroundScroll, unlockBackgroundScroll } from '../core/scroll-lock.js';
import { bus } from '../core/bus.js';
import { state } from '../core/state.js';

let modalEl = null;

/**
 * OmniTools Cohesive Graphic Lightbox & Studio Inspector
 * Features:
 * - 100% Theme Matched (Sage Mint #98CBB8 & Deep Petrol Teal #176B74)
 * - Mobile-First Layout: Zero text collision / Zero button overlap
 * - Touch & Mouse Freeform Cropper
 * - Draggable Before vs After Split Slider
 */
export function openInspectorModal(file, result = null, fileIndex = 0) {
  if (!file) return;

  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'inspector-modal-overlay';
    modalEl.className = 'overlay hidden';
    document.body.appendChild(modalEl);
  }

  const isProcessed = Boolean(result && result.blob);
  const origUrl = memory.createObjectURL(file);
  const compUrl = isProcessed ? memory.createObjectURL(result.blob) : origUrl;

  const origSize = formatBytes(file.size);
  const compSize = isProcessed ? formatBytes(result.processedSize) : origSize;
  const savings = isProcessed && file.size > 0 ? (((file.size - result.processedSize) / file.size) * 100).toFixed(1) : '0';

  let currentRotation = file._customRotation || 0;
  let isCropping = false;
  let isSplitCompare = isProcessed;

  // Crop percentage coordinates [0 to 100]
  let cropRect = file._customCropPercent || { x: 10, y: 10, w: 80, h: 80 };

  modalEl.innerHTML = `
    <div class="omni-inspector-wrapper animate-fade-in">
      <!-- 1. Unified Petrol Teal Topbar -->
      <div class="omni-insp-topbar">
        <div class="omni-insp-meta">
          <span class="omni-insp-icon">👁️</span>
          <div class="omni-insp-titles">
            <span class="omni-insp-name" title="${file.name}">${file.name}</span>
            <span class="omni-insp-size-badge">
              ${origSize} ${isProcessed ? `→ <strong>${compSize} (-${savings}%)</strong>` : ''}
            </span>
          </div>
        </div>

        <button class="omni-insp-close-btn" id="close-inspector-btn" title="Close">✕</button>
      </div>

      <!-- 2. Middle Viewport Stage -->
      <div class="omni-insp-stage" id="insp-viewport">
        <!-- Floating Tool Palette (Rotate, Crop, Compare) -->
        <div class="omni-insp-floating-tools">
          <button class="omni-tool-chip" id="btn-insp-rotate" title="Rotate +90°">
            <span>🔄</span> Rotate
          </button>

          <button class="omni-tool-chip ${isCropping ? 'active' : ''}" id="btn-insp-crop" title="Crop Image">
            <span>✂️</span> Crop
          </button>

          ${isProcessed ? `
            <button class="omni-tool-chip ${isSplitCompare ? 'active' : ''}" id="btn-insp-split" title="Compare Before/After">
              <span>👁️</span> Compare
            </button>
          ` : ''}
        </div>

        <!-- Centered Bounded Image Box -->
        <div class="omni-insp-img-box" id="insp-img-box">
          <img src="${origUrl}" alt="${file.name}" class="omni-preview-img" id="insp-orig-img">

          <!-- Split Layer -->
          <div class="omni-split-layer ${isSplitCompare ? '' : 'hidden'}" id="insp-split-wrap">
            <img src="${compUrl}" alt="Compressed" class="omni-preview-img omni-split-img" id="insp-comp-img">
          </div>

          <!-- Split Line Divider -->
          <div class="omni-split-line ${isSplitCompare ? '' : 'hidden'}" id="insp-split-line">
            <div class="omni-split-handle">‹ ›</div>
          </div>

          <!-- Freeform Crop Overlay -->
          <div class="omni-crop-overlay hidden" id="insp-crop-overlay">
            <div class="omni-crop-box" id="insp-crop-box">
              <div class="omni-handle handle-tl" data-handle="tl"></div>
              <div class="omni-handle handle-tr" data-handle="tr"></div>
              <div class="omni-handle handle-br" data-handle="br"></div>
              <div class="omni-handle handle-bl" data-handle="bl"></div>
              <div class="omni-crop-badge" id="insp-crop-badge">Crop</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Unified Bottom Action Bar -->
      <div class="omni-insp-bottombar">
        <div class="omni-insp-status-text" id="insp-footer-info">
          ${isCropping ? 'Drag corners to crop (Touch/Mouse)' : isProcessed ? 'Slide to compare Before vs After' : 'Rotate or crop, then tap Save'}
        </div>

        <div class="omni-insp-actions">
          ${isProcessed ? `
            <button class="glass-btn btn-small" id="btn-insp-recompress">
              <span>⚡</span> Re-Compress
            </button>
            <button class="primary-btn btn-small" id="btn-insp-download">
              <span>⬇</span> Download
            </button>
          ` : `
            <button class="primary-btn btn-small" id="btn-insp-apply">
              <span>💾</span> Save & Compress
            </button>
          `}
        </div>
      </div>
    </div>
  `;

  modalEl.classList.remove('hidden');
  lockBackgroundScroll();

  const origImg = modalEl.querySelector('#insp-orig-img');
  const compImg = modalEl.querySelector('#insp-comp-img');
  const splitWrap = modalEl.querySelector('#insp-split-wrap');
  const splitLine = modalEl.querySelector('#insp-split-line');
  const cropOverlay = modalEl.querySelector('#insp-crop-overlay');
  const cropBox = modalEl.querySelector('#insp-crop-box');
  const cropBadge = modalEl.querySelector('#insp-crop-badge');
  const footerInfo = modalEl.querySelector('#insp-footer-info');

  const btnRotate = modalEl.querySelector('#btn-insp-rotate');
  const btnCrop = modalEl.querySelector('#btn-insp-crop');
  const btnSplit = modalEl.querySelector('#btn-insp-split');

  // Preload Image to calculate aspect-fit rotation
  const rawImage = new Image();
  rawImage.onload = () => {
    updateImageOrientation();
  };
  rawImage.src = origUrl;

  function updateImageOrientation() {
    if (!rawImage.naturalWidth) return;

    if (currentRotation === 0) {
      origImg.src = origUrl;
      if (isProcessed) compImg.src = compUrl;
    } else {
      const isRot90 = currentRotation === 90 || currentRotation === 270;
      const w = rawImage.naturalWidth;
      const h = rawImage.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = isRot90 ? h : w;
      canvas.height = isRot90 ? w : h;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((currentRotation * Math.PI) / 180);
      ctx.drawImage(rawImage, -w / 2, -h / 2);
      origImg.src = canvas.toDataURL('image/jpeg', 0.95);
      canvas.width = 1;
      canvas.height = 1;

      if (isProcessed) {
        const rawComp = new Image();
        rawComp.onload = () => {
          const cCanvas = document.createElement('canvas');
          cCanvas.width = isRot90 ? rawComp.naturalHeight : rawComp.naturalWidth;
          cCanvas.height = isRot90 ? rawComp.naturalWidth : rawComp.naturalHeight;
          const cCtx = cCanvas.getContext('2d');
          cCtx.translate(cCanvas.width / 2, cCanvas.height / 2);
          cCtx.rotate((currentRotation * Math.PI) / 180);
          cCtx.drawImage(rawComp, -rawComp.naturalWidth / 2, -rawComp.naturalHeight / 2);
          compImg.src = cCanvas.toDataURL('image/jpeg', 0.95);
          cCanvas.width = 1;
          cCanvas.height = 1;
        };
        rawComp.src = compUrl;
      }
    }

    if (isCropping) renderCropUI();
  }

  // Close handler
  const closeModal = () => {
    modalEl.classList.add('hidden');
    unlockBackgroundScroll();
    window.removeEventListener('keydown', handleKeyCrop);
  };
  modalEl.querySelector('#close-inspector-btn')?.addEventListener('click', closeModal);

  // Rotate Button (+90° on each click)
  btnRotate.addEventListener('click', () => {
    currentRotation = (currentRotation + 90) % 360;
    file._customRotation = currentRotation;
    updateImageOrientation();
  });

  // Crop Toggle
  function updateCropState() {
    if (isCropping) {
      cropOverlay.classList.remove('hidden');
      btnCrop.classList.add('active');
      if (splitWrap) splitWrap.classList.add('hidden');
      if (splitLine) splitLine.classList.add('hidden');
      renderCropUI();
      if (footerInfo) footerInfo.textContent = 'Drag corners freely to crop';
    } else {
      cropOverlay.classList.add('hidden');
      btnCrop.classList.remove('active');
      if (isSplitCompare && isProcessed) {
        if (splitWrap) splitWrap.classList.remove('hidden');
        if (splitLine) splitLine.classList.remove('hidden');
      }
      if (footerInfo) footerInfo.textContent = isProcessed ? 'Slide to compare Before vs After' : 'Rotate or crop, then tap Save';
    }
  }

  btnCrop.addEventListener('click', () => {
    isCropping = !isCropping;
    updateCropState();
  });

  // Split Compare Toggle
  if (btnSplit) {
    btnSplit.addEventListener('click', () => {
      isSplitCompare = !isSplitCompare;
      btnSplit.classList.toggle('active', isSplitCompare);
      if (splitWrap) splitWrap.classList.toggle('hidden', !isSplitCompare);
      if (splitLine) splitLine.classList.toggle('hidden', !isSplitCompare);
      if (isCropping) {
        isCropping = false;
        updateCropState();
      }
    });
  }

  // Render Crop UI Box
  function renderCropUI() {
    cropBox.style.left = `${cropRect.x}%`;
    cropBox.style.top = `${cropRect.y}%`;
    cropBox.style.width = `${cropRect.w}%`;
    cropBox.style.height = `${cropRect.h}%`;

    const natW = rawImage.naturalWidth || 800;
    const natH = rawImage.naturalHeight || 600;
    const isRot90 = currentRotation === 90 || currentRotation === 270;
    const srcW = isRot90 ? natH : natW;
    const srcH = isRot90 ? natW : natH;

    const pxW = Math.round((cropRect.w / 100) * srcW);
    const pxH = Math.round((cropRect.h / 100) * srcH);
    if (cropBadge) cropBadge.textContent = `${pxW} × ${pxH} px`;

    file._customCropPercent = { ...cropRect };
    file._customCrop = {
      x: Math.round((cropRect.x / 100) * srcW),
      y: Math.round((cropRect.y / 100) * srcH),
      width: pxW,
      height: pxH
    };
  }

  // Interactive Touch & Mouse Drag on Crop Box
  let activeHandle = null;
  let startX = 0, startY = 0;
  let initCrop = { ...cropRect };

  function onCropDown(e) {
    const hEl = e.target.closest('.omni-handle');
    const isB = e.target.closest('#insp-crop-box');
    if (hEl) activeHandle = hEl.dataset.handle;
    else if (isB) activeHandle = 'box';
    else return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
    initCrop = { ...cropRect };
    e.preventDefault();
    e.stopPropagation();
  }

  function onCropMove(e) {
    if (!activeHandle) return;
    const rect = cropOverlay.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = ((clientX - startX) / rect.width) * 100;
    const dy = ((clientY - startY) / rect.height) * 100;

    let { x, y, w, h } = initCrop;

    if (activeHandle === 'box') {
      x = Math.max(0, Math.min(100 - w, x + dx));
      y = Math.max(0, Math.min(100 - h, y + dy));
    } else {
      if (activeHandle === 'br') {
        w = Math.max(10, Math.min(100 - x, w + dx));
        h = Math.max(10, Math.min(100 - y, h + dy));
      } else if (activeHandle === 'tr') {
        w = Math.max(10, Math.min(100 - x, w + dx));
        const newH = Math.max(10, h - dy);
        const newY = y + (h - newH);
        if (newY >= 0) { y = newY; h = newH; }
      } else if (activeHandle === 'bl') {
        h = Math.max(10, Math.min(100 - y, h + dy));
        const newW = Math.max(10, w - dx);
        const newX = x + (w - newW);
        if (newX >= 0) { x = newX; w = newW; }
      } else if (activeHandle === 'tl') {
        const newW = Math.max(10, w - dx);
        const newH = Math.max(10, h - dy);
        const newX = x + (w - newW);
        const newY = y + (h - newH);
        if (newX >= 0) { x = newX; w = newW; }
        if (newY >= 0) { y = newY; h = newH; }
      }
    }

    cropRect = { x, y, w, h };
    renderCropUI();
  }

  function onCropUp() {
    activeHandle = null;
  }

  cropOverlay.addEventListener('mousedown', onCropDown);
  window.addEventListener('mousemove', onCropMove);
  window.addEventListener('mouseup', onCropUp);

  cropOverlay.addEventListener('touchstart', onCropDown, { passive: false });
  window.addEventListener('touchmove', onCropMove, { passive: false });
  window.addEventListener('touchend', onCropUp);

  // Keyboard Crop Nudge
  function handleKeyCrop(e) {
    if (!isCropping) return;
    const step = e.shiftKey ? 3 : 1;
    let changed = false;
    if (e.key === 'ArrowLeft') { cropRect.x = Math.max(0, cropRect.x - step); changed = true; }
    if (e.key === 'ArrowRight') { cropRect.x = Math.min(100 - cropRect.w, cropRect.x + step); changed = true; }
    if (e.key === 'ArrowUp') { cropRect.y = Math.max(0, cropRect.y - step); changed = true; }
    if (e.key === 'ArrowDown') { cropRect.y = Math.min(100 - cropRect.h, cropRect.y + step); changed = true; }
    if (changed) { renderCropUI(); e.preventDefault(); }
  }
  window.addEventListener('keydown', handleKeyCrop);

  // Setup Split Slider Dragging
  if (isProcessed) {
    setupSplitDrag(modalEl);
  }

  // Save / Apply Handlers
  const saveAndCompress = () => {
    closeModal();
    const activeToolId = state.get('activeTool');
    const queue = state.get('batchQueue');
    const options = state.get('activeToolOptions') || {};
    bus.emit('batch:start', { toolId: activeToolId, queue, options });
  };

  modalEl.querySelector('#btn-insp-apply')?.addEventListener('click', saveAndCompress);
  modalEl.querySelector('#btn-insp-recompress')?.addEventListener('click', saveAndCompress);

  // Download Handler
  modalEl.querySelector('#btn-insp-download')?.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = compUrl;
    a.download = (result && result.fileName) || file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

function setupSplitDrag(modal) {
  const stage = modal.querySelector('#insp-img-box');
  const clipLayer = modal.querySelector('#insp-split-wrap');
  const divider = modal.querySelector('#insp-split-line');
  if (!stage || !clipLayer || !divider) return;

  let isDragging = false;

  function setSlider(percent) {
    const clamped = Math.max(0, Math.min(100, percent));
    divider.style.left = `${clamped}%`;
    clipLayer.style.clipPath = `polygon(${clamped}% 0, 100% 0, 100% 100%, ${clamped}% 100%)`;
  }
  setSlider(50);

  function handleDrag(e) {
    if (!isDragging) return;
    const rect = stage.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    setSlider(percent);
  }

  stage.addEventListener('mousedown', (e) => {
    if (e.target.closest('#insp-crop-overlay')) return;
    isDragging = true;
    handleDrag(e);
  });
  window.addEventListener('mousemove', handleDrag);
  window.addEventListener('mouseup', () => { isDragging = false; });

  stage.addEventListener('touchstart', (e) => {
    if (e.target.closest('#insp-crop-overlay')) return;
    isDragging = true;
    handleDrag(e);
  }, { passive: true });
  window.addEventListener('touchmove', handleDrag, { passive: true });
  window.addEventListener('touchend', () => { isDragging = false; });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
