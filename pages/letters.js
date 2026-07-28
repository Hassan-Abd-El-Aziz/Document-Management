'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.letters = {
  id: 'letters',
  title: 'letters',
  icon: 'inbox',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);

    U.clear(view);
    const container = U.el('div');
    view.appendChild(C.pageHeader(t('letters')));
    view.appendChild(container);
    container.appendChild(C.loadingBlock());

    let all = [];
    try {
      const [inc, out] = await Promise.all([EG.api.incoming.list(), EG.api.outgoing.list()]);
      all = [
        ...(inc || []).map((d) => ({ ...d, kind: 'incoming' })),
        ...(out || []).map((d) => ({ ...d, kind: 'outgoing' })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      container.appendChild(C.emptyState('error', EG.api.errMessage(e)));
      return;
    }

    const OVERDUE_DAYS = 7;
    const dayMs = 86400000;
    const daysBetween = (a, b) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / dayMs));

    function levelColor(item) {
      if (item.kind === 'outgoing' && item.receipt && item.receipt.signatureImagePath) return 'var(--green)';
      if (item.deliveryStatus === 'delivered' || item.deliveryStatus === 'rejected' || item.deliveryStatus === 'cancelled') return 'var(--green)';
      if (item.deliveryStatus === 'pending') return daysBetween(item.createdAt, Date.now()) > OVERDUE_DAYS ? 'var(--red)' : 'var(--amber)';
      return 'var(--green)';
    }

    function confidentiality(item) {
      if (item.priority === 'urgent') return { label: t('confidential'), color: 'var(--red)' };
      if (item.priority === 'high') return { label: t('limited'), color: 'var(--amber)' };
      return { label: t('normal'), color: 'var(--green)' };
    }

    function completion(item) {
      if (item.deliveryStatus === 'delivered' || item.deliveryStatus === 'rejected' || item.deliveryStatus === 'cancelled') return 100;
      const steps = (item.history || []).length;
      return Math.min(90, Math.max(10, steps * 25));
    }

    function lastMovement(item) {
      const h = item.history || [];
      return h.length ? h[h.length - 1] : null;
    }

    function entityOf(item) {
      if (item.kind === 'incoming') return item.fromEntity || item.toEntity || '-';
      return item.sentTo || item.toEntity || item.fromEntity || '-';
    }

    function employeeOf(item) {
      if (item.kind === 'incoming') return item.receivedBy || '-';
      return item.receiver || item.deliveredBy || '-';
    }

    function stayDays(item) {
      const lm = lastMovement(item);
      const since = lm && lm.at ? lm.at : item.createdAt;
      return daysBetween(since, Date.now());
    }

    const filters = U.el('div', { style: 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px' });
    const searchIn = C.input('', { placeholder: t('search'), style: 'flex:2;min-width:200px' });
    const typeSel = C.select([
      { value: '', label: t('all') },
      { value: 'incoming', label: t('incoming') },
      { value: 'outgoing', label: t('outgoing') },
    ], '');
    const statusSel = C.select([
      { value: '', label: t('all') },
      { value: 'pending', label: t('pending') },
      { value: 'delivered', label: t('delivered') },
      { value: 'rejected', label: t('rejected') },
      { value: 'cancelled', label: t('cancelled') },
    ], '');
    const { select: deptSel } = await EG.helpers.deptOptions();

    filters.appendChild(searchIn);
    filters.appendChild(typeSel);
    filters.appendChild(statusSel);
    filters.appendChild(deptSel);

    const tableWrap = U.el('div');

    container.innerHTML = '';
    container.appendChild(filters);
    container.appendChild(tableWrap);

    function dot(color) {
      return U.el('span', { style: `display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-inline-end:8px;flex-shrink:0` });
    }

    function progressBar(pct, color) {
      return U.el('div', { class: 'mini-progress' }, [
        U.el('div', { class: 'mini-progress-fill', style: `width:${pct}%;background:${color}` }),
        U.el('span', { class: 'mini-progress-label', text: pct + '%' }),
      ]);
    }

    function render() {
      const q = searchIn.value.trim().toLowerCase();
      const ftype = typeSel.value;
      const fstatus = statusSel.value;
      const fdept = deptSel.value;

      const rows = all.filter((d) => {
        if (ftype && d.kind !== ftype) return false;
        if (fstatus && d.deliveryStatus !== fstatus) return false;
        if (fdept && (d.departmentCode || 'GEN') !== fdept) return false;
        if (q) {
          const hay = [d.letterNumber, d.subject, entityOf(d), d.fileNumber, (d.tags || []).join(' ')].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const columns = [
        t('regNo'), t('letterNo'), t('letterType'), t('incoming'), t('outgoing'), t('entity'),
        t('currentDept'), t('currentEmployee'), t('createdDate'), t('lastMovement'),
        t('stayDuration'), t('status'), t('completion'), t('confidentiality'), t('priority'), t('details'),
      ];

      const body = rows.length ? C.table(columns, rows, { renderRow: (item) => {
        const color = levelColor(item);
        const lm = lastMovement(item);
        const conf = confidentiality(item);
        const td = (children, cls) => U.el('td', { class: cls || '' }, Array.isArray(children) ? children : [children]);
        return U.el('tr', {}, [
          td([dot(color), U.el('span', { text: String(rows.indexOf(item) + 1) })]),
          td(item.letterNumber || item.fileNumber || '-', 'cell-title'),
          td(C.badge(item.kind === 'incoming' ? t('incoming') : t('outgoing'), item.kind === 'incoming' ? 'info' : 'purple')),
          td(item.kind === 'incoming' ? U.el('span', { html: EG.icon('check', 16), style: 'color:var(--green)' }) : ''),
          td(item.kind === 'outgoing' ? U.el('span', { html: EG.icon('check', 16), style: 'color:var(--purple)' }) : ''),
          td(entityOf(item)),
          td(item.departmentCode || 'GEN'),
          td(employeeOf(item)),
          td(EG.utils.formatDate(item.createdAt, EG.state.lang), 'cell-soft'),
          td(lm ? (t(lm.action) || lm.action) + ' · ' + EG.utils.relTime(lm.at, EG.state.lang) : '-', 'cell-soft'),
          td(stayDays(item) + ' ' + (stayDays(item) === 1 ? t('day') : t('days'))),
          td('', '', C.statusBadge(item.deliveryStatus)),
          td(progressBar(completion(item), color), ''),
          td(U.el('span', { class: 'badge', style: `background:${conf.color}22;color:${conf.color}`, text: conf.label })),
          td('', '', C.priorityBadge(item.priority)),
          td('', '', C.iconButton('history', { title: t('details'), onClick: () => openDrawer(item) })),
        ]);
      } }) : C.emptyState('inbox', t('noResults'));

      U.clear(tableWrap);
      tableWrap.appendChild(body);
    }

    function openDrawer(item) {
      const color = levelColor(item);
      const conf = confidentiality(item);
      const overlay = U.el('div', { class: 'drawer-overlay' });
      const drawer = U.el('div', { class: 'drawer' });

      const close = () => {
        overlay.classList.remove('show');
        drawer.classList.remove('show');
        setTimeout(() => { overlay.remove(); drawer.remove(); }, 280);
      };
      overlay.addEventListener('click', close);

      const header = U.el('div', { class: 'drawer-header' }, [
        U.el('div', {}, [
          U.el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
            dot(color),
            U.el('h3', { text: item.letterNumber || item.fileNumber || '' }),
            C.badge(item.kind === 'incoming' ? t('incoming') : t('outgoing'), item.kind === 'incoming' ? 'info' : 'purple'),
          ]),
          U.el('div', { class: 'cell-soft', style: 'margin-top:4px', text: EG.utils.localize(item.subject || item.title, EG.state.lang) || '' }),
        ]),
        C.iconButton('close', { onClick: close }),
      ]);

      const meta = U.el('div', { class: 'drawer-meta' }, [
        metaRow(t('entity'), entityOf(item)),
        metaRow(t('currentDept'), item.departmentCode || 'GEN'),
        metaRow(t('currentEmployee'), employeeOf(item)),
        metaRow(t('status'), '' , C.statusBadge(item.deliveryStatus)),
        metaRow(t('priority'), '' , C.priorityBadge(item.priority)),
        metaRow(t('confidentiality'), conf.label),
        metaRow(t('createdDate'), EG.utils.formatDate(item.createdAt, EG.state.lang)),
      ]);

      const timelineWrap = U.el('div', {}, [
        U.el('h4', { style: 'margin:18px 0 10px', text: EG.icon('history', 16) + ' ' + t('timeline') }),
        buildTimeline(item),
      ]);

      const body = U.el('div', { class: 'drawer-body' }, [meta, timelineWrap]);
      if (item.filePath) {
        body.appendChild(C.button(t('openFile'), { icon: 'file', variant: 'ghost', size: 'sm', onClick: () => EG.api.file.open(item.filePath).catch(() => C.toast(t('fileNotFound'), 'error')) }));
      }

      drawer.appendChild(header);
      drawer.appendChild(body);
      document.body.appendChild(overlay);
      document.body.appendChild(drawer);
      requestAnimationFrame(() => { overlay.classList.add('show'); drawer.classList.add('show'); });

      function metaRow(label, value, node) {
        return U.el('div', { class: 'meta-row' }, [
          U.el('span', { class: 'meta-label', text: label }),
          node || U.el('span', { class: 'meta-value', text: String(value ?? '-') }),
        ]);
      }
    }

    function buildTimeline(item) {
      const h = item.history || [];
      const wrap = U.el('div', { class: 'timeline' });
      if (!h.length) {
        wrap.appendChild(U.el('div', { class: 'cell-soft', text: t('noResults') }));
        return wrap;
      }
      h.forEach((step, i) => {
        const node = U.el('div', { class: 'timeline-step' }, [
          U.el('span', { class: 'timeline-dot' }),
          U.el('div', { class: 'timeline-title', text: `${i + 1}. ${t(step.action) || step.action}` }),
          U.el('div', { class: 'timeline-meta', text: `${EG.utils.formatDate(step.at, EG.state.lang)} · ${EG.utils.relTime(step.at, EG.state.lang)}` }),
          U.el('div', { class: 'timeline-meta', html: `<strong>${t('employee')}:</strong> ${step.by || '-'} ${step.status ? '· ' + t(step.status) : ''}` }),
          step.note ? U.el('div', { class: 'timeline-note', text: step.note }) : null,
        ]);
        wrap.appendChild(node);
      });
      return wrap;
    }

    [searchIn, typeSel, statusSel, deptSel].forEach((el) => el.addEventListener('input', render));
    deptSel.addEventListener('change', render);
    render();
  },
};
