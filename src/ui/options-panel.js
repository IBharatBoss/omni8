// src/ui/options-panel.js
import { state } from '../core/state.js';

/**
 * Ultra-Compact Schema-Driven Options Bar
 * Designed to occupy minimal vertical space with high-contrast tactile controls.
 */
export function renderOptionsPanel(tool) {
  const container = document.createElement('div');
  container.className = 'glass-panel-subtle compact-options-bar';

  const schema = tool.optionsSchema || tool.options || [];

  if (schema.length === 0) {
    state.set('activeToolOptions', {});
    return container;
  }

  const currentOptions = { ...(state.get('activeToolOptions') || {}) };
  const row = document.createElement('div');
  row.className = 'compact-options-row';

  schema.forEach(opt => {
    if (currentOptions[opt.id] === undefined) {
      currentOptions[opt.id] = opt.default;
    }

    const item = document.createElement('div');
    item.className = 'compact-option-item';

    if (opt.type === 'number') {
      const label = document.createElement('span');
      label.className = 'compact-opt-label';
      label.textContent = opt.label.replace(/\s*\(.*?\)/, ''); // Clean short label

      const controlWrap = document.createElement('div');
      controlWrap.className = 'compact-num-wrap';

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'compact-num-input';
      input.value = currentOptions[opt.id];
      if (opt.min !== undefined) input.min = opt.min;
      if (opt.max !== undefined) input.max = opt.max;

      input.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        currentOptions[opt.id] = val;
        state.set('activeToolOptions', { ...currentOptions });
      });

      const unit = document.createElement('span');
      unit.className = 'compact-unit-badge';
      unit.textContent = 'KB';

      controlWrap.appendChild(input);
      controlWrap.appendChild(unit);

      item.appendChild(label);
      item.appendChild(controlWrap);

      // Render mini presets
      if (opt.presets && Array.isArray(opt.presets)) {
        const presetsWrap = document.createElement('div');
        presetsWrap.className = 'compact-presets';
        opt.presets.forEach(p => {
          const pVal = typeof p === 'object' ? p.value : p;
          const pLabel = typeof p === 'object' ? p.label : `${p}K`;

          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `compact-preset-chip ${currentOptions[opt.id] === pVal ? 'active' : ''}`;
          chip.textContent = pLabel;
          chip.addEventListener('click', () => {
            input.value = pVal;
            currentOptions[opt.id] = pVal;
            presetsWrap.querySelectorAll('.compact-preset-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.set('activeToolOptions', { ...currentOptions });
          });
          presetsWrap.appendChild(chip);
        });
        item.appendChild(presetsWrap);
      }
    } else if (opt.type === 'select') {
      const label = document.createElement('span');
      label.className = 'compact-opt-label';
      label.textContent = opt.label;

      const select = document.createElement('select');
      select.className = 'compact-select-input';

      (opt.choices || opt.options || []).forEach(choice => {
        const optEl = document.createElement('option');
        optEl.value = typeof choice === 'object' ? choice.value : choice;
        optEl.textContent = typeof choice === 'object' ? choice.label : choice;
        if (optEl.value === String(currentOptions[opt.id])) optEl.selected = true;
        select.appendChild(optEl);
      });

      select.addEventListener('change', (e) => {
        currentOptions[opt.id] = e.target.value;
        state.set('activeToolOptions', { ...currentOptions });
      });

      item.appendChild(label);
      item.appendChild(select);
    } else if (opt.type === 'range') {
      const label = document.createElement('span');
      label.className = 'compact-opt-label';
      label.textContent = `${opt.label}: ${currentOptions[opt.id]}${opt.unit || ''}`;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'option-slider';
      slider.min = opt.min ?? 1;
      slider.max = opt.max ?? 100;
      slider.step = opt.step ?? 1;
      slider.value = currentOptions[opt.id];

      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        label.textContent = `${opt.label}: ${val}${opt.unit || ''}`;
        currentOptions[opt.id] = val;
        state.set('activeToolOptions', { ...currentOptions });
      });

      item.appendChild(label);
      item.appendChild(slider);
    }

    row.appendChild(item);
  });

  container.appendChild(row);
  state.set('activeToolOptions', currentOptions);

  return container;
}
