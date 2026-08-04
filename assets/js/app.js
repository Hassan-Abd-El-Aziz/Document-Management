'use strict';

window.EG = window.EG || {};

EG.app = (function () {
  const U = EG.utils;
  const C = EG.components;
  const t = (k) => EG.i18n.t(k);

  let settings = {};
  let session = null;

  async function init() {
    try {
      settings = await EG.api.settings.get();
    } catch (_) {
      settings = { theme: 'system', language: 'ar', requireLogin: false };
    }
    EG.state.settings = settings;
    EG.i18n.setLang(settings.language || 'ar');
    EG.theme.init(settings.theme || 'system');

    try { session = await EG.api.auth.session(); } catch (_) { session = null; }
    EG.state.user = session;

    buildTopbar();
    bindGlobalSearch();
    refreshBadges();
    setInterval(refreshBadges, 30000);
    updateStorageMeter();
    updateAppTitle();

    if (settings.requireLogin && !session) {
      showLogin();
    } else {
      EG.router.navigate('dashboard');
    }

    window.eg.onAutoLock(() => {
      if (settings.requireLogin) showLogin(true);
    });
  }

  function buildTopbar() {
    const langBtn = document.getElementById('langToggle');
    langBtn.innerHTML = EG.icon('globe', 20);
    langBtn.onclick = () => {
      const next = EG.state.lang === 'ar' ? 'en' : 'ar';
      EG.i18n.setLang(next);
      EG.api.settings.update({ language: next }).catch(() => {});
      EG.router.refreshNav();
      EG.router.rerender();
      refreshBadges();
    };

    const themeBtn = document.getElementById('themeToggle');
    themeBtn.innerHTML = EG.icon(EG.theme.get() === 'dark' ? 'sun' : 'moon', 20);
    themeBtn.onclick = () => {
      const next = EG.theme.toggle();
      themeBtn.innerHTML = EG.icon(next === 'dark' ? 'sun' : 'moon', 20);
    };

    const menuToggle = document.getElementById('menuToggle');
    menuToggle.innerHTML = EG.icon('menu', 22);
    menuToggle.onclick = () => {
      const shell = document.getElementById('app');
      shell.classList.toggle('menu-open');
      let overlay = document.querySelector('.menu-overlay');
      if (!overlay) {
        overlay = U.el('div', { class: 'menu-overlay' });
        document.body.appendChild(overlay);
        overlay.onclick = () => shell.classList.remove('menu-open');
      }
      overlay.classList.toggle('show', shell.classList.contains('menu-open'));
    };

    const userChip = document.getElementById('userChip');
    userChip.onclick = showUserMenu;
    renderUserChip();
    refreshBadges();
  }

  function renderUserChip() {
    const chip = document.getElementById('userChip');
    U.clear(chip);
    if (session) {
      const initials = (EG.utils.localize(session.fullName, EG.state.lang) || session.username || '?').slice(0, 2);
      chip.appendChild(U.el('span', { class: 'avatar', text: initials }));
      chip.appendChild(U.el('span', { text: EG.utils.localize(session.fullName, EG.state.lang) || session.username }));
    } else {
      chip.appendChild(U.el('span', { class: 'avatar', html: EG.icon('user', 16) }));
      chip.appendChild(U.el('span', { text: t('lock') }));
    }
  }

  function showUserMenu() {
    if (settings.requireLogin && session) {
      C.modal(t('profile'), U.el('div', {}, [
        U.el('p', { text: EG.utils.localize(session.fullName, EG.state.lang) }),
        U.el('p', { class: 'cell-soft', text: session.username + ' · ' + t(session.role) }),
      ]), {
        footer: [C.button(t('logout'), { variant: 'danger', icon: 'lock', onClick: async () => {
          await EG.api.auth.logout().catch(() => {});
          session = null; EG.state.user = null; renderUserChip();
          if (settings.requireLogin) showLogin(); else location.reload();
        } })],
      });
    } else {
      showLogin();
    }
  }

  async function showLogin(isLock) {
    const screen = U.el('div', { class: 'login-screen' });
    const card = U.el('div', { class: 'login-card' });
    card.appendChild(U.el('div', { class: 'login-logo', text: 'H' }));
    card.appendChild(U.el('div', { class: 'login-title', text: t('loginTitle') }));
    const err = U.el('div', { class: 'login-error' });
    const userIn = C.input('', { type: 'text', placeholder: t('username') });
    const passIn = C.input('', { type: 'password', placeholder: t('password') });
    const submit = C.button(t('login'), { variant: 'primary', onClick: doLogin });
    card.appendChild(err);
    card.appendChild(C.fieldWrap(t('username'), userIn));
    card.appendChild(C.fieldWrap(t('password'), passIn));
    card.appendChild(submit);
    screen.appendChild(card);
    document.body.appendChild(screen);
    setTimeout(() => userIn.focus(), 50);

    async function doLogin() {
      try {
        session = await EG.api.auth.login(userIn.value.trim(), passIn.value);
        EG.state.user = session;
        settings = await EG.api.settings.get();
        EG.state.settings = settings;
        renderUserChip();
        screen.remove();
        EG.router.navigate('dashboard');
      } catch (e) {
        err.textContent = EG.api.errMessage(e);
      }
    }
    passIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
    userIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') passIn.focus(); });
  }

  async function refreshBadges() {}

  async function updateStorageMeter() {
    try {
      const s = await EG.api.stats.dashboard();
      const meter = document.getElementById('storageMeter');
      if (meter) meter.textContent = EG.i18n.t('storageUsage') + ': ' + s.storageUsage.usedMB + ' MB';
    } catch (_) {}
  }

  function bindGlobalSearch() {
    const inputEl = document.getElementById('globalSearch');
    const dropdown = document.getElementById('searchResults');

    function openAllResults(q) {
      const query = (q || inputEl.value).trim();
      if (!query) return;
      EG.state.quickQuery = query;
      dropdown.classList.add('hidden');
      inputEl.value = '';
      EG.router.navigate('search');
    }

    const run = U.debounce(async () => {
      const q = inputEl.value.trim();
      if (!q) { dropdown.classList.add('hidden'); U.clear(dropdown); return; }
      try {
        const res = await EG.api.search.global(q, EG.state.lang);
        renderDropdown(res, q);
      } catch (_) { dropdown.classList.add('hidden'); }
    }, 250);

    inputEl.addEventListener('input', run);
    inputEl.addEventListener('focus', () => { if (inputEl.value.trim()) run(); });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); openAllResults(); }
      else if (e.key === 'Escape') { dropdown.classList.add('hidden'); inputEl.blur(); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputEl.focus();
        inputEl.select();
      }
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== inputEl) dropdown.classList.add('hidden');
    });

    function renderDropdown(res, q) {
      U.clear(dropdown);
      const groups = [
        { key: 'documents', label: t('documents'), target: 'documents' },
        { key: 'incoming', label: t('incoming'), target: 'incoming' },
        { key: 'outgoing', label: t('outgoing'), target: 'outgoing' },
        { key: 'departments', label: t('departments'), target: 'departments' },
      ];
      let any = false;
      let total = 0;
      groups.forEach((g) => {
        const items = (res[g.key] || []).slice(0, 5);
        if (!items.length) return;
        any = true;
        total += (res[g.key] || []).length;
        dropdown.appendChild(U.el('div', { class: 'search-group-title', text: g.label }));
        items.forEach((it) => {
          const title = g.key === 'departments' ? EG.utils.localize(it.name, EG.state.lang) : (EG.utils.localize(it.title || it.subject, EG.state.lang) || it.fileNumber || it.letterNumber);
          const node = U.el('div', { class: 'search-item' }, [
            U.el('span', { class: 'search-thumb', html: EG.icon('file', 16) }),
            U.el('div', {}, [
              U.el('div', { class: 'cell-title', text: title }),
              U.el('div', { class: 'meta', text: it.fileNumber || it.letterNumber || it.code || '' }),
            ]),
          ]);
          node.onclick = () => openAllResults(q);
          dropdown.appendChild(node);
        });
      });
      if (!any) {
        dropdown.appendChild(U.el('div', { class: 'cell-soft', style: 'padding:14px', text: t('noResults') }));
      } else {
        dropdown.appendChild(U.el('div', {
          class: 'search-view-all',
          text: t('viewAllResults') + ' (' + total + ')',
          onclick: () => openAllResults(q),
        }));
      }
      dropdown.classList.remove('hidden');
    }
  }

  function updateAppTitle() {
    try {
      const s = settings || EG.state.settings || {};
      const name = s.companyName && (s.companyName.ar || s.companyName.en) ? (EG.utils.localize(s.companyName, EG.state.lang) || s.companyName.en) : (t('appName') || 'Egypt Gulf');
      const sub = t('appSub') || 'إدارة الوثائق';
      const brandName = document.getElementById('brandName');
      const brandSub = document.getElementById('brandSub');
      if (brandName) brandName.textContent = name;
      if (brandSub) brandSub.textContent = sub;
      if (document.title) document.title = name + ' - ' + sub;
    } catch (_) {}
  }

  return { init, refreshBadges, getSettings: () => settings, updateAppTitle };
})();

document.addEventListener('DOMContentLoaded', () => EG.app.init());
