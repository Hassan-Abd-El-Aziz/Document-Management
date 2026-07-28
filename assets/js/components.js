'use strict';

window.EG = window.EG || {};
EG.state = EG.state || { lang: 'ar', theme: 'light', user: null, settings: {} };

EG.components = (function () {
  const U = EG.utils;
  const T = () => EG.i18n.t;
  const t = (k) => EG.i18n.t(k);

  function card(children, cls = '') {
    return U.el('div', { class: 'card ' + cls }, children);
  }

  function pageHeader(title, actions = []) {
    return U.el('div', { class: 'page-header' }, [
      U.el('h1', { class: 'page-title', text: typeof title === 'string' ? title : title }),
      U.el('div', { class: 'page-actions' }, actions),
    ]);
  }

  function button(label, opts = {}) {
    const b = U.el('button', {
      class: 'btn ' + (opts.variant || 'primary') + (opts.size ? ' ' + opts.size : ''),
      onclick: opts.onClick,
    }, [
      opts.icon ? U.el('span', { class: 'btn-icon', html: EG.icon(opts.icon, 18) }) : null,
      U.el('span', { text: label }),
    ]);
    if (opts.disabled) b.disabled = true;
    return b;
  }

  function iconButton(iconName, opts = {}) {
    const b = U.el('button', { class: 'icon-btn action ' + (opts.variant || ''), title: opts.title || '', onclick: opts.onClick });
    b.innerHTML = EG.icon(iconName, opts.size || 18);
    return b;
  }

  function badge(text, variant = 'neutral') {
    return U.el('span', { class: 'badge badge-' + variant, text });
  }

  function statusBadge(status) {
    const map = { pending: 'warn', received: 'info', delivered: 'success', rejected: 'danger', cancelled: 'neutral', active: 'success' };
    return badge(t(status), map[status] || 'neutral');
  }

  function priorityBadge(p) {
    const map = { low: 'neutral', medium: 'info', high: 'warn', urgent: 'danger' };
    return badge(t(p), map[p] || 'neutral');
  }

  function emptyState(iconName = 'inbox', text) {
    return U.el('div', { class: 'empty-state' }, [
      U.el('div', { class: 'empty-icon', html: EG.icon(iconName, 48) }),
      U.el('p', { text: text || t('emptyState') }),
    ]);
  }

  function spinner() {
    return U.el('div', { class: 'spinner' });
  }

  function loadingBlock() {
    return U.el('div', { class: 'loading-block' }, [spinner(), U.el('span', { text: t('loading') })]);
  }

  function fieldWrap(label, control) {
    return U.el('label', { class: 'field' }, [
      U.el('span', { class: 'field-label', text: label }),
      control,
    ]);
  }

  function input(value = '', attrs = {}) {
    return U.el('input', Object.assign({ class: 'input', value: value ?? '' }, attrs));
  }

  function textarea(value = '', attrs = {}) {
    return U.el('textarea', Object.assign({ class: 'input textarea' }, attrs), value || '');
  }

  function select(options, value, attrs = {}) {
    const sel = U.el('select', Object.assign({ class: 'input' }, attrs));
    options.forEach((o) => {
      const opt = U.el('option', { value: o.value, text: o.label });
      if (o.value === value) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  function table(columns, rows, opts = {}) {
    const thead = U.el('thead', {}, U.el('tr', {}, columns.map((c) => U.el('th', { text: typeof c === 'string' ? c : c.label, style: c.width ? `width:${c.width}` : '' }))));
    const tbody = U.el('tbody');
    if (!rows || rows.length === 0) {
      tbody.appendChild(U.el('tr', {}, U.el('td', { colspan: columns.length, class: 'table-empty', text: t('noResults') })));
    } else {
      rows.forEach((row) => {
        if (opts.renderRow) { tbody.appendChild(opts.renderRow(row)); return; }
        tbody.appendChild(U.el('tr', {}, columns.map((c) => {
          const key = typeof c === 'string' ? null : c.key;
          const render = typeof c === 'string' ? null : c.render;
          const td = U.el('td');
          if (render) td.appendChild(render(row));
          else td.textContent = key ? (row[key] ?? '') : '';
          return td;
        })));
      });
    }
    return U.el('div', { class: 'table-wrap' + (opts.dense ? ' dense' : '') }, U.el('table', { class: 'table' }, [thead, tbody]));
  }

  function toast(message, type = 'info') {
    const root = document.getElementById('toastRoot');
    const node = U.el('div', { class: 'toast toast-' + type }, [
      U.el('span', { class: 'toast-icon', html: EG.icon(type === 'error' ? 'close' : type === 'success' ? 'check' : 'bell', 18) }),
      U.el('span', { text: message }),
    ]);
    root.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 300);
    }, 3200);
  }

  function modal(title, bodyNode, opts = {}) {
    const root = document.getElementById('modalRoot');
    const overlay = U.el('div', { class: 'modal-overlay' });
    const box = U.el('div', { class: 'modal ' + (opts.size || '') });
    const header = U.el('div', { class: 'modal-header' }, [
      U.el('h3', { text: title }),
      iconButton('close', { onClick: () => close() }),
    ]);
    const body = U.el('div', { class: 'modal-body' }, bodyNode);
    const footer = U.el('div', { class: 'modal-footer' });
    const closeBtn = button(t('close'), { variant: 'ghost', onClick: () => close() });
    footer.appendChild(closeBtn);
    if (opts.footer) opts.footer.forEach((btn) => footer.appendChild(btn));
    box.appendChild(header);
    box.appendChild(body);
    if (!opts.hideFooter) box.appendChild(footer);
    overlay.appendChild(box);
    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    function close() {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 250);
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay && !opts.noDismiss) close(); });
    return { close, body, box };
  }

  function confirm(message, onConfirm, opts = {}) {
    const m = modal(opts.title || t('confirm'), U.el('p', { class: 'confirm-text', text: message }), {
      footer: [
        button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
        button(t('confirm'), { variant: 'danger', onClick: () => { m.close(); onConfirm(); } }),
      ],
    });
  }

  function prompt(title, label, onConfirm, opts = {}) {
    const inputEl = input(opts.value || '', { type: 'text', placeholder: opts.placeholder || '' });
    const body = U.el('div', {}, [fieldWrap(label, inputEl)]);
    const m = modal(title, body, {
      footer: [
        button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
        button(t('confirm'), { variant: 'primary', onClick: () => { const v = inputEl.value; m.close(); onConfirm(v); } }),
      ],
    });
    setTimeout(() => inputEl.focus(), 50);
    return m;
  }

  function barChart(data, opts = {}) {
    const max = Math.max(1, ...data.map((d) => Math.max(d.incoming || 0, d.outgoing || 0, d.documents || 0)));
    const wrap = U.el('div', { class: 'chart chart-bar' });
    data.forEach((d) => {
      const col = U.el('div', { class: 'chart-col' });
      const bars = U.el('div', { class: 'chart-bars' });
      const vals = [['documents', 'var(--green)'], ['incoming', 'var(--blue)'], ['outgoing', 'var(--purple)']];
      vals.forEach(([k, color]) => {
        const v = d[k] || 0;
        const h = (v / max) * 100;
        const bar = U.el('div', { class: 'chart-bar-item', style: `height:${h}%;background:${color}`, title: `${k}: ${v}` });
        bars.appendChild(bar);
      });
      col.appendChild(bars);
      col.appendChild(U.el('span', { class: 'chart-label', text: d.date }));
      wrap.appendChild(col);
    });
    return wrap;
  }

  function donutChart(segments, opts = {}) {
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    const size = 160, r = 60, c = 2 * Math.PI * r;
    let offset = 0;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'donut');
    segments.forEach((s) => {
      const len = (s.value / total) * c;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', size / 2); circle.setAttribute('cy', size / 2); circle.setAttribute('r', r);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', s.color);
      circle.setAttribute('stroke-width', '18');
      circle.setAttribute('stroke-dasharray', `${len} ${c - len}`);
      circle.setAttribute('stroke-dashoffset', -offset);
      circle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
      svg.appendChild(circle);
      offset += len;
    });
    const label = U.el('div', { class: 'donut-center' }, [U.el('strong', { text: String(total) }), U.el('span', { text: opts.centerLabel || '' })]);
    return U.el('div', { class: 'donut-wrap' }, [svg, label]);
  }

  function statCard(iconName, value, label, variant = 'green') {
    return U.el('div', { class: 'stat-card stat-' + variant, 'data-anim': 'fade-up' }, [
      U.el('div', { class: 'stat-icon', html: EG.icon(iconName, 26) }),
      U.el('div', { class: 'stat-body' }, [
        U.el('div', { class: 'stat-value', text: String(value) }),
        U.el('div', { class: 'stat-label', text: label }),
      ]),
    ]);
  }

  function grid(children, cls = '') {
    return U.el('div', { class: 'grid ' + cls }, children);
  }

  return {
    card, pageHeader, button, iconButton, badge, statusBadge, priorityBadge, emptyState,
    spinner, loadingBlock, fieldWrap, input, textarea, select, table, toast, modal, confirm,
    prompt, barChart, donutChart, statCard, grid,
  };
})();
