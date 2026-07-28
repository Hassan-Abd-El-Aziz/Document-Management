'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};
EG.router = (function () {
  const U = EG.utils;
  let currentPage = null;
  let currentId = null;

  const navItems = [
    'dashboard', 'departments', 'documents', 'incoming', 'outgoing', 'letters', 'recycle', 'notifications', 'reports', 'backup', 'lending', 'users', 'logs', 'search', 'emaillog', 'settings',
  ];

  function buildNav(active) {
    const nav = document.getElementById('nav');
    U.clear(nav);
    navItems.forEach((id) => {
      const p = EG.pages[id];
      if (!p) return;
      const item = U.el('a', {
        class: 'nav-item' + (id === active ? ' active' : ''),
        href: '#' + id,
        onclick: (e) => { e.preventDefault(); navigate(id); },
      }, [
        U.el('span', { class: 'nav-icon', html: EG.icon(p.icon, 20) }),
        U.el('span', { class: 'nav-label', text: EG.i18n.t(id) }),
      ]);
      nav.appendChild(item);
    });
  }

  async function navigate(id) {
    const page = EG.pages[id];
    if (!page) return;
    const view = document.getElementById('view');
    if (currentPage && currentPage.unmount) {
      try { currentPage.unmount(); } catch (_) {}
    }
    U.clear(view);
    buildNav(id);
    currentId = id;
    currentPage = page;

    view.classList.remove('page-enter');
    void view.offsetWidth;
    view.classList.add('page-enter');

    const loader = EG.components.loadingBlock();
    view.appendChild(loader);
    try {
      const rendered = page.render(view);
      if (rendered && rendered.then) {
        await rendered;
      }
    } catch (e) {
      U.clear(view);
      view.appendChild(EG.components.emptyState('error', EG.api.errMessage(e)));
    }
    if (EG.app) EG.app.refreshBadges();
  }

  function refreshNav() { buildNav(currentId); }

  function rerender() {
    if (currentId) return navigate(currentId);
  }

  return { navigate, buildNav, refreshNav, rerender, get current() { return currentId; } };
})();
