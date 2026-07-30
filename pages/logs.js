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

      const actionMap = {
        create: 'إنشاء',
        update: 'تعديل',
        delete: 'حذف',
        status: 'تغيير حالة',
        approve: 'اعتماد',
        reject: 'رفض',
        restore: 'استعادة',
        version: 'إصدار',
        receipt: 'استلام',
      };
      const entityMap = {
        user: 'المستخدم',
        department: 'القسم',
        document: 'الوثيقة',
        incoming: 'الوارد',
        outgoing: 'الصادر',
        lending: 'الاستعارة',
        project: 'المشروع',
        recycle: 'السلة',
      };
      const statusAr = {
        pending: 'قيد الانتظار',
        received: 'مستلم',
        delivered: 'تم التسليم',
        rejected: 'مرفوض',
        cancelled: 'ملغى',
        in_archive: 'داخل الأرشيف',
        reserved: 'محجوز',
        borrowed: 'معار',
        returned: 'مرجع',
        overdue: 'متأخر',
        under_review: 'تحت المراجعة',
        missing: 'فقود',
        pending_disposal: 'قيد الإعدام',
        archived: 'مؤرشف',
        approved: 'معتمد',
      };
      const enToAr = (s) => {
        if (!s || typeof s !== 'string') return s;
        let x = s;
        Object.keys(statusAr).forEach((k) => { x = x.split(k).join(statusAr[k]); });
        x = x.replace(/\bCreate\b/g, 'إنشاء').replace(/\bUpdate\b/g, 'تعديل').replace(/\bDelete\b/g, 'حذف').replace(/\bUser\b/g, 'المستخدم').replace(/\bDepartment\b/g, 'القسم').replace(/\bDocument\b/g, 'الوثيقة').replace(/\bIncoming\b/g, 'الوارد').replace(/\bOutgoing\b/g, 'الصادر').replace(/\bLending\b/g, 'الاستعارة').replace(/\bProject\b/g, 'المشروع').replace(/\bPending\b/g, 'قيد الانتظار').replace(/\bDelivered\b/g, 'تم التسليم').replace(/\bRejected\b/g, 'مرفوض').replace(/\bApproved\b/g, 'معتمد');
        return x;
      };

      view.appendChild(C.pageHeader(t('auditLog'), [
        C.button(t('exportExcel'), { icon: 'download', variant: 'blue', onClick: async () => {
          try {
            const rows = logs.map((l) => ({
              action: actionMap[l.action] || l.action,
              entity: entityMap[l.entity] || l.entity,
              userName: l.userName || '',
              details: enToAr(l.details || ''),
              fileName: l.fileName || '',
              timestamp: EG.utils.formatDateTime(l.timestamp, EG.state.lang),
            }));
            const cols = [
              { key: 'action', label: { ar: 'العملية', en: 'Action' } },
              { key: 'entity', label: { ar: 'الكيان', en: 'Entity' } },
              { key: 'userName', label: { ar: 'المستخدم', en: 'User' } },
              { key: 'details', label: { ar: 'التفاصيل', en: 'Details' } },
              { key: 'fileName', label: { ar: 'اسم الملف', en: 'File Name' } },
              { key: 'timestamp', label: { ar: 'الوقت', en: 'Time' } },
            ];
            const res = await EG.api.export.excel({
              fileName: 'EG-AuditLog',
              title: { ar: t('auditLog'), en: t('auditLog') },
              sheets: [{ name: { ar: t('auditLog'), en: t('auditLog') }, columns: cols, rows }],
              lang: EG.state.lang,
            });
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
            td(actionMap[l.action] || l.action, 'cell-title'),
            td(entityMap[l.entity] || l.entity),
            td(l.userName || '-'),
            td(enToAr(l.details || '-'), 'cell-soft'),
            td(l.fileName || '-', 'cell-soft'),
            td(EG.utils.formatDateTime(l.timestamp, EG.state.lang), 'cell-soft'),
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
