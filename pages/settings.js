'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.settings = {
  id: 'settings',
  title: 'settings',
  icon: 'settings',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    let s = {};
    try { s = await EG.api.settings.get(); } catch (_) { s = {}; }

    const themeSel = C.select([{ value: 'system', label: t('system') }, { value: 'light', label: t('light') }, { value: 'dark', label: t('dark') }], s.theme || 'system');
    const langSel = C.select([{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }], s.language || 'ar');
    const companyAr = C.input(s.companyName && s.companyName.ar ? s.companyName.ar : '', {});
    const companyEn = C.input(s.companyName && s.companyName.en ? s.companyName.en : '', {});
    const addr = C.input(s.companyAddress || '', {});
    const phone = C.input(s.companyPhone || '', {});
    const reqLogin = checkbox(true);
    reqLogin.querySelector('input').disabled = true;
    reqLogin.style.opacity = '0.7';
    reqLogin.style.pointerEvents = 'none';
    const autoLock = checkbox(s.autoLockEnabled);
    const pinLock = checkbox(s.pinLockEnabled);
    const timeout = C.input(s.sessionTimeoutMinutes || 15, { type: 'number' });
    const backupEnabled = checkbox(s.backupEnabled);
    const backupTime = C.input(s.backupTime || '23:00', { type: 'time' });
    const retention = C.input(s.backupRetentionDays || 30, { type: 'number' });
    const backupOnExit = checkbox(s.backupOnExitEnabled !== false);
    const notifEnabled = checkbox(s.notificationsEnabled);
    const urgentEnabled = checkbox(s.urgentAlertsEnabled);
    const urgentInterval = C.input(s.urgentAlertIntervalMinutes || 30, { type: 'number' });
    const prioritySel = (() => { const x = EG.helpers.prioritySelect(s.defaultPriority || 'medium'); return x; })();
    const pinIn = C.input('', { type: 'password', placeholder: '••••' });

    const tabBar = U.el('div', { class: 'tab-bar', style: 'display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap' });
    const content = U.el('div');

    const tabs = {
      appearance: C.card([C.fieldWrap(t('theme'), themeSel), C.fieldWrap(t('language'), langSel)]),
      company: C.card([C.fieldWrap(t('companyName') + ' (AR)', companyAr), C.fieldWrap(t('companyName') + ' (EN)', companyEn), C.fieldWrap(t('companyAddress'), addr), C.fieldWrap(t('companyPhone'), phone)]),
      security: C.card([
        C.fieldWrap(t('requireLogin'), reqLogin),
        C.fieldWrap(t('autoLock'), autoLock),
        C.fieldWrap(t('sessionTimeout'), timeout),
        C.fieldWrap(t('pinLock'), pinLock),
        C.fieldWrap(t('pin'), pinIn),
      ]),
      backup: C.card([C.fieldWrap(t('backupEnabled'), backupEnabled), C.fieldWrap(t('backupTime'), backupTime), C.fieldWrap(t('retentionDays'), retention), C.fieldWrap(t('backupOnExit'), backupOnExit)]),
      general: C.card([
        C.fieldWrap(t('notificationsEnabled'), notifEnabled),
        C.fieldWrap(t('urgentAlerts'), urgentEnabled),
        C.fieldWrap(t('urgentInterval'), urgentInterval),
        C.fieldWrap(t('defaultPriority'), prioritySel),
      ]),
    };

    function activate(key) {
      U.clear(content);
      content.appendChild(tabs[key]);
      Array.from(tabBar.children).forEach((b) => b.classList.toggle('active', b.dataset.tab === key));
    }
    [['appearance', t('appearance')], ['company', t('company')], ['security', t('security')], ['backup', t('backup')], ['general', t('general')]].forEach(([key, label]) => {
      const b = U.el('button', { class: 'tab-btn', text: label, dataset: { tab: key }, onclick: () => activate(key) });
      tabBar.appendChild(b);
    });

    view.appendChild(C.pageHeader(t('settings'), [
      C.button(t('save'), { icon: 'save', onClick: save }),
    ]));
    view.appendChild(tabBar);
    view.appendChild(content);
    activate('appearance');

    function checkbox(val) {
      const wrap = U.el('label', { class: 'switch' });
      const input = U.el('input', { type: 'checkbox' });
      input.checked = !!val;
      wrap.appendChild(input);
      wrap.appendChild(U.el('span', { class: 'slider' }));
      return wrap;
    }

    async function save() {
      const payload = {
        theme: themeSel.value,
        language: langSel.value,
        companyName: { ar: companyAr.value.trim(), en: companyEn.value.trim() },
        companyAddress: addr.value,
        companyPhone: phone.value,
        requireLogin: true,
        autoLockEnabled: autoLock.querySelector('input').checked,
        sessionTimeoutMinutes: Number(timeout.value) || 15,
        pinLockEnabled: pinLock.querySelector('input').checked,
        backupEnabled: backupEnabled.querySelector('input').checked,
        backupTime: backupTime.value,
        backupRetentionDays: Number(retention.value) || 30,
        backupOnExitEnabled: backupOnExit.querySelector('input').checked,
        notificationsEnabled: notifEnabled.querySelector('input').checked,
        urgentAlertsEnabled: urgentEnabled.querySelector('input').checked,
        urgentAlertIntervalMinutes: Number(urgentInterval.value) || 30,
        defaultPriority: prioritySel.value,
      };
      try {
        await EG.api.settings.update(payload);
        if (pinLock.querySelector('input').checked && pinIn.value) await EG.api.auth.setPin(pinIn.value);
        C.toast(t('settingsSaved'));
        EG.i18n.setLang(payload.language);
        EG.theme.apply(payload.theme);
        document.getElementById('themeToggle').innerHTML = EG.icon(payload.theme === 'dark' ? 'sun' : 'moon', 20);
        EG.router.refreshNav();
        EG.router.rerender();
        if (EG.app.updateAppTitle) EG.app.updateAppTitle();
      } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
    }
  },
};
