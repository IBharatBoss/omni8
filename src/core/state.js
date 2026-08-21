// src/core/state.js
import { bus } from './bus.js';

class StateManager {
  constructor() {
    this.state = {
      currentView: 'home', // 'home' | 'studio'
      activeTool: null, // Tool ID string or null
      activeCategory: 'All',
      searchQuery: '',
      batchQueue: [], // Array of File objects
      processedFiles: [], // Array of { index, result, progress, status: 'pending'|'processing'|'done'|'error', error }
      isProcessing: false,
      activeToolOptions: {} // Form state dynamically populated
    };
  }

  get(key) {
    return this.state[key];
  }

  getAll() {
    return { ...this.state };
  }

  set(key, value) {
    this.state[key] = value;
    bus.emit(`state:${key}`, value);
    bus.emit('state:change', this.state);
  }

  updateBatchQueue(newFiles) {
    if (!newFiles || newFiles.length === 0) return;
    const currentQueue = [...this.state.batchQueue];
    const startIndex = currentQueue.length;
    
    const validFiles = Array.from(newFiles);
    const updatedQueue = [...currentQueue, ...validFiles];
    
    // Initialize processing slots
    const updatedProcessed = [...this.state.processedFiles];
    validFiles.forEach((_, i) => {
      updatedProcessed.push({
        index: startIndex + i,
        result: null,
        progress: 0,
        status: 'pending',
        error: null
      });
    });

    this.state.batchQueue = updatedQueue;
    this.state.processedFiles = updatedProcessed;
    
    bus.emit('state:batchQueue', updatedQueue);
    bus.emit('state:processedFiles', updatedProcessed);
    bus.emit('state:change', this.state);
  }

  removeQueueItem(index) {
    const updatedQueue = this.state.batchQueue.filter((_, i) => i !== index);
    const updatedProcessed = this.state.processedFiles.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      index: i
    }));

    this.state.batchQueue = updatedQueue;
    this.state.processedFiles = updatedProcessed;
    
    bus.emit('state:batchQueue', updatedQueue);
    bus.emit('state:processedFiles', updatedProcessed);
    bus.emit('state:change', this.state);
  }

  updateProgress(index, progress, status = 'processing') {
    const processed = [...this.state.processedFiles];
    const target = processed.find(p => p.index === index);
    if (target) {
      target.progress = progress;
      target.status = status;
      this.state.processedFiles = processed;
      bus.emit('state:processedFiles', processed);
      bus.emit('state:change', this.state);
    }
  }

  setResult(index, result) {
    const processed = [...this.state.processedFiles];
    const target = processed.find(p => p.index === index);
    if (target) {
      target.result = result;
      target.progress = 100;
      target.status = 'done';
      this.state.processedFiles = processed;
      bus.emit('state:processedFiles', processed);
      bus.emit('state:change', this.state);
    }
  }

  setError(index, error) {
    const processed = [...this.state.processedFiles];
    const target = processed.find(p => p.index === index);
    if (target) {
      target.error = error;
      target.status = 'error';
      this.state.processedFiles = processed;
      bus.emit('state:processedFiles', processed);
      bus.emit('state:change', this.state);
    }
  }

  clearQueue() {
    this.state.batchQueue = [];
    this.state.processedFiles = [];
    this.state.isProcessing = false;
    bus.emit('state:batchQueue', []);
    bus.emit('state:processedFiles', []);
    bus.emit('queue:cleared');
    bus.emit('state:change', this.state);
  }
}

export const state = new StateManager();
