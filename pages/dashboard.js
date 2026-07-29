'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.dashboard = {
  id: 'dashboard',
  title: 'dashboard',
  icon: 'dashboard',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const s = await EG.api.stats.dashboard();
      const grid = C.grid([
        C.statCard('departments', s.departments, t('totalDepartments'), 'green'),
        C.statCard('documents', s.documents, t('totalDocuments'), 'blue'),
        C.statCard('incoming', s.incoming, t('incomingLetters'), 'purple'),
        C.statCard('outgoing', s.outgoing, t('outgoingLetters'), 'amber'),
        C.statCard('inbox', s.pendingLetters, t('pendingLetters'), 'amber'),
        C.statCard('check', s.deliveredLetters, t('deliveredLetters'), 'green'),
        C.statCard('archive', s.borrowedLendings, t('borrowedLendings'), 'red'),
        C.statCard('bell', s.todayActivities, t('todayActivities'), 'blue'),
      ], 'grid-4 stagger');

      const quick = C.card([
        U.el('div', { class: 'card-title', html: EG.icon('bolt', 18) + '<span>' + t('quickActions') + '</span>' }),
        U.el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' }, [
          C.button(t('newDocument'), { icon: 'documents', onClick: () => EG.router.navigate('documents') }),
          C.button(t('newIncoming'), { icon: 'incoming', onClick: () => EG.router.navigate('incoming') }),
          C.button(t('newOutgoing'), { icon: 'outgoing', onClick: () => EG.router.navigate('outgoing') }),
          C.button(t('newLending'), { icon: 'archive', onClick: () => EG.router.navigate('lending') }),
          C.button(t('newDepartment'), { icon: 'departments', onClick: () => EG.router.navigate('departments') }),
          C.button(t('createBackup'), { icon: 'backup', variant: 'blue', onClick: () => EG.router.navigate('backup') }),
          C.button(t('emaillog'), { icon: 'email', variant: 'blue', onClick: () => EG.router.navigate('emaillog') }),
        ]),
      ]);

      const chartCard = C.card([
        U.el('div', { class: 'card-title', html: EG.icon('reports', 18) + '<span>' + t('dailyStats') + '</span>' }),
        C.barChart(s.daily),
        U.el('div', { class: 'legend', style: 'flex-direction:row;gap:18px;margin-top:14px' }, [
          legendItem('var(--green)', t('documents')),
          legendItem('var(--blue)', t('incoming')),
          legendItem('var(--purple)', t('outgoing')),
        ]),
      ]);

      const donutCard = C.card([
        U.el('div', { class: 'card-title', html: EG.icon('archive', 18) + '<span>' + t('charts') + '</span>' }),
        U.el('div', { style: 'display:flex;gap:20px;align-items:center;flex-wrap:wrap;justify-content:center' }, [
          C.donutChart([
            { value: s.pendingLetters, color: 'var(--amber)', label: t('pending') },
            { value: s.deliveredLetters, color: 'var(--green)', label: t('delivered') },
            { value: Math.max(1, s.documents - s.pendingLetters - s.deliveredLetters), color: 'var(--blue)', label: t('documents') },
          ], { centerLabel: t('letters') }),
          U.el('div', { class: 'legend' }, [
            legendItem('var(--amber)', t('pendingLetters') + ': ' + s.pendingLetters),
            legendItem('var(--green)', t('deliveredLetters') + ': ' + s.deliveredLetters),
            legendItem('var(--blue)', t('totalDocuments') + ': ' + s.documents),
          ]),
        ]),
      ]);

      const recentCard = C.card([
        U.el('div', { class: 'card-title', html: EG.icon('documents', 18) + '<span>' + t('recentDocuments') + '</span>' }),
        s.recentDocs.length ? U.el('div', { class: 'table-wrap' }, U.el('table', { class: 'table' }, [
          U.el('thead', {}, U.el('tr', {}, [th(t('fileNumber')), th(t('title')), th(t('department')), th(t('date'))])),
          U.el('tbody', {}, s.recentDocs.map((d) => U.el('tr', {}, [
            td(d.fileNumber), td(EG.utils.localize(d.title, EG.state.lang), 'cell-title'), td(d.departmentCode || 'GEN'), td(EG.utils.formatDate(d.createdAt, EG.state.lang), 'cell-soft'),
          ]))),
        ])) : C.emptyState('documents', t('emptyState')),
      ]);

      const logsCard = C.card([
        U.el('div', { class: 'card-title', html: EG.icon('logs', 18) + '<span>' + t('auditLog') + '</span>' }),
        s.recentLogs.length ? U.el('div', { class: 'table-wrap' }, U.el('table', { class: 'table dense' }, [
          U.el('thead', {}, U.el('tr', {}, [th(t('action')), th(t('entity')), th(t('user')), th(t('time'))])),
          U.el('tbody', {}, s.recentLogs.map((l) => U.el('tr', {}, [
            td(t(l.action) || l.action), td(l.entity), td(l.userName || '-'), td(EG.utils.relTime(l.timestamp, EG.state.lang), 'cell-soft'),
          ]))),
        ])) : C.emptyState('logs', t('emptyState')),
      ]);

      const lendingCard = C.card([
        U.el('div', { class: 'card-title', html: EG.icon('archive', 18) + '<span>' + t('lendingHistory') + '</span>' }),
        s.lendingHistory && s.lendingHistory.length ? U.el('div', { class: 'table-wrap' }, U.el('table', { class: 'table dense' }, [
          U.el('thead', {}, U.el('tr', {}, [th(t('itemName')), th(t('borrowerName')), th(t('borrowerDepartment')), th(t('status')), th(t('requestDate'))])),
          U.el('tbody', {}, s.lendingHistory.map((l) => U.el('tr', {}, [
            td(l.itemName || '-', 'cell-title'),
            td(l.borrowerName || '-'),
            td(l.borrowerDepartment || '-'),
            td('', '', C.statusBadge(t(l.status) || l.status)),
            td(l.requestDate ? EG.utils.formatDate(l.requestDate, EG.state.lang) : '-', 'cell-soft'),
          ]))),
        ])) : C.emptyState('lending', t('emptyState')),
      ]);

      view.appendChild(grid);
      view.appendChild(C.grid([quick], ''));
      view.appendChild(C.grid([chartCard, donutCard], 'grid-2'));
      view.appendChild(C.grid([recentCard, logsCard, lendingCard], ''));
    } catch (e) {
      view.appendChild(C.emptyState('error', EG.api.errMessage(e)));
    }

    function th(txt) { return U.el('th', { text: txt }); }
    function td(txt, cls) { return U.el('td', { class: cls || '', text: String(txt ?? '') }); }
    function legendItem(color, label) {
      return U.el('div', { class: 'legend-item' }, [U.el('span', { class: 'legend-dot', style: `background:${color}` }), U.el('span', { text: label })]);
    }
  },
};
