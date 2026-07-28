'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.emaillog = {
  id: 'emaillog',
  title: 'emaillog',
  icon: 'documents',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const es = await EG.api.emailLog.stats();
      const grid = C.grid([
        C.statCard('email', es.total, t('emailTotal'), 'blue'),
        C.statCard('attach', es.withAttachments, t('emailWithAttachments'), 'purple'),
        C.statCard('bolt', es.pending, t('emailPending'), 'amber'),
        C.statCard('check', es.sent, t('emailSent'), 'green'),
        C.statCard('warn', es.failed, t('emailFailed'), 'danger'),
      ], 'grid-4 stagger');

      const filterRow = U.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px' }, [
        C.select([
          { value: '', label: t('all') },
          { value: 'sent', label: t('emailSent') },
          { value: 'pending', label: t('emailPending') },
          { value: 'draft', label: t('emailDraft') },
          { value: 'failed', label: t('emailFailed') },
        ], '', { onChange: (e) => { currentFilter.status = e.target.value; refresh(); } }),
        U.el('input', { type: 'date', style: 'direction:ltr', onChange: (e) => { currentFilter.fromDate = e.target.value || null; refresh(); } }),
        U.el('input', { type: 'date', style: 'direction:ltr', onChange: (e) => { currentFilter.toDate = e.target.value || null; refresh(); } }),
        C.button(t('add'), { icon: 'plus', onClick: () => openForm() }),
      ]);

      const currentFilter = { status: '', fromDate: null, toDate: null };
      const container = U.el('div');

      async function refresh() {
        U.clear(container);
        const items = await EG.api.emailLog.list(currentFilter);
        container.appendChild(filterRow);
        const table = C.table(
          [t('date'), t('to'), t('subject'), t('emailAttachments'), t('status'), t('priority'), t('related'), t('actions')],
          items,
          {
            renderRow: (d) => {
              const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
              const actions = U.el('div', { class: 'row-actions' }, [
                C.iconButton('edit', { title: t('edit'), variant: 'action', onClick: stop(() => openForm(d)) }),
                C.iconButton('history', { title: t('preview'), onClick: stop(() => openPreview(d)) }),
                C.iconButton('trash', { title: t('delete'), variant: 'danger', onClick: stop(() => C.confirm(t('confirmDelete'), async () => { try { await EG.api.emailLog.remove(d._id); C.toast(t('deleted')); refresh(); } catch (e2) { C.toast((EG.api && EG.api.errMessage ? EG.api.errMessage(e2) : e2.message), 'error'); } })) }),
                d.deleted ? C.iconButton('restore', { title: t('restore'), onClick: stop(async () => { try { await EG.api.emailLog.restore(d._id); C.toast(t('restored')); refresh(); } catch (e2) { C.toast((EG.api && EG.api.errMessage ? EG.api.errMessage(e2) : e2.message), 'error'); } }) }) : null,
              ]);
              return U.el('tr', {}, [
                td(EG.utils.formatDate(d.sentAt, EG.state.lang), 'cell-soft'),
                td(d.to, 'cell-title'),
                td(EG.utils.localize(d.subject, EG.state.lang) || '-'),
                td('', '', U.el('div', {}, [
                  U.el('span', { class: 'badge badge-' + (d.hasAttachments ? 'success' : 'neutral'), text: d.hasAttachments ? t('yes') : t('no') }),
                  d.hasAttachments ? U.el('span', { class: 'cell-soft', text: (d.attachments || []).map(a => a.fileName).join(', ') }) : null,
                ])),
                td('', '', C.statusBadge(d.status || 'sent')),
                td('', '', C.priorityBadge(d.priority || 'medium')),
                td(d.relatedId ? U.el('span', { text: (d.relatedType || '') + ' ' + d.relatedId }) : '-'),
                td('', '', actions),
              ]);
            },
          }
        );
        container.appendChild(items.length ? table : C.emptyState('email', t('emptyState')));
      }

      async function openForm(d) {
        const data = d || {};
        const to = C.input(data.to || '', { type: 'email' });
        const cc = C.input(data.cc || '', { type: 'email' });
        const subjectAr = C.input(data.subject ? EG.utils.localize(data.subject, 'ar') || '' : '', {});
        const subjectEn = C.input(data.subject ? EG.utils.localize(data.subject, 'en') || '' : '', {});
        const body = C.textarea(data.body || '', { style: 'min-height:120px' });
        const status = C.select([
          { value: 'sent', label: t('emailSent') },
          { value: 'pending', label: t('emailPending') },
          { value: 'draft', label: t('emailDraft') },
          { value: 'failed', label: t('emailFailed') },
        ], data.status || 'sent');
        const priority = EG.helpers.prioritySelect(data.priority || 'medium');
        const relatedType = C.select([
          { value: '', label: t('none') },
          { value: 'incoming', label: t('incoming') },
          { value: 'outgoing', label: t('outgoing') },
          { value: 'document', label: t('documents') },
        ], data.relatedType || '');
        const relatedId = C.input(data.relatedId || '', {});
        const sentAt = C.input(data.sentAt ? new Date(data.sentAt).toISOString().slice(0, 10) : '', { type: 'date', style: 'direction:ltr' });
        const attachLabel = U.el('span', { class: 'cell-soft' });
        let attachments = data.attachments || [];
        function renderAttachLabel() {
          const list = (attachments || []).map(a => a.fileName).join(', ');
          attachLabel.textContent = list || t('none');
        }
        renderAttachLabel();
        const body2 = U.el('div', {}, [
          U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('to'), to), C.fieldWrap(t('cc'), cc)]),
          U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('subject') + ' (AR)', subjectAr), C.fieldWrap(t('subject') + ' (EN)', subjectEn)]),
          U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('status'), status), C.fieldWrap(t('priority'), priority)]),
          U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('relatedType'), relatedType), C.fieldWrap(t('relatedId'), relatedId)]),
          C.fieldWrap(t('date'), sentAt),
          U.el('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:10px' }, [
            C.button(t('addAttachment'), { icon: 'file', variant: 'ghost', size: 'sm', onClick: async () => {
              const path = await EG.helpers.filePick([{ name: 'All', extensions: ['*'] }]);
              if (path) {
                const name = path.split(/[\\/]/).pop();
                attachments = [...(attachments || []), { fileName: name, filePath: path, size: 0, mimeType: '' }];
                renderAttachLabel();
              }
            } }),
            attachLabel,
          ]),
          (attachments || []).length ? U.el('ul', { style: 'margin-top:8px;padding-inline-start:18px' }, attachments.map((a, i) => U.el('li', {}, [
            U.el('span', { text: a.fileName }),
            C.iconButton('trash', { size: 'xs', variant: 'danger', iconSize: 12, onClick: () => { attachments.splice(i, 1); renderAttachLabel(); } }),
          ]))) : null,
          U.el('div', { style: 'margin-top:12px' }, [C.fieldWrap(t('emailBody'), body)]),
        ]);
        const m = C.modal(d ? t('edit') : t('emaillog'), body2, {
          size: 'lg',
          footer: [C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
            C.button(t('save'), { icon: 'save', onClick: async () => {
              const ar = subjectAr.value.trim();
              const en = subjectEn.value.trim();
              if (!to.value.trim()) { C.toast(t('fillRequired'), 'error'); return; }
              try {
                const payload = {
                  to: to.value.trim(),
                  cc: cc.value.trim() || null,
                  subject: { ar: ar || en, en: en || ar },
                  body: body.value.trim() || null,
                  status: status.value,
                  priority: priority.value,
                  relatedType: relatedType.value || null,
                  relatedId: relatedId.value.trim() || null,
                  sentAt: sentAt.value || new Date(),
                  attachments,
                };
                if (d) {
                  await EG.api.emailLog.update(d._id, payload);
                } else {
                  await EG.api.emailLog.create(payload);
                }
                m.close();
                C.toast(t('saved'));
                refresh();
              } catch (e2) { C.toast((EG.api && EG.api.errMessage ? EG.api.errMessage(e2) : e2.message || 'error'), 'error'); }
            } })],
        });
      }

      function openPreview(d) {
        const attachList = U.el('ul');
        (d.attachments || []).forEach((a) => {
          attachList.appendChild(U.el('li', {}, [U.el('span', { text: a.fileName + (a.size ? ' (' + a.size + ' bytes)' : '') })]));
        });
        const details = U.el('div', { class: 'detail-grid' }, [
          metaRow(t('to'), d.to || '-'),
          metaRow(t('cc'), d.cc || '-'),
          metaRow(t('subject'), EG.utils.localize(d.subject, EG.state.lang) || '-'),
          metaRow(t('status'), '' , C.statusBadge(d.status || 'sent')),
          metaRow(t('priority'), '' , C.priorityBadge(d.priority || 'medium')),
          metaRow(t('date'), EG.utils.formatDate(d.sentAt, EG.state.lang)),
          metaRow(t('related'), d.relatedId ? (d.relatedType || '') + ' ' + d.relatedId : '-'),
        ]);
        const body = U.el('div', {}, [
          details,
          U.el('div', { style: 'height:1px;background:var(--border);margin:14px 0' }),
          d.body ? U.el('div', { class: 'detail-grid' }, [metaRow(t('emailBody'), d.body)]) : null,
          d.hasAttachments ? U.el('div', { class: 'detail-grid' }, [metaRow(t('emailAttachments') + ' (' + (d.attachments || []).length + ')', '', attachList)]) : null,
        ]);
        C.modal(d.subject ? EG.utils.localize(d.subject, EG.state.lang) : t('preview'), body, { size: 'lg', hideFooter: true });
        function metaRow(label, value, node) {
          return U.el('div', { class: 'meta-row' }, [
            U.el('span', { class: 'meta-label', text: label }),
            node || U.el('span', { class: 'meta-value', text: String(value ?? '-') }),
          ]);
        }
      }

      view.appendChild(grid);
      view.appendChild(container);
      refresh();
    } catch (e) {
      view.appendChild(C.emptyState('error', EG.api.errMessage(e)));
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }
  },
};
