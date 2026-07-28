'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.logs = {
  id: 'logs',
  title: 'logs',
  icon: 'logs',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const logs = await EG.api.logs.list(500, 0);
      view.appendChild(C.pageHeader(t('auditLog'), [
        C.button(t('exportExcel'), { icon: 'download', variant: 'blue', onClick: async () => {
          try {
            const rows = logs.map((l) => ({ action: l.action, entity: l.entity, userName: l.userName || '', details: l.details || '', fileName: l.fileName || '', timestamp: EG.utils.formatDateTime(l.timestamp, EG.state.lang) }));
            const cols = [
              { key: 'action', label: { ar: 'العملية', en: 'Action' } },
              { key: 'entity', label: { ar: 'الكيان', en: 'Entity' } },
              { key: 'userName', label: { ar: 'المستخدم', en: 'User' } },
              { key: 'details', label: { ar: 'التفاصيل', en: 'Details' } },
              { key: 'fileName', label: { ar: 'اسم الملف', en: 'File Name' } },
              { key: 'timestamp', label: { ar: 'الوقت', en: 'Time' } },
            ];
            const res = await EG.api.export.excel({ fileName: 'EG-AuditLog', title: { ar: t('auditLog'), en: t('auditLog') }, columns: cols, rows, lang: EG.state.lang });
            C.toast(t('export') + ': ' + res.fileName);
            EG.api.file.open(res.path).catch(() => {});
          } catch (e2) { C.toast(EG.api.errMessage(e2), 'error'); }
        } }),
      ]));
      const table = C.table(
        [t('action'), t('entity'), t('user'), t('details'), t('fileName'), t('time')],
        logs,
        {
          renderRow: (l) => U.el('tr', {}, [
            td(t(l.action) || l.action, 'cell-title'), td(l.entity), td(l.userName || '-'), td(l.details || '-', 'cell-soft'), td(l.fileName || '-', 'cell-soft'), td(EG.utils.formatDateTime(l.timestamp, EG.state.lang), 'cell-soft'),
          ]),
        }
      );
      view.appendChild(logs.length ? table : C.emptyState('logs', t('emptyState')));
    } catch (e) { view.appendChild(C.emptyState('error', EG.api.errMessage(e))); }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }
  },
};
