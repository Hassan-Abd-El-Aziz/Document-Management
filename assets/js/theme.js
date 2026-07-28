'use strict';

window.EG = window.EG || {};

EG.theme = (function () {
  let current = 'system';

  function resolve(mode) {
    if (mode === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
  }

  function apply(mode) {
    current = mode;
    const resolved = resolve(mode);
    document.documentElement.setAttribute('data-theme', resolved);
    EG.state.theme = resolved;
    EG.state.themeMode = mode;
  }

  function get() { return current; }

  function toggle() {
    const order = ['light', 'dark', 'system'];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    apply(next);
    if (EG.api) EG.api.settings.update({ theme: next }).catch(() => {});
    return next;
  }

  function init(mode) {
    apply(mode || 'system');
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (current === 'system') apply('system');
      });
    }
  }

  return { apply, get, toggle, init, resolve };
})();
