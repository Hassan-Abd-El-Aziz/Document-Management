'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.lending = {
  id: 'lending',
  title: 'lending',
  icon: 'archive',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const items = await EG.api.lending.list('deleted == false', {});
      view.appendChild(C.pageHeader(t('lending'), [
        C.button(t('newLending'), { icon: 'plus', onClick: () => openForm() }),
        C.button(t('exportExcel'), { icon: 'download', variant: 'blue', onClick: () => exportAs('excel') }),
        C.button(t('exportPDF'), { icon: 'download', variant: 'ghost', onClick: () => exportAs('pdf') }),
      ]));

      const searchRow = U.el('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:18px' }, [
        C.input('', { placeholder: t('searchByFileNumber') || 'بحث برقم الملف أو العنوان...', style: 'flex:1;max-width:400px', id: 'lendingSearch' }),
        C.button(t('search'), { icon: 'search', variant: 'ghost', onClick: () => applySearch() }),
      ]);
      view.appendChild(searchRow);

      const active = items.filter((l) => l.status === 'borrowed' || l.status === 'reserved').length;
      const overdue = items.filter((l) => l.status === 'overdue').length;
      const underReview = items.filter((l) => l.status === 'under_review').length;
      const missing = items.filter((l) => l.status === 'missing').length;
      const inArchive = items.filter((l) => l.status === 'in_archive').length;
      const archived = items.filter((l) => l.status === 'archived').length;

      const stats = U.el('div', { class: 'grid grid-4 stagger', style: 'margin-bottom:18px' }, [
        C.statCard('inbox', active, t('activeLendings'), 'amber'),
        C.statCard('clock', overdue, t('overdue'), 'red'),
        C.statCard('search', underReview, t('underReview'), 'blue'),
        C.statCard('archive', inArchive + archived, t('archivedItems'), 'green'),
      ]);
      view.appendChild(stats);

      let lastItems = items;
      let lastQuery = '';

      function applySearch() {
        const query = searchRow.querySelector('#lendingSearch').value.trim().toLowerCase();
        lastQuery = query;
        renderTable(items, query);
      }

      searchRow.querySelector('#lendingSearch').addEventListener('input', () => applySearch());

      if (!items.length) { view.appendChild(C.emptyState('archive', t('emptyState'))); return; }

      function renderTable(data, query) {
        const filtered = query ? data.filter((l) => {
          const fn = (l.itemReference || '').toLowerCase();
          const title = (l.itemName || '').toLowerCase();
          return fn.includes(query) || title.includes(query);
        }) : data;
        lastItems = filtered;

        const existingTable = view.querySelector('.table-wrap');
        if (existingTable) existingTable.remove();

        if (!filtered.length) {
          view.appendChild(C.emptyState('search', t('noResults')));
          return;
        }

        const table = C.table(
          [t('fileReference'), t('itemName'), t('borrowerName'), t('currentLocation'), t('status'), t('approvalStatus'), t('requestDate'), t('lendDate'), t('returnDeadline'), t('actions')],
          filtered,
          {
            renderRow: (d) => {
              const actions = U.el('div', { class: 'row-actions' }, [
                d.approvalAttachment ? C.iconButton('eye', { title: t('preview'), onClick: () => showApprovalAttachment(d) }) : null,
                C.iconButton('edit', { title: t('edit'), variant: 'action', onClick: () => openForm(d) }),
                C.iconButton('trash', { title: t('delete'), variant: 'danger', onClick: () => C.confirm(t('confirmDelete'), async () => {
                  try { await EG.api.lending.del(d._id); C.toast(t('deleted')); applySearch(); } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
                }) }),
              ]);
              const approvalStatusLabel = d.approvalAttachment ? 'معتمد' : 'قيد الانتظار';
              return U.el('tr', {}, [
                td(d.itemReference || '-', 'cell-title'),
                td(d.itemName || '-'),
                td(d.borrowerName || '-'),
                td(d.currentLocation || '-'),
                td('', '', C.statusBadge(t(d.status) || d.status)),
                td(approvalStatusLabel),
                td(U.formatDate(d.requestDate, EG.state.lang), 'cell-soft'),
                td(d.lendDate ? U.formatDate(d.lendDate, EG.state.lang) : '-'),
                td(d.returnDeadline ? U.formatDate(d.returnDeadline, EG.state.lang) : '-'),
                td('', '', actions),
              ]);
            },
          }
        );
        view.appendChild(table);
      }

      renderTable(items, '');

      async function exportAs(type) {
        const rows = lastItems.length ? lastItems : items;
        if (!rows.length) { C.toast(t('emptyState'), 'error'); return; }
        const columns = [
          { key: 'itemReference', label: t('fileReference') },
          { key: 'itemName', label: t('itemName') },
          { key: 'borrowerName', label: t('borrowerName') },
          { key: 'currentLocation', label: t('currentLocation') },
          { key: 'status', label: t('status') },
          { key: 'approvalStatus', label: t('approvalStatus') },
          { key: 'requestDate', label: t('requestDate') },
          { key: 'lendDate', label: t('lendDate') },
          { key: 'returnDeadline', label: t('returnDeadline') },
        ];
        const mapped = rows.map((r) => ({
          itemReference: r.itemReference || '',
          itemName: r.itemName || '',
          borrowerName: r.borrowerName || '',
          currentLocation: r.currentLocation || '',
          status: t(r.status) || r.status,
          approvalStatus: r.approvalAttachment ? 'معتمد' : 'قيد الانتظار',
          requestDate: r.requestDate ? EG.utils.formatDate(r.requestDate, EG.state.lang) : '',
          lendDate: r.lendDate ? EG.utils.formatDate(r.lendDate, EG.state.lang) : '',
          returnDeadline: r.returnDeadline ? EG.utils.formatDate(r.returnDeadline, EG.state.lang) : '',
        }));
        const titleText = t('lending') + (lastQuery ? ' - ' + lastQuery : '');
        const payload = {
          fileName: 'Lending-Report',
          title: { ar: titleText, en: titleText },
          columns,
          rows: mapped,
          sheets: [{ name: { ar: t('lending'), en: t('lending') }, columns, rows: mapped }],
          lang: EG.state.lang,
        };
        try {
          const res = type === 'excel' ? await EG.api.export.excel(payload) : await EG.api.export.pdf(payload);
          C.toast(t('export') + ': ' + res.fileName);
          EG.api.file.open(res.path).catch(() => {});
        } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
      }
    } catch (e) { view.appendChild(C.emptyState('error', EG.api.errMessage(e))); }

    async function processApproval(d, approval) {
      try {
        const loc = prompt(approval === 'approved' ? 'Enter shelf/location for approved item:' : '');
        if (approval === 'approved' && !loc) { C.toast('Location is required for approval', 'error'); return; }
        await EG.api.lending.approve(d._id, approval, loc);
        C.toast(t('saved'));
        EG.router.navigate('lending');
      } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
    }

    async function markReturned(d) {
      try {
        await EG.api.lending.markReturned(d._id);
        C.toast(t('saved'));
        EG.router.navigate('lending');
      } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
    }

    async function inspectReturn(d) {
      const note = prompt('Inspection note (optional):') || '';
      const status = prompt('Inspection status: good / damaged / missing').toLowerCase();
      if (!['good', 'damaged', 'missing'].includes(status)) { C.toast('Invalid inspection status', 'error'); return; }
      try {
        await EG.api.lending.inspect(d._id, status, note);
        C.toast(t('saved'));
        EG.router.navigate('lending');
      } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
    }

    async function transferItem(d) {
      const location = prompt('New location:') || '';
      const borrower = prompt('Borrower name (if transferring custody):') || '';
      const lender = prompt('Lender/Custodian name:') || '';
      try {
        await EG.api.lending.transfer(d._id, location || undefined, borrower || undefined, lender || undefined);
        C.toast(t('saved'));
        EG.router.navigate('lending');
      } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
    }

    function showHistory(d) {
      const history = Array.isArray(d.history) ? d.history : [];
      if (!history.length) { C.toast('No history available', 'error'); return; }
      const rows = history.slice().reverse().map((h) => U.el('tr', {}, [
        td(h.action || '-'), td(h.fromStatus || '-'), td(h.toStatus || '-'), td(h.fromLocation || '-'), td(h.toLocation || '-'),
        td(h.note || '-'), td(h.by || '-'), td(h.at ? U.formatDateTime(h.at, EG.state.lang) : '-'),
      ]));
      const table = U.el('div', { class: 'table-wrap' }, U.el('table', { class: 'table dense' },
        U.el('thead', {}, U.el('tr', {}, [th('Action'), th('From Status'), th('To Status'), th('From Location'), th('To Location'), th('Note'), th('By'), th('At')])),
        U.el('tbody', {}, rows)
      ));
      C.modal(d.itemName || t('history'), table, { size: 'xl', hideFooter: true });

      function td(txt, cls) { return U.el('td', { class: cls || '', text: String(txt ?? '') }); }
      function th(txt) { return U.el('th', { text: txt }); }
    }

    function showApprovalAttachment(d) {
      if (!d.approvalAttachment) return;
      const ext = d.approvalAttachment.split('.').pop().toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
      const body = U.el('div', {}, [
        isImage ? U.el('img', { src: d.approvalAttachment, style: 'max-width:100%;max-height:60vh;border-radius:8px' }) : U.el('a', { href: d.approvalAttachment, target: '_blank', text: 'Open Attachment' }),
      ]);
      C.modal(t('approvalAttachment'), body, { size: 'lg', hideFooter: true });
    }

    async function openForm(record) {
      const { select: deptSel } = await EG.helpers.deptOptions(record ? record.borrowerDepartment : '');
      const itemReference = C.input(record ? record.itemReference : '', { placeholder: t('fileReference') });
      const itemName = C.input(record ? record.itemName : '', {});
      const borrowerName = C.input(record ? record.borrowerName : '', {});
      const currentLocation = C.input(record ? record.currentLocation : '', {});
      const lendDate = C.input(record && record.lendDate ? new Date(record.lendDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0], { type: 'date' });
      const returnDeadline = C.input(record && record.returnDeadline ? new Date(record.returnDeadline).toISOString().split('T')[0] : '', { type: 'date' });
      const borrowPurpose = C.textarea(record ? record.borrowPurpose : '', {});
      const notes = C.textarea(record ? record.notes : '', {});

      const statusEl = U.el('div', {});
      const notFoundMsg = U.el('div', { style: 'color:var(--red);font-size:12px;margin-top:4px;display:none', text: t('noItemFound') || 'لا يوجد عنصر بهذا الاسم' });

      itemReference.addEventListener('input', async () => {
        const val = itemReference.value.trim();
        if (!val) {
          itemName.value = '';
          notFoundMsg.style.display = 'none';
          return;
        }
        try {
          const doc = await EG.api.document.searchByFileNumber(val);
          if (doc) {
            itemName.value = EG.utils.localize(doc.title, EG.state.lang) || doc.fileNumber;
            notFoundMsg.style.display = 'none';
          } else {
            itemName.value = '';
            notFoundMsg.style.display = 'block';
          }
        } catch (_) {
          itemName.value = '';
          notFoundMsg.style.display = 'none';
        }
      });

      deptSel.addEventListener('change', () => {
        currentLocation.value = deptSel.value;
      });

      let approvalAttachmentPath = null;
      const approvalLabel = U.el('span', { class: 'cell-soft', text: record ? (record.approvalAttachment || 'No attachment') : '' });
      const approvalBtn = C.button(t('upload'), { icon: 'upload', variant: 'ghost', onClick: async () => {
        approvalAttachmentPath = await EG.helpers.filePick();
        if (approvalAttachmentPath) approvalLabel.textContent = approvalAttachmentPath.split(/[\\/]/).pop();
      } });

      const body = U.el('div', {}, [
        C.fieldWrap(t('fileReference'), itemReference),
        notFoundMsg,
        C.fieldWrap(t('itemName'), itemName),
        U.el('div', { class: 'form-grid' }, [
          C.fieldWrap(t('borrowerName'), borrowerName),
          C.fieldWrap(t('borrowerDepartment'), deptSel),
        ]),
        C.fieldWrap(t('currentLocation'), currentLocation),
        U.el('div', { class: 'form-grid' }, [
          C.fieldWrap(t('lendDate'), lendDate),
          C.fieldWrap(t('returnDeadline'), returnDeadline),
        ]),
        C.fieldWrap(t('borrowPurpose'), borrowPurpose),
        U.el('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:14px' }, [approvalBtn, approvalLabel]),
        C.fieldWrap(t('notes'), notes),
      ]);

      const m = C.modal(record ? t('edit') : t('newLending'), body, {
        size: 'lg',
        footer: [
          C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
          C.button(t('save'), { icon: 'save', onClick: async () => {
            const data = {
              itemReference: itemReference.value.trim(),
              itemName: itemName.value.trim(),
              borrowerName: borrowerName.value.trim(),
              borrowerDepartment: deptSel.value,
              currentLocation: currentLocation.value.trim() || deptSel.value,
              lendDate: lendDate.value || null,
              returnDeadline: returnDeadline.value || null,
              borrowPurpose: borrowPurpose.value.trim(),
              notes: notes.value.trim(),
              approvalAttachment: approvalAttachmentPath || (record ? record.approvalAttachment : null),
            };
            if (!data.itemName) { C.toast(t('fillRequired'), 'error'); return; }
            try {
              if (record) {
                await EG.api.lending.update(record._id, data);
              } else {
                await EG.api.lending.create(data);
              }
              m.close(); C.toast(t('saved')); EG.router.navigate('lending');
            } catch (e2) { C.toast(EG.api.errMessage(e2), 'error'); }
          } }),
        ],
      });
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }
  },
};
