// src/main.js
import { registry } from './engine/registry.js';
import { initIngestEngine } from './engine/ingest.js';
import { initRouter } from './ui/router.js';
import { initDropzoneUI } from './ui/dropzone.js';
import { initCommandBar } from './ui/command-bar.js';
import { initChatCopilot } from './ui/chat-copilot.js';
import { initAICopilot } from './services/ai-copilot.js';
import { bus } from './core/bus.js';
import { state } from './core/state.js';
import { updateStudioState } from './ui/studio-view.js';

// 1. Import All Decoupled Tool Plugins
import imgToWebp from './tools/img-to-webp.js';
import imgToPng from './tools/img-to-png.js';
import imgToJpg from './tools/img-to-jpg.js';
import imgCompress from './tools/img-compress.js';
import pdfMerge from './tools/pdf-merge.js';
import pdfSplit from './tools/pdf-split.js';
import imgResize from './tools/img-resize.js';
import svgToPng from './tools/svg-to-png.js';

// Register Plugins into Registry
[imgToWebp, imgToPng, imgToJpg, imgCompress, pdfMerge, pdfSplit, imgResize, svgToPng].forEach(tool => {
  registry.register(tool);
});

// 2. Mobile Gesture Zoom Prevention
function initMobileViewportFixes() {
  // Prevent iOS / Android Safari pinch-zoom & double-tap gestures
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
}

// 3. Application Boot Lifecycle Function
function bootOmniTools() {
  initMobileViewportFixes();
  initRouter();
  initDropzoneUI();
  initCommandBar();
  initChatCopilot();
  initIngestEngine();
  initMobileDock();

  // Initialize AI Copilot (Graceful non-blocking downgrade if offline or unconfigured)
  initAICopilot().catch(console.error);

  console.log('[OmniTools] Clean Decoupled Application Loaded Successfully.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootOmniTools);
} else {
  // DOM is already ready
  bootOmniTools();
}

// 4. Mobile Dock Navigation & Header Actions
function initMobileDock() {
  const homeBtn = document.getElementById('dock-home-btn');
  const uploadBtn = document.getElementById('dock-upload-btn');
  const searchBtn = document.getElementById('dock-search-btn');
  const aiBtn = document.getElementById('dock-ai-btn');
  const topAiBtn = document.getElementById('btn-open-ai');

  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      bus.emit('route:navigate', null);
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      const activeToolId = state.get('activeTool');
      const tool = activeToolId ? registry.getTool(activeToolId) : null;
      bus.emit('ingest:open-picker', { accept: tool ? tool.accept : '*/*' });
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      bus.emit('commandbar:open');
    });
  }

  if (aiBtn) {
    aiBtn.addEventListener('click', () => {
      bus.emit('chat:toggle');
    });
  }

  if (topAiBtn) {
    topAiBtn.addEventListener('click', () => {
      bus.emit('chat:toggle');
    });
  }

  // Update active dock indicator on view changes
  bus.on('view:change', ({ view }) => {
    if (homeBtn) {
      if (view === 'home') {
        homeBtn.classList.add('active');
      } else {
        homeBtn.classList.remove('active');
      }
    }
  });
}

// 5. Batch Processing Orchestrator (Multi-Worker Concurrency Throttling)
bus.on('batch:start', async ({ toolId, queue, options }) => {
  const tool = registry.getTool(toolId);
  if (!tool || !queue || queue.length === 0) return;

  state.set('isProcessing', true);
  updateStudioState(tool);

  try {
    if (tool.batchExecute && typeof tool.executeBatch === 'function') {
      // Batch mode (e.g. PDF Merge)
      state.updateProgress(0, 10, 'processing');
      const result = await tool.executeBatch(queue, options, (progress) => {
        state.updateProgress(0, progress, 'processing');
      });
      state.setResult(0, result);
    } else if (typeof tool.execute === 'function' || typeof tool.processItem === 'function') {
      const execFn = tool.execute ? tool.execute.bind(tool) : tool.processItem.bind(tool);

      // Concurrency Pool: Process up to 4 images concurrently
      const concurrency = Math.min(navigator.hardwareConcurrency || 4, 4);
      const pendingIndices = queue.map((_, idx) => idx).filter(idx => {
        const p = state.get('processedFiles').find(item => item.index === idx);
        return !p || p.status !== 'done';
      });

      async function workerLoop() {
        while (pendingIndices.length > 0) {
          const i = pendingIndices.shift();
          const file = queue[i];
          try {
            state.updateProgress(i, 15, 'processing');
            const result = await execFn(file, options, (progress) => {
              state.updateProgress(i, progress, 'processing');
            });
            state.setResult(i, result);
          } catch (err) {
            console.error(`[Orchestrator] Error processing ${file.name}:`, err);
            state.setError(i, err.message || 'Execution error');
          }
        }
      }

      const workers = Array.from({ length: concurrency }, () => workerLoop());
      await Promise.all(workers);
    }
  } catch (globalErr) {
    console.error('[Orchestrator] Batch execution error:', globalErr);
    alert('Batch error: ' + (globalErr.message || 'Unknown processing failure'));
  } finally {
    state.set('isProcessing', false);
    updateStudioState(tool);
  }
});

// Update Studio view actions whenever batch queue or processed status changes
bus.on('state:change', (s) => {
  if (s.currentView === 'studio' && s.activeTool) {
    const tool = registry.getTool(s.activeTool);
    if (tool) updateStudioState(tool);
  }
});

// 6. Offline PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('[PWA] Service Worker registered in scope:', reg.scope);
    }).catch((err) => {
      console.log('[PWA] Service Worker registration failed:', err);
    });
  });
}
