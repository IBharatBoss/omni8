// src/ui/router.js
import { bus } from '../core/bus.js';
import { state } from '../core/state.js';
import { registry } from '../engine/registry.js';
import { renderHomeView } from './home-view.js';
import { renderStudioView } from './studio-view.js';

/**
 * Decoupled Hash-based View Router
 * Handles seamless SPA navigation between Home Grid and Tool Studio.
 */
export function initRouter() {
  // Listen for programmatic navigation events
  bus.on('route:navigate', (toolId) => {
    if (toolId) {
      window.location.hash = `#/tool/${toolId}`;
    } else {
      window.location.hash = '#/';
    }
  });

  // Handle browser popstate / hashchange (Back/Forward buttons)
  window.addEventListener('hashchange', () => {
    handleRoute(window.location.hash);
  });

  // Initial route on boot
  handleRoute(window.location.hash || '#/');
}

function handleRoute(hash) {
  const homeContainer = document.getElementById('home-view');
  const studioContainer = document.getElementById('studio-view');
  
  if (!homeContainer || !studioContainer) return;

  const toolMatch = hash.match(/^#\/tool\/([a-zA-Z0-9_-]+)/);

  if (toolMatch) {
    const toolId = toolMatch[1];
    const tool = registry.getTool(toolId);

    if (tool) {
      state.set('activeTool', toolId);
      state.set('currentView', 'studio');

      homeContainer.classList.add('hidden');
      studioContainer.classList.remove('hidden');

      renderStudioView(tool);
      bus.emit('view:change', { view: 'studio', toolId });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  }

  // Default: Home View
  state.set('activeTool', null);
  state.set('currentView', 'home');

  studioContainer.classList.add('hidden');
  homeContainer.classList.remove('hidden');

  renderHomeView();
  bus.emit('view:change', { view: 'home' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
