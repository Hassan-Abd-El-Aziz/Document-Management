'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.notifications = {
  id: 'notifications',
  title: 'notifications',
  icon: 'bell',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const [pendingIn, pendingOut, urgentIn, urgentOut] = await Promise.all([
        EG.api.incoming.list('deliveryStatus == $0 AND deleted == false', { $0: 'pending' }),
        EG.api.outgoing.list('deliveryStatus == $0 AND deleted == false', { $0: 'pending' }),
        EG.api.incoming.list('deliveryStatus == $0 AND priority == $1 AND deleted == false', { $0: 'pending', $1: 'urgent' }),
        EG.api.outgoing.list('deliveryStatus == $0 AND priority == $1 AND deleted == false', { $0: 'pending', $1: 'urgent' }),
      ]);

      const allLetters = [
        ...pendingIn.map((l) => ({ ...l, _dir: 'incoming' })),
        ...pendingOut.map((l) => ({ ...l, _dir: 'outgoing' })),
      ];
      const allUrgent = [
        ...urgentIn.map((l) => ({ ...l, _dir: 'incoming' })),
        ...urgentOut.map((l) => ({ ...l, _dir: 'outgoing' })),
      ];

      view.appendChild(C.pageHeader(t('notifications')));

      const stats = U.el('div', { class: 'grid grid-3 stagger', style: 'margin-bottom:18px' }, [
        C.statCard('inbox', allLetters.length, t('pendingLetters'), 'amber'),
        C.statCard('bolt', allUrgent.length, t('urgentLetters'), 'red'),
        C.statCard('check', allLetters.length - allUrgent.length, t('regularLetters'), 'blue'),
      ]);
      view.appendChild(stats);

      const container = U.el('div', { class: 'stagger' });

      container.appendChild(U.el('h3', { style: 'margin:16px 0 8px', text: t('urgentLetters') }));
      if (!allUrgent.length) {
        container.appendChild(C.emptyState('bolt', t('noResults')));
      } else {
        container.appendChild(C.table(
          [t('number'), t('subject'), t('department'), t('status'), t('priority'), t('date'), t('preview'), t('actions')],
          allUrgent,
          {
            renderRow: (d) => {
              const dateField = d._dir === 'incoming' ? d.receivedDate : d.sentDate;
              const actions = U.el('div', { class: 'row-actions' }, [
                d.filePath ? C.iconButton('eye', { title: t('preview'), onClick: () => openPreview(d) }) : null,
                C.iconButton('edit', { title: t('edit'), variant: 'action', onClick: () => openLetter(d) }),
                C.iconButton('check', { title: t('delivered'), variant: 'green', onClick: () => markDelivered(d) }),
              ]);
              return U.el('tr', {}, [
                td(d.letterNumber, 'cell-title'),
                td(EG.utils.localize(d.subject, EG.state.lang)),
                td(d.departmentCode || 'GEN'),
                td('', '', C.statusBadge(d.deliveryStatus)),
                td('', '', C.priorityBadge(d.priority)),
                td(EG.utils.formatDate(dateField, EG.state.lang), 'cell-soft'),
                td(d.filePath ? '👁' : '-'),
                td('', '', actions),
              ]);
            },
          }
        ));
      }

      const regular = allLetters.filter((l) => !allUrgent.find((u) => u._id === l._id));
      container.appendChild(U.el('h3', { style: 'margin:18px 0 8px', text: t('pendingLetters') }));
      if (!regular.length) {
        container.appendChild(C.emptyState('inbox', t('noResults')));
      } else {
        container.appendChild(C.table(
          [t('number'), t('subject'), t('department'), t('status'), t('priority'), t('date'), t('preview'), t('actions')],
          regular,
          {
            renderRow: (d) => {
              const dateField = d._dir === 'incoming' ? d.receivedDate : d.sentDate;
              const actions = U.el('div', { class: 'row-actions' }, [
                d.filePath ? C.iconButton('eye', { title: t('preview'), onClick: () => openPreview(d) }) : null,
                C.iconButton('edit', { title: t('edit'), variant: 'action', onClick: () => openLetter(d) }),
                C.iconButton('check', { title: t('delivered'), variant: 'green', onClick: () => markDelivered(d) }),
              ]);
              return U.el('tr', {}, [
                td(d.letterNumber, 'cell-title'),
                td(EG.utils.localize(d.subject, EG.state.lang)),
                td(d.departmentCode || 'GEN'),
                td('', '', C.statusBadge(d.deliveryStatus)),
                td('', '', C.priorityBadge(d.priority)),
                td(EG.utils.formatDate(dateField, EG.state.lang), 'cell-soft'),
                td(d.filePath ? '👁' : '-'),
                td('', '', actions),
              ]);
            },
          }
        ));
      }
      view.appendChild(container);

      function td(txt, cls, node) {
        if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
        return U.el('td', { class: cls || '', text: String(txt ?? '') });
      }

      async function markDelivered(l) {
        try {
          const api = l._dir === 'incoming' ? EG.api.incoming : EG.api.outgoing;
          await api.updateStatus(l._id, 'delivered', 'تسليم من الإشعارات');
          C.toast(t('saved'));
          EG.router.navigate('notifications');
        } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
      }

      function openLetter(l) {
        const page = l._dir === 'incoming' ? 'incoming' : 'outgoing';
        EG.router.navigate(page);
      }

      function openPreview(d) {
        const meta = U.el('div', { class: 'drawer-meta' }, [
          metaRow(t('number'), d.letterNumber || '-'),
          metaRow(t('subject'), '' , U.el('span', { class: 'meta-value', text: EG.utils.localize(d.subject, EG.state.lang) || '-' })),
          d._dir === 'incoming' ? metaRow(t('from'), d.fromEntity || '-') : metaRow(t('to'), d.sentTo || '-'),
          d._dir === 'incoming' ? metaRow(t('to'), d.toEntity || '-') : metaRow(t('from'), d.fromEntity || '-'),
          metaRow(t('department'), d.departmentCode || 'GEN'),
          metaRow(t('status'), '' , C.statusBadge(d.deliveryStatus)),
          metaRow(t('priority'), '' , C.priorityBadge(d.priority)),
          metaRow(t('date'), EG.utils.formatDate(d._dir === 'incoming' ? d.receivedDate : d.sentDate, EG.state.lang)),
          d.notes ? metaRow(t('notes'), d.notes) : null,
        ]);

        const preview = U.el('div', { class: 'preview-box' });
        if (d.filePath) {
          const ext = (d.filePath.split('.').pop() || '').toLowerCase();
          if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
            preview.appendChild(U.el('img', { src: 'file:///' + d.filePath.replace(/\\/g, '/'), class: 'preview-img' }));
          } else if (ext === 'pdf') {
            preview.appendChild(U.el('iframe', { src: 'file:///' + d.filePath.replace(/\\/g, '/'), class: 'preview-frame' }));
          } else {
            preview.appendChild(U.el('div', { class: 'cell-soft', style: 'padding:20px' }, [
              U.el('p', { text: d.filePath.split(/[\\/]/).pop() }),
              C.button(t('openFile'), { icon: 'file', variant: 'ghost', size: 'sm', onClick: () => EG.api.file.open(d.filePath).catch(() => C.toast(t('fileNotFound'), 'error')) }),
            ]));
          }
        } else {
          preview.appendChild(U.el('div', { class: 'cell-soft', style: 'padding:20px', text: t('emptyState') }));
        }

        const body = U.el('div', {}, [meta, U.el('h4', { style: 'margin:18px 0 10px', text: t('preview') }), preview]);
        C.modal(d.letterNumber || t('preview'), body, { size: 'xl', hideFooter: true });

        function metaRow(label, value, node) {
          return U.el('div', { class: 'meta-row' }, [
            U.el('span', { class: 'meta-label', text: label }),
            node || U.el('span', { class: 'meta-value', text: String(value ?? '-') }),
          ]);
        }
      }
    } catch (e) {
      view.appendChild(C.emptyState('error', EG.api.errMessage(e)));
    }
  },
};
