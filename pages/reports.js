'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

const REPORT_COLUMNS = {
  documents: [
    { key: 'fileNumber', label: { ar: 'رقم الملف', en: 'File Number' } },
    { key: 'title', label: { ar: 'العنوان', en: 'Title' }, localize: true },
    { key: 'projectName', label: { ar: 'المشروع', en: 'Project' } },
    { key: 'departmentCode', label: { ar: 'القسم', en: 'Department' } },
    { key: 'priority', label: { ar: 'الأولوية', en: 'Priority' } },
    { key: 'createdAt', label: { ar: 'تاريخ الإنشاء', en: 'Created' } },
  ],
  incoming: [
    { key: 'letterNumber', label: { ar: 'الرقم', en: 'Number' } },
    { key: 'subject', label: { ar: 'الموضوع', en: 'Subject' }, localize: true },
    { key: 'fromEntity', label: { ar: 'من', en: 'From' } },
    { key: 'deliveryStatus', label: { ar: 'الحالة', en: 'Status' } },
    { key: 'priority', label: { ar: 'الأولوية', en: 'Priority' } },
    { key: 'receivedDate', label: { ar: 'تاريخ الخطاب', en: 'Letter Date' } },
  ],
  outgoing: [
    { key: 'letterNumber', label: { ar: 'الرقم', en: 'Number' } },
    { key: 'subject', label: { ar: 'الموضوع', en: 'Subject' }, localize: true },
    { key: 'sentTo', label: { ar: 'إلى', en: 'To' } },
    { key: 'deliveryStatus', label: { ar: 'الحالة', en: 'Status' } },
    { key: 'priority', label: { ar: 'الأولوية', en: 'Priority' } },
    { key: 'sentDate', label: { ar: 'تاريخ الخطاب', en: 'Letter Date' } },
  ],
  departments: [
    { key: 'code', label: { ar: 'الكود', en: 'Code' } },
    { key: 'name', label: { ar: 'الاسم', en: 'Name' }, localize: true },
    { key: 'manager', label: { ar: 'المدير', en: 'Manager' } },
  ],
};

// Field used to group rows for the chart (distribution) per report type.
const REPORT_CHART = {
  incoming: { key: 'deliveryStatus', label: { ar: 'التوزيع حسب الحالة', en: 'Distribution by Status' } },
  outgoing: { key: 'deliveryStatus', label: { ar: 'التوزيع حسب الحالة', en: 'Distribution by Status' } },
  documents: { key: 'priority', label: { ar: 'التوزيع حسب الأولوية', en: 'Distribution by Priority' } },
  departments: null,
};

