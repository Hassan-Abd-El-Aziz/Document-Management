'use strict';

window.EG = window.EG || {};

EG.activation = (function () {
  const U = EG.utils;
  const t = (k) => EG.i18n.t(k);

  let status = {};
  let isProcessing = false;

  async function init() {
    EG.i18n.setLang('ar');
    EG.i18n.applyStatic();

    try {
      status = await window.eg.invoke('activation.status');
      renderMachineInfo(status);
    } catch (e) {
      console.error('Failed to load activation status:', e);
    }

    bindForm();
    const codeInput = document.getElementById('activationCode');
    if (codeInput) setTimeout(() => codeInput.focus(), 300);
  }

  function renderMachineInfo(info) {
    const idEl = document.getElementById('machineIdDisplay');
    const nameEl = document.getElementById('machineName');
    if (idEl) idEl.textContent = info.machineIdDisplay || '-';
    if (nameEl) nameEl.textContent = info.hostname || '-';
  }

  function bindForm() {
    const form = document.getElementById('activationForm');
    const codeInput = document.getElementById('activationCode');
    const errorEl = document.getElementById('activationError');
    const btn = document.getElementById('activateBtn');
    const btnIcon = document.getElementById('activateBtnIcon');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isProcessing) return;
      const code = (codeInput.value || '').trim();

      if (!code) {
        showError(t('activationCodeRequired'));
        codeInput.focus();
        return;
      }

      isProcessing = true;
      btn.disabled = true;
      btnIcon.innerHTML = EG.icon('save', 16);

      try {
        const result = await window.eg.invoke('activation.activate', { code });
        if (result && result.ok) {
          showSuccess(t('activationSuccess'));
          setTimeout(() => {
            if (typeof window.eg.sendActivationSuccess === 'function') {
              window.eg.sendActivationSuccess();
            } else {
              window.location.reload();
            }
          }, 2000);
        } else {
          showError(t('activationFailed') + ': ' + (result?.error || t('activationInvalid')));
        }
      } catch (err) {
        showError(t('activationError') + ': ' + (err.message || t('activationInvalid')));
      } finally {
        isProcessing = false;
        btn.disabled = false;
        btnIcon.innerHTML = '';
      }
    });
  }

  function showError(msg) {
    const el = document.getElementById('activationError');
    if (!el) return;
    el.textContent = msg;
    el.className = 'activation-error show';
    setTimeout(() => el.classList.remove('show'), 6000);
  }

  function showSuccess(msg) {
    const el = document.getElementById('activationError');
    if (!el) return;
    el.textContent = msg;
    el.className = 'activation-success show';
    setTimeout(() => el.classList.remove('show'), 6000);
  }

  return { init, renderMachineInfo };
})();

document.addEventListener('DOMContentLoaded', () => EG.activation.init());
