'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.emaillog = {
  id: 'emaillog',
  title: 'emaillog',
  icon: 'email',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const stats = await EG.api.emailLog.stats();
      const cards = U.el('div', { class: 'grid grid-4 stagger' });
      cards.appendChild(C.statCard('email', stats.total, t('emailTotal'), 'blue'));
      cards.appendChild(C.statCard('paperclip', stats.withAttachments, t('emailWithAttachments'), 'green'));
      cards.appendChild(C.statCard('bell', stats.pending, t('emailPending'), 'amber'));
      cards.appendChild(C.statCard('check', stats.sent, t('emailSent'), 'purple'));

      view.appendChild(C.pageHeader(t('emaillog'), []));
      view.appendChild(cards);
      U.el('div', { style: 'height:10px' });

      let emails = [];
      let filterQuery = {};

      const filterBar = U.el('div', { class: 'card', style: 'margin-bottom:14px;padding:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap' }, [
        C.select(
          [{ value: '', label: t('all') }, { value: 'sent', label: t('emailSent') }, { value: 'pending', label: t('emailPending') }, { value: 'failed', label: t('emailFailed') }, { value: 'draft', label: t('emailDraft') }],
          '',
          { onchange: (e) => { filterQuery = { status: e.target.value || undefined }; renderTable(); } }
        ),
      ]);
      view.appendChild(filterBar);

      async function load() {
        try {
          emails = await EG.api.emailLog.list(filterQuery);
          renderTable();
        } catch (e) {
          view.appendChild(C.emptyState('error', EG.api.errMessage(e)));
        }
      }

      function renderTable() {
        const existing = view.querySelector('.table-wrap');
        if (existing) existing.remove();

        const table = C.table(
          [t('subject'), t('receiver'), t('emailAttachments'), t('sentAt'), t('status'), t('priority'), t('actions')],
          emails,
          {
            renderRow: (e) => {
              const actions = U.el('div', { class: 'row-actions' }, [
                EG.helpers.canDelete() ? C.iconButton('trash', { title: t('delete'), variant: 'danger', onClick: () => C.confirm(t('confirmDelete'), async () => {
                  try {
                    await EG.api.emailLog.remove(e._id);
                    C.toast(t('deleted'));
                    renderTable();
                  } catch (err) { C.toast(EG.api.errMessage(err), 'error'); }
                }) }) : null,
              ]);
              return U.el('tr', {}, [
                td(e.subject || '-', 'cell-title'),
                td(e.to || '-'),
                td(e.hasAttachments ? EG.icon('paperclip', 16) + ' ' + (e.attachments ? e.attachments.length : '') : '-'),
                td(EG.utils.formatDateTime(e.sentAt, EG.state.lang), 'cell-soft'),
                td('', '', C.badge(t(e.status || 'draft'), statusVariant(e.status))),
                td(t(e.priority || 'medium')),
                td('', '', actions),
              ]);
            },
          }
        );
        view.appendChild(emails.length ? table : C.emptyState('email', t('emptyState')));

        const exportBtn = view.querySelector('.page-actions .btn');
        if (!exportBtn) {
          const header = view.querySelector('.page-header');
          if (header) {
            const btn = C.button(t('exportExcel'), { icon: 'download', variant: 'blue', onClick: exportExcel });
            header.querySelector('.page-actions').appendChild(btn);
          }
        }
      }

      function statusVariant(status) {
        const map = { sent: 'success', pending: 'warn', failed: 'danger', draft: 'neutral' };
        return map[status] || 'neutral';
      }

      async function exportExcel() {
        try {
          const rows = emails.map((e) => ({
            subject: e.subject || '',
            to: e.to || '',
            cc: e.cc || '',
            sentAt: EG.utils.formatDateTime(e.sentAt, EG.state.lang),
            status: t(e.status || 'draft'),
            priority: t(e.priority || 'medium'),
            hasAttachments: e.hasAttachments ? 'نعم' : 'لا',
            attachments: e.attachments ? e.attachments.map((a) => a.fileName).join(', ') : '',
          }));
          const cols = [
            { key: 'subject', label: { ar: 'الموضوع', en: 'Subject' } },
            { key: 'to', label: { ar: 'إلى', en: 'To' } },
            { key: 'cc', label: { ar: 'نسخة', en: 'CC' } },
            { key: 'sentAt', label: { ar: 'تاريخ الإرسال', en: 'Sent At' } },
            { key: 'status', label: { ar: 'الحالة', en: 'Status' } },
            { key: 'priority', label: { ar: 'الأولوية', en: 'Priority' } },
            { key: 'hasAttachments', label: { ar: 'مرفقات', en: 'Attachments' } },
            { key: 'attachments', label: { ar: 'أسماء المرفقات', en: 'Attachment Names' } },
          ];
          const res = await EG.api.export.excel({
            fileName: 'EG-EmailLog',
            title: { ar: t('emaillog'), en: t('emaillog') },
            sheets: [{ name: { ar: t('emaillog'), en: t('emaillog') }, columns: cols, rows }],
            lang: EG.state.lang,
          });
          C.toast(t('export') + ': ' + res.fileName);
          EG.api.file.open(res.path).catch(() => {});
        } catch (e2) { C.toast(EG.api.errMessage(e2), 'error'); }
      }

      function td(txt, cls, node) {
        if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
        return U.el('td', { class: cls || '', text: String(txt ?? '') });
      }

      await load();
    } catch (e) {
      view.appendChild(C.emptyState('error', EG.api.errMessage(e)));
    }
  },
};