const VALUE_COLORS = {
  pending: '#f59e0b', received: '#2563eb', delivered: '#16a34a', rejected: '#dc2626', cancelled: '#64748b', active: '#16a34a',
  low: '#64748b', medium: '#2563eb', high: '#f59e0b', urgent: '#dc2626',
};
const PALETTE = ['#16a34a', '#2563eb', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#64748b', '#db2777'];

EG.pages.reports = {
  id: 'reports',
  title: 'reports',
  icon: 'reports',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    const collectionSel = C.select([
      { value: 'incoming', label: t('incoming') },
      { value: 'outgoing', label: t('outgoing') },
      { value: 'documents', label: t('documents') },
      { value: 'departments', label: t('departments') },
    ], 'incoming');
    const { select: deptSel } = await EG.helpers.deptOptions();
    const fromDate = C.input('', { type: 'date' });
    const toDate = C.input('', { type: 'date' });
    const resultBox = U.el('div');

    const printBtn = C.button(t('print'), { icon: 'print', variant: 'ghost', onClick: printReport });
    printBtn.disabled = true;

    view.appendChild(C.pageHeader(t('reports')));
    view.appendChild(C.card([
      U.el('div', { class: 'form-grid' }, [
        C.fieldWrap(t('reportType'), collectionSel),
        C.fieldWrap(t('department'), deptSel),
        C.fieldWrap(t('fromDate'), fromDate),
        C.fieldWrap(t('toDate'), toDate),
      ]),
      U.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:8px' }, [
        C.button(t('generateReport'), { icon: 'reports', onClick: generate }),
        C.button(t('exportExcel'), { icon: 'download', variant: 'blue', onClick: () => exportAs('excel') }),
        printBtn,
      ]),
    ]));
    view.appendChild(resultBox);

    let lastRows = [];

    function chartSegments(rows, collection) {
      const cfg = REPORT_CHART[collection];
      if (!cfg) return null;
      const counts = {};
      rows.forEach((r) => { const k = r[cfg.key] || 'unknown'; counts[k] = (counts[k] || 0) + 1; });
      const entries = Object.entries(counts);
      if (!entries.length) return null;
      return {
        title: cfg.label[EG.state.lang] || cfg.label.en,
        segments: entries.map(([k, v], i) => ({
          key: k,
          value: v,
          label: k === 'unknown' ? t('none') : t(k),
          color: VALUE_COLORS[k] || PALETTE[i % PALETTE.length],
        })),
      };
    }

    function buildChartCard(rows, collection) {
      const data = chartSegments(rows, collection);
      if (!data) return null;
      const total = data.segments.reduce((a, s) => a + s.value, 0) || 1;
      const donut = C.donutChart(data.segments.map((s) => ({ value: s.value, color: s.color })), { centerLabel: t(collection) });
      const legend = U.el('div', { class: 'chart-legend', style: 'display:flex;flex-direction:column;gap:8px;flex:1;min-width:180px' },
        data.segments.map((s) => U.el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
          U.el('span', { style: `width:12px;height:12px;border-radius:3px;background:${s.color};display:inline-block;flex:0 0 auto` }),
          U.el('span', { style: 'flex:1', text: s.label }),
          U.el('strong', { text: String(s.value) }),
          U.el('span', { class: 'cell-soft', text: `(${Math.round((s.value / total) * 100)}%)` }),
        ]))
      );
      return C.card([
        U.el('div', { class: 'card-title', html: EG.icon('reports', 18) + '<span>' + data.title + '</span>' }),
        U.el('div', { style: 'display:flex;gap:24px;align-items:center;flex-wrap:wrap' }, [donut, legend]),
      ]);
    }

    async function generate() {
      U.clear(resultBox);
      resultBox.appendChild(C.loadingBlock());
      printBtn.disabled = true;
      try {
        const collection = collectionSel.value;
        const rows = await EG.api.reports.generate({ collection, fromDate: fromDate.value, toDate: toDate.value, departmentCode: deptSel.value });
        lastRows = rows;
        const cols = REPORT_COLUMNS[collection];
        U.clear(resultBox);
        if (!rows.length) { resultBox.appendChild(C.emptyState('reports', t('emptyState'))); return; }

        const chartCard = buildChartCard(rows, collection);
        if (chartCard) {
          chartCard.classList.add('card-enter');
          resultBox.appendChild(chartCard);
        }

        resultBox.appendChild(C.card([
          U.el('div', { class: 'card-title', html: EG.icon('reports', 18) + '<span>' + t(collection) + ' · ' + rows.length + '</span>' }),
          C.table(cols.map((c) => c.label[EG.state.lang] || c.label.en), rows, {
            renderRow: (row) => U.el('tr', {}, cols.map((c) => {
              let val = row[c.key];
              if (c.localize) val = EG.utils.localize(val, EG.state.lang);
              else if (c.key.endsWith('At') || c.key.endsWith('Date')) val = EG.utils.formatDate(val, EG.state.lang);
              return U.el('td', { text: String(val ?? '') });
            })),
          }),
        ]));
        printBtn.disabled = false;
      } catch (e) { U.clear(resultBox); resultBox.appendChild(C.emptyState('error', EG.api.errMessage(e))); }
    }

    function mapRows(rows, cols) {
      return rows.map((r) => {
        const o = {};
        cols.forEach((c) => {
          let val = r[c.key];
          if (c.localize) val = EG.utils.localize(val, EG.state.lang);
          else if (c.key.endsWith('At') || c.key.endsWith('Date')) val = EG.utils.formatDate(val, EG.state.lang);
          o[c.key] = val == null ? '' : val;
        });
        return o;
      });
    }

    async function exportAs(type) {
      const collection = collectionSel.value;
      const cols = REPORT_COLUMNS[collection];
      try {
        const rows = lastRows.length ? lastRows : await EG.api.reports.generate({ collection, fromDate: fromDate.value, toDate: toDate.value, departmentCode: deptSel.value });
        if (!rows.length) { C.toast(t('emptyState'), 'error'); return; }
        const mapped = mapRows(rows, cols);
        const titleText = t('reports') + ' - ' + t(collection);
        const payload = {
          fileName: 'EG-Report-' + collection,
          title: { ar: titleText, en: titleText },
          columns: cols,
          rows: mapped,
          sheets: [{ name: { ar: t(collection), en: t(collection) }, columns: cols, rows: mapped }],
          lang: EG.state.lang,
        };
        const res = type === 'excel' ? await EG.api.export.excel(payload) : await EG.api.export.pdf(payload);
        C.toast(t('export') + ': ' + res.fileName);
        EG.api.file.open(res.path).catch(() => {});
      } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
    }

    function filterSummaryHtml() {
      const esc = U.escapeHtml;
      const lang = EG.state.lang;
      const items = [];
      items.push(`<b>${esc(t('reportType'))}:</b> ${esc(t(collectionSel.value))}`);
      const deptLabel = deptSel.options[deptSel.selectedIndex] ? deptSel.options[deptSel.selectedIndex].text : t('all');
      items.push(`<b>${esc(t('department'))}:</b> ${esc(deptLabel)}`);
      if (fromDate.value) items.push(`<b>${esc(t('fromDate'))}:</b> ${esc(fromDate.value)}`);
      if (toDate.value) items.push(`<b>${esc(t('toDate'))}:</b> ${esc(toDate.value)}`);
      items.push(`<b>${esc(t('number'))}:</b> ${lastRows.length}`);
      return items.join(' &nbsp;|&nbsp; ');
    }

    function chartHtml() {
      const data = chartSegments(lastRows, collectionSel.value);
      if (!data) return '';
      const esc = U.escapeHtml;
      const max = Math.max(1, ...data.segments.map((s) => s.value));
      const total = data.segments.reduce((a, s) => a + s.value, 0) || 1;
      const bars = data.segments.map((s) => {
        const pct = Math.round((s.value / max) * 100);
        const share = Math.round((s.value / total) * 100);
        return `<div class="bar-row">
          <div class="bar-label">${esc(s.label)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${s.color}"></div></div>
          <div class="bar-val">${s.value} (${share}%)</div>
        </div>`;
      }).join('');
      return `<h3 class="chart-title">${esc(data.title)}</h3><div class="chart">${bars}</div>`;
    }

    function printReport() {
      if (!lastRows.length) { C.toast(t('emptyState'), 'error'); return; }
      const esc = U.escapeHtml;
      const lang = EG.state.lang;
      const dir = lang === 'ar' ? 'rtl' : 'ltr';
      const collection = collectionSel.value;
      const cols = REPORT_COLUMNS[collection];
      const settings = EG.state.settings || {};
      const company = (settings.companyName && (settings.companyName[lang] || settings.companyName.en)) || t('appName');
      const printedAt = EG.utils.formatDateTime(new Date().toISOString(), lang);

      const header = cols.map((c) => `<th>${esc(c.label[lang] || c.label.en)}</th>`).join('');
      const body = mapRows(lastRows, cols).map((r) =>
        '<tr>' + cols.map((c) => `<td>${esc(String(r[c.key] ?? ''))}</td>`).join('') + '</tr>'
      ).join('');

      const html = `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><meta charset="UTF-8">
<title>${esc(t('reports'))} - ${esc(t(collection))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1f2937; margin: 24px; }
  .rep-head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #16a34a; padding-bottom:10px; margin-bottom:14px; }
  .rep-head h1 { font-size:20px; margin:0 0 4px; color:#16a34a; }
  .rep-head .sub { font-size:12px; color:#6b7280; }
  .summary { font-size:12px; color:#374151; margin-bottom:16px; background:#f9fafb; padding:8px 10px; border-radius:6px; }
  .chart-title { font-size:14px; margin:12px 0 8px; }
  .chart { margin-bottom:18px; }
  .bar-row { display:flex; align-items:center; gap:10px; margin-bottom:6px; font-size:12px; }
  .bar-label { width:120px; flex:0 0 auto; }
  .bar-track { flex:1; background:#eef2f7; border-radius:6px; height:16px; overflow:hidden; }
  .bar-fill { height:100%; border-radius:6px; }
  .bar-val { width:90px; flex:0 0 auto; text-align:${dir === 'rtl' ? 'left' : 'right'}; color:#374151; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th, td { border:1px solid #d1d5db; padding:6px 8px; text-align:${dir === 'rtl' ? 'right' : 'left'}; }
  thead th { background:#16a34a; color:#fff; }
  tbody tr:nth-child(even) { background:#f3f4f6; }
  @media print { body { margin:0; } @page { margin:14mm; } }
</style></head>
<body>
  <div class="rep-head">
    <div>
      <h1>${esc(company)}</h1>
      <div class="sub">${esc(t('reports'))} - ${esc(t(collection))}</div>
    </div>
    <div class="sub">${esc(printedAt)}</div>
  </div>
  <div class="summary">${filterSummaryHtml()}</div>
  ${chartHtml()}
  <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;

      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(iframe);
      const d = iframe.contentWindow.document;
      d.open();
      d.write(html);
      d.close();
      const doPrint = () => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (_) {}
        setTimeout(() => iframe.remove(), 1500);
      };
      // Give the iframe a moment to render before printing.
      setTimeout(doPrint, 350);
    }
  },
};
