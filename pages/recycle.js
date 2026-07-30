'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.recycle = {
  id: 'recycle',
  title: 'recycle',
  icon: 'recycle',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const items = await EG.api.recycle.list();
      view.appendChild(C.pageHeader(t('recycle'), [
        EG.helpers.canDelete() ? C.button(t('emptyRecycle'), { icon: 'trash', variant: 'danger', onClick: () => C.confirm(t('confirmEmpty'), async () => {
          try { await EG.api.recycle.empty(); C.toast(t('deleted')); EG.router.navigate('recycle'); }
          catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
        }) }) : null,
      ]));
      const table = C.table(
        [t('type'), t('number'), t('title'), t('deletedAt'), t('actions')],
        items,
        {
          renderRow: (d) => {
            const actions = U.el('div', { class: 'row-actions' }, [
              C.iconButton('restore', { title: t('restore'), onClick: async () => {
                if (d.kind === 'document') await EG.api.document.restore(d._id);
                else if (d.kind === 'incoming') await EG.api.incoming.restore(d._id);
                else await EG.api.outgoing.restore(d._id);
                C.toast(t('restored')); EG.router.navigate('recycle');
              } }),
              EG.helpers.canDelete() ? C.iconButton('trash', { title: t('permanentDelete'), variant: 'danger', onClick: () => C.confirm(t('confirmDelete'), async () => {
                try {
                  if (d.kind === 'document') await EG.api.document.hardDelete(d._id);
                  else if (d.kind === 'incoming') await EG.api.incoming.hardDelete(d._id);
                  else await EG.api.outgoing.hardDelete(d._id);
                  C.toast(t('deleted')); EG.router.navigate('recycle');
                } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
              }) }) : null,
            ]);
            const title = d.kind === 'document' ? EG.utils.localize(d.title, EG.state.lang) : EG.utils.localize(d.subject, EG.state.lang);
            const num = d.fileNumber || d.letterNumber;
            return U.el('tr', {}, [
              td(t(d.kind), 'cell-title'), td(num), td(title), td(EG.utils.formatDateTime(d.deletedAt, EG.state.lang), 'cell-soft'), td('', '', actions),
            ]);
          },
        }
      );
      view.appendChild(items.length ? table : C.emptyState('recycle', t('emptyState')));
    } catch (e) { view.appendChild(C.emptyState('error', EG.api.errMessage(e))); }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }
  },
};
