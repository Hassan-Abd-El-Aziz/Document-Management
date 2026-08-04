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
      const pendingCard = C.card([
        U.el('div', { class: 'card-title', text: t('pendingLetters') }),
        U.el('div', { style: 'font-size:28px;font-weight:700;color:var(--amber);margin:6px 0' }, [U.el('span', { text: String(s.pendingLetters || 0) })]),
        U.el('div', { style: 'display:flex;gap:12px;font-size:12px;color:var(--muted)' }, [
          U.el('span', { text: `${t('incomingLetters')}: ${s.pendingIn || 0}` }),
          U.el('span', { text: `${t('outgoingLetters')}: ${s.pendingOut || 0}` }),
        ]),
      ]);

      const grid = C.grid([
        C.statCard('departments', s.departments, t('totalDepartments'), 'green'),
        C.statCard('documents', s.documents, t('totalDocuments'), 'blue'),
        C.statCard('incoming', s.incoming, t('incomingLetters'), 'purple'),
        C.statCard('outgoing', s.outgoing, t('outgoingLetters'), 'amber'),
        pendingCard,
        C.statCard('check', s.deliveredLetters, t('deliveredLetters'), 'green'),
        C.statCard('archive', s.borrowedLendings, t('borrowedLendings'), 'red'),
      ], 'grid-4 stagger');

      const quick = C.card([
        U.el('div', { class: 'card-title', html: EG.icon('bolt', 18) + '<span>' + t('quickActions') + '</span>' }),
        U.el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' }, [
          C.button(t('newDocument'), { icon: 'documents', onClick: () => EG.router.navigate('documents') }),
          C.button(t('newIncoming'), { icon: 'incoming', onClick: () => EG.router.navigate('incoming') }),
          C.button(t('newOutgoing'), { icon: 'outgoing', onClick: () => EG.router.navigate('outgoing') }),
          C.button(t('newLending'), { icon: 'archive', onClick: () => EG.router.navigate('lending') }),
          C.button(t('newDepartment'), { icon: 'departments', onClick: () => EG.router.navigate('departments') }),
          C.button(t('qr'), { icon: 'qr', onClick: () => EG.router.navigate('qr') }),
          C.button(t('createBackup'), { icon: 'backup', variant: 'blue', onClick: () => EG.router.navigate('backup') }),
        ]),
      ]);

      const chartCard = U.el('div', { class: 'card chart-card' }, [
        U.el('div', { class: 'card-title', html: EG.icon('reports', 18) + '<span>' + t('charts') + '</span>' }),
        U.el('div', { class: 'chart-print-area', style: 'display:flex;gap:20px;align-items:center;flex-wrap:wrap' }, [
          C.pieChart([
            { value: s.documents, color: 'var(--green)', label: t('documents') },
            { value: s.outgoing, color: 'var(--purple)', label: t('outgoingLetters') },
            { value: s.incoming, color: 'var(--blue2)', label: t('incomingLetters') },
            { value: s.pendingLetters, color: 'var(--amber)', label: t('pendingLetters') },
            { value: s.borrowedLendings, color: 'var(--red)', label: t('borrowedLendings') },
            { value: s.deliveredLetters, color: 'var(--green2)', label: t('deliveredLetters') },
          ]),
          U.el('div', { style: 'flex:1;min-width:180px' }, [
            U.el('div', { class: 'chart-legend', style: 'display:flex;flex-direction:column;gap:8px' }, [
              legendItem('var(--green)', t('documents') + ': ' + s.documents),
              legendItem('var(--purple)', t('outgoingLetters') + ': ' + s.outgoing),
              legendItem('var(--blue2)', t('incomingLetters') + ': ' + s.incoming),
              legendItem('var(--amber)', t('pendingLetters') + ': ' + s.pendingLetters),
              legendItem('var(--red)', t('borrowedLendings') + ': ' + s.borrowedLendings),
              legendItem('var(--green2)', t('deliveredLetters') + ': ' + s.deliveredLetters),
            ]),
            U.el('button', { class: 'btn btn-ghost', onclick: () => {
              const printArea = document.querySelector('.chart-print-area');
              if (!printArea) { C.toast('Chart area not found', 'error'); return; }
              const container = document.querySelector('.chart-card');
              if (!container) { C.toast('Chart card not found', 'error'); return; }

              const iframe = document.createElement('iframe');
              iframe.setAttribute('aria-hidden', 'true');
              iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
              document.body.appendChild(iframe);

              const chartHTML = printArea.innerHTML
                .replace(/transform:\s*scale\(0\)/g, 'transform: scale(1)')
                .replace(/stroke-dasharray:[^;]+;/g, '')
                .replace(/stroke-dashoffset:[^;]+;/g, '');

              const d = iframe.contentWindow.document;
              d.open();
              d.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Charts</title>
                <style>
                  * { box-sizing: border-box; }
                  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 30px; display: flex; flex-direction: column; align-items: center; }
                  .chart-print-area { display: flex !important; gap: 50px !important; align-items: center !important; flex-wrap: wrap !important; justify-content: center !important; }
                  .pie-wrap { width: 300px !important; height: 300px !important; flex-shrink: 0; }
                  .pie { width: 100% !important; height: 100% !important; }
                  .pie path { transform: scale(1) !important; transition: none !important; }
                  .chart-legend { display: flex !important; flex-direction: column !important; gap: 10px !important; font-size: 16px !important; }
                  .legend-item { display: flex !important; align-items: center !important; gap: 10px !important; font-size: 16px !important; }
                  .legend-dot { width: 16px !important; height: 16px !important; border-radius: 4px !important; display: inline-block !important; }
                  .card-title { font-size: 20px !important; font-weight: bold !important; margin-bottom: 20px !important; width: 100% !important; text-align: center !important; }
                  svg { overflow: visible !important; }
                </style>
              </head><body>
                <div class="card-title">${container.querySelector('.card-title') ? container.querySelector('.card-title').innerHTML : ''}</div>
                <div class="chart-print-area">${chartHTML}</div>
              </body></html>`);
              d.close();
              const doPrint = () => {
                try {
                  iframe.contentWindow.focus();
                  iframe.contentWindow.print();
                } catch (_) {}
                setTimeout(() => iframe.remove(), 1500);
              };
              setTimeout(doPrint, 400);
            }, style: 'margin-top:10px' }, [
              U.el('span', { class: 'btn-icon', html: EG.icon('print', 18) }),
              U.el('span', { text: t('print') }),
            ]),
          ]),
        ]),
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
      view.appendChild(U.el('div', { style: 'height:10px' }));
      view.appendChild(C.grid([quick], ''));
      view.appendChild(U.el('div', { style: 'height:10px' }));
      view.appendChild(C.grid([chartCard], ''));
      view.appendChild(U.el('div', { style: 'height:10px' }));
      view.appendChild(C.grid([lendingCard], ''));
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
