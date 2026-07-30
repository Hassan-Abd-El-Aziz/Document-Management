'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.backup = {
  id: 'backup',
  title: 'backup',
  icon: 'backup',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const backups = await EG.api.backup.list();
      view.appendChild(C.pageHeader(t('backup'), [
        C.button(t('createBackup'), { icon: 'backup', onClick: () => runCreate() }),
        C.button(t('restoreBackup'), { icon: 'restore', variant: 'ghost', onClick: () => pickAndRestore() }),
      ]));

      const cards = U.el('div', { class: 'grid grid-3 stagger' });
      const counts = { daily: 0, monthly: 0, manual: 0 };
      backups.forEach((b) => { counts[b.type] = (counts[b.type] || 0) + 1; });
      ['daily', 'monthly', 'manual'].forEach((type) => {
        cards.appendChild(C.statCard('backup', counts[type] || 0, t(type), type === 'daily' ? 'green' : type === 'monthly' ? 'blue' : 'purple'));
      });
      view.appendChild(cards);

      const table = C.table(
        [t('backupType'), t('fileName'), t('size'), t('createdAt'), t('actions')],
        backups,
        {
          renderRow: (b) => {
            const actions = U.el('div', { class: 'row-actions' }, [
              C.iconButton('restore', { title: t('restoreBackup'), variant: 'action', onClick: () => C.confirm(t('confirmRestore'), async () => {
                try { await EG.api.backup.restore(b._id); C.toast(t('willRestart')); } catch (e2) { C.toast(EG.api.errMessage(e2), 'error'); }
              }) }),
              EG.helpers.canDelete() ? C.iconButton('trash', { title: t('delete'), variant: 'danger', onClick: () => C.confirm(t('confirmDelete'), async () => {
                try { await EG.api.backup.del(b._id); C.toast(t('deleted')); EG.router.navigate('backup'); }
                catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
              }) }) : null,
            ]);
            return U.el('tr', {}, [
              td(t(b.type), 'cell-title'), td(b.fileName || '-'), td(EG.utils.bytes(b.size)),
              td(EG.utils.formatDateTime(b.createdAt, EG.state.lang), 'cell-soft'), td('', '', actions),
            ]);
          },
        }
      );
      view.appendChild(backups.length ? table : C.emptyState('backup', t('emptyState')));
    } catch (e) { view.appendChild(C.emptyState('error', EG.api.errMessage(e))); }

    function runCreate() {
      const m = C.modal(t('createBackup'), U.el('div', {}, [C.loadingBlock()]), { hideFooter: true });
      EG.api.backup.create('manual').then((r) => {
        m.close();
        C.toast(t('saved') + ': ' + (r.filename || r.fileName || ''));
        EG.router.navigate('backup');
      }).catch((err) => { m.close(); C.toast(EG.api.errMessage(err), 'error'); });
    }

    function pickAndRestore() {
      C.confirm(t('confirmRestore'), async () => {
        try {
          const res = await EG.api.file.pick({ filters: [{ name: 'Backup', extensions: ['egbackup', 'zip'] }] });
          if (res.canceled || !res.paths.length) return;
          const m = C.modal(t('restoreBackup'), U.el('div', {}, [C.loadingBlock()]), { hideFooter: true });
          try {
            await EG.api.backup.restoreFile(res.paths[0]);
            m.close();
            C.toast(t('willRestart'));
          } catch (err) { m.close(); C.toast(EG.api.errMessage(err), 'error'); }
        } catch (err) { C.toast(EG.api.errMessage(err), 'error'); }
      });
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }
  },
};
