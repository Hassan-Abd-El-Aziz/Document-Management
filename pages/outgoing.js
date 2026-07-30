'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.outgoing = {
  id: 'outgoing',
  title: 'outgoing',
  icon: 'outgoing',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const items = await EG.api.outgoing.list();
      view.appendChild(C.pageHeader(t('outgoing'), [C.button(t('add'), { icon: 'plus', onClick: () => openForm() })]));
      const table = C.table(
        [t('number'), t('subject'), t('to'), t('department'), t('status'), t('priority'), t('date'), t('actions')],
        items,
        {
          renderRow: (d) => {
            const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
            const actions = U.el('div', { class: 'row-actions' }, [
              C.iconButton('eye', { title: t('preview'), onClick: stop(() => openPreview(d)) }),
              C.iconButton('edit', { title: t('edit'), variant: 'action', onClick: stop(() => openEdit(d)) }),
              d.filePath ? C.iconButton('file', { title: t('openFile'), onClick: stop(() => EG.api.file.open(d.filePath).catch(() => C.toast(t('fileNotFound'), 'error'))) }) : null,
              d.deliveryStatus !== 'delivered' ? C.iconButton('sig', { title: t('signNow'), variant: 'action', onClick: stop(() => openSign(d)) }) : C.iconButton('check', { title: t('delivered'), variant: 'action' }),
              C.iconButton('history', { title: t('history'), onClick: stop(() => openStatus(d)) }),
              EG.helpers.canDelete() ? C.iconButton('trash', { title: t('delete'), variant: 'danger', onClick: stop(() => C.confirm(t('confirmDelete'), async () => {
                try {
                  await EG.api.outgoing.remove(d._id);
                  C.toast(t('deleted'));
                  EG.router.navigate('outgoing');
                } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
              })) }) : null,
            ]);
            return U.el('tr', { style: 'cursor:pointer', onclick: () => openStatus(d) }, [
              td(d.letterNumber, 'cell-title'), td(EG.utils.localize(d.subject, EG.state.lang)), td(d.sentTo || '-'),
              td(d.departmentCode || 'GEN'), td('', '', C.statusBadge(d.deliveryStatus)), td('', '', C.priorityBadge(d.priority)),
              td(EG.utils.formatDate(d.sentDate, EG.state.lang), 'cell-soft'), td('', '', actions),
            ]);
          },
        }
      );
      view.appendChild(items.length ? table : C.emptyState('outgoing', t('emptyState')));
    } catch (e) { view.appendChild(C.emptyState('error', EG.api.errMessage(e))); }

    async function openForm(existing) {
      const { select: deptSel } = await EG.helpers.deptOptions();
      const subAr = C.input('', {}), subEn = C.input('', {});
      const sentTo = C.input('', {}), from = C.input('', {}), deliveredBy = C.input('', {});
      const priority = EG.helpers.prioritySelect('medium');
      const status = EG.helpers.statusSelect('pending');
      const notes = C.textarea('', {});
      const letterDate = C.input('', { type: 'date' });
      letterDate.value = new Date().toISOString().split('T')[0];

      const currentYear = new Date().getFullYear();
      const TYPE_LABEL = 'OL';
      let letterNumber = existing ? (existing.letterNumber || '') : '';
      let yearPart = '', deptPart = '', seqPart = '000001';

      if (letterNumber) {
        const parts = letterNumber.split('-');
        if (parts.length >= 4 && parts[2] === TYPE_LABEL) {
          yearPart = parts[0];
          deptPart = parts[1];
          seqPart = parts[3];
        } else if (parts.length >= 4 && parts[2] === 'Out') {
          yearPart = parts[0];
          deptPart = parts[1];
          seqPart = parts[3];
        } else if (parts.length >= 4 && parts[0] === 'OUT') {
          yearPart = parts[1];
          deptPart = parts[2];
          seqPart = parts[3];
        } else if (parts.length >= 3) {
          yearPart = parts[0];
          deptPart = parts[1];
          seqPart = parts[2];
        }
      } else {
        yearPart = String(currentYear);
        deptPart = deptSel.value || 'GEN';
        seqPart = '000001';
      }
      deptSel.value = deptPart;

      const yearInput = C.input(yearPart, { style: 'width:70px;text-align:center', maxlength: '4' });
      const deptInput = C.input(deptPart, { style: 'width:90px;text-align:center', maxlength: '10' });
      const seqInput = C.input(seqPart, { style: 'width:110px;text-align:center', maxlength: '6' });
      const typeLabel = U.el('span', { text: ' - ' + TYPE_LABEL + ' - ', style: 'font-weight:bold;align-self:center' });
      const dash1 = U.el('span', { text: ' - ', style: 'align-self:center' });

      function composeLetterNumber() {
        const y = yearInput.value.trim() || String(currentYear);
        const d = deptInput.value.trim() || 'GEN';
        const s = String(parseInt(seqInput.value.replace(/\D/g, '') || '1', 10)).padStart(6, '0').slice(0, 6);
        return `${y}-${d.toUpperCase()}-${TYPE_LABEL}-${s}`;
      }

      function updateFromParts() {
        letterNumberInput.value = composeLetterNumber();
      }

      const letterNumberInput = C.input(letterNumber, {});
      yearInput.addEventListener('input', updateFromParts);
      deptInput.addEventListener('input', updateFromParts);
      seqInput.addEventListener('input', updateFromParts);
      deptSel.addEventListener('change', () => {
        deptInput.value = deptSel.value || 'GEN';
        updateFromParts();
      });

      const letterNumberRow = U.el('div', { style: 'display:flex;gap:6px;align-items:center;margin-bottom:6px' }, [
        yearInput, dash1, deptInput, typeLabel, seqInput,
        U.el('span', { class: 'cell-soft', style: 'font-size:11px', text: existing ? t('editLetterNumber') : t('suggestedLetterNumber') }),
      ]);

      let filePath = null;
      const fileLabel = U.el('span', { class: 'cell-soft' });
      const body = U.el('div', {}, [
        U.el('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:14px' }, [C.button(t('upload'), { icon: 'upload', variant: 'ghost', onClick: async () => { filePath = await EG.helpers.filePick(); if (filePath) fileLabel.textContent = filePath.split(/[\\/]/).pop(); } }), fileLabel]),
        C.fieldWrap(t('letterNumber'), letterNumberInput),
        letterNumberRow,
        C.fieldWrap(t('letterDate'), letterDate),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('subject') + ' (AR)', subAr), C.fieldWrap(t('subject') + ' (EN)', subEn)]),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('to'), sentTo), C.fieldWrap(t('from'), from)]),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('department'), deptSel), C.fieldWrap(t('receivedBy'), deliveredBy)]),
        C.fieldWrap(t('priority'), priority),
        C.fieldWrap(t('status'), status),
        C.fieldWrap(t('notes'), notes),
      ]);
      const m = C.modal(existing ? t('edit') : t('newOutgoing'), body, {
        size: 'lg',
        footer: [
          C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
          C.button(t('save'), { icon: 'save', onClick: async () => {
            if (!subAr.value.trim()) { C.toast(t('fillRequired'), 'error'); return; }
            const letterNumber = letterNumberInput.value.trim();
            if (!letterNumber) { C.toast('Please enter a letter number', 'error'); return; }
            try {
              await EG.api.outgoing.create({ letterNumber, subject: { ar: subAr.value.trim() || subEn.value.trim(), en: subEn.value.trim() || subAr.value.trim() }, sentTo: sentTo.value, fromEntity: from.value, departmentCode: deptInput.value.trim() || 'GEN', deliveredBy: deliveredBy.value, priority: priority.value, deliveryStatus: status.value, notes: notes.value, sentDate: letterDate.value, fileSrc: filePath });
              m.close(); C.toast(t('created')); EG.router.navigate('outgoing');
            } catch (e2) { C.toast(EG.api.errMessage(e2), 'error'); }
          } }),
        ],
      });

      if (!existing) {
        setTimeout(() => EG.api.outgoing.suggestNextLetterNumber(deptSel.value || 'GEN').then((suggested) => {
          if (suggested && !letterNumber) {
            const parts = suggested.split('-');
            if (parts.length >= 3) {
              yearInput.value = parts[0];
              deptInput.value = parts[1];
              seqInput.value = parts[2];
              updateFromParts();
            }
          }
        }).catch(() => {}), 100);
      }
    }

    async function openEdit(d) {
      const { select: deptSel } = await EG.helpers.deptOptions(d.departmentCode);
      const subAr = C.input(EG.utils.localize(d.subject, 'ar') || '', {});
      const subEn = C.input(EG.utils.localize(d.subject, 'en') || '', {});
      const sentTo = C.input(d.sentTo || '', {});
      const from = C.input(d.fromEntity || '', {});
      const deliveredBy = C.input(d.deliveredBy || '', {});
      const priority = EG.helpers.prioritySelect(d.priority || 'medium');
      const status = EG.helpers.statusSelect(d.deliveryStatus || 'pending');
      const notes = C.textarea(d.notes || '', {});
      const letterDate = C.input('', { type: 'date' });
      letterDate.value = d.sentDate ? new Date(d.sentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      let filePath = d.filePath || null;
      const fileLabel = U.el('span', { class: 'cell-soft', text: filePath ? filePath.split(/[\\/]/).pop() : '' });

      const currentYear = new Date().getFullYear();
      const TYPE_LABEL = 'OL';
      const letterNumber = d.letterNumber || '';
      let yearPart = '', deptPart = '', seqPart = '000001';
      if (letterNumber) {
        const parts = letterNumber.split('-');
        if (parts.length >= 4 && parts[2] === TYPE_LABEL) {
          yearPart = parts[0];
          deptPart = parts[1];
          seqPart = parts[3];
        } else if (parts.length >= 4 && parts[2] === 'Out') {
          yearPart = parts[0];
          deptPart = parts[1];
          seqPart = parts[3];
        } else if (parts.length >= 4 && parts[0] === 'OUT') {
          yearPart = parts[1];
          deptPart = parts[2];
          seqPart = parts[3];
        } else if (parts.length >= 3) {
          yearPart = parts[0];
          deptPart = parts[1];
          seqPart = parts[2];
        }
      }
      deptSel.value = deptPart || d.departmentCode || 'GEN';

      const yearInput = C.input(yearPart, { style: 'width:70px;text-align:center', maxlength: '4' });
      const deptInput = C.input(deptPart, { style: 'width:90px;text-align:center', maxlength: '10' });
      const seqInput = C.input(seqPart, { style: 'width:110px;text-align:center', maxlength: '6' });
      const typeLabel = U.el('span', { text: ' - OL - ', style: 'font-weight:bold;align-self:center' });
      const dash1 = U.el('span', { text: ' - ', style: 'align-self:center' });

      function composeLetterNumber() {
        const y = yearInput.value.trim() || String(currentYear);
        const d = deptInput.value.trim() || 'GEN';
        const s = String(parseInt(seqInput.value.replace(/\D/g, '') || '1', 10)).padStart(6, '0').slice(0, 6);
        return `${y}-${d.toUpperCase()}-OL-${s}`;
      }

      function updateFromParts() {
        letterNumberInput.value = composeLetterNumber();
      }

      const letterNumberInput = C.input(letterNumber, {});
      yearInput.addEventListener('input', updateFromParts);
      deptInput.addEventListener('input', updateFromParts);
      seqInput.addEventListener('input', updateFromParts);
      deptSel.addEventListener('change', () => {
        deptInput.value = deptSel.value || 'GEN';
        updateFromParts();
      });

      const letterNumberRow = U.el('div', { style: 'display:flex;gap:6px;align-items:center;margin-bottom:6px' }, [
        yearInput, dash1, deptInput, typeLabel, seqInput,
        U.el('span', { class: 'cell-soft', style: 'font-size:11px', text: t('editLetterNumber') }),
      ]);

      const body = U.el('div', {}, [
        U.el('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:14px' }, [C.button(t('upload'), { icon: 'upload', variant: 'ghost', onClick: async () => { filePath = await EG.helpers.filePick(); if (filePath) fileLabel.textContent = filePath.split(/[\\/]/).pop(); } }), fileLabel]),
        C.fieldWrap(t('letterNumber'), letterNumberInput),
        letterNumberRow,
        C.fieldWrap(t('letterDate'), letterDate),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('subject') + ' (AR)', subAr), C.fieldWrap(t('subject') + ' (EN)', subEn)]),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('to'), sentTo), C.fieldWrap(t('from'), from)]),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('department'), deptSel), C.fieldWrap(t('receivedBy'), deliveredBy)]),
        C.fieldWrap(t('priority'), priority),
        C.fieldWrap(t('status'), status),
        C.fieldWrap(t('notes'), notes),
      ]);
      const previewBtn = C.button(t('preview') || 'Preview', { icon: 'eye', variant: 'ghost', onClick: () => openPreview(d) });
      const m = C.modal(t('edit'), body, {
        size: 'lg',
        footer: [
          previewBtn,
          C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
          C.button(t('save'), { icon: 'save', onClick: async () => {
            if (!subAr.value.trim()) { C.toast(t('fillRequired'), 'error'); return; }
            const letterNumber = letterNumberInput.value.trim();
            if (!letterNumber) { C.toast('Please enter a letter number', 'error'); return; }
            try {
              await EG.api.outgoing.update(d._id, { letterNumber, subject: { ar: subAr.value.trim() || subEn.value.trim(), en: subEn.value.trim() || subAr.value.trim() }, sentTo: sentTo.value, fromEntity: from.value, departmentCode: deptInput.value.trim() || 'GEN', deliveredBy: deliveredBy.value, priority: priority.value, deliveryStatus: status.value, notes: notes.value, sentDate: letterDate.value, fileSrc: filePath });
              m.close(); C.toast(t('saved')); EG.router.navigate('outgoing');
            } catch (e2) { C.toast(EG.api.errMessage(e2), 'error'); }
          } }),
        ],
      });
    }

    function openStatus(d) {
      const sel = EG.helpers.statusSelect(d.deliveryStatus);
      const note = C.input(d.notes || '', {});
      const subAr = U.el('span', { class: 'meta-value', text: EG.utils.localize(d.subject, EG.state.lang) || '-' }),
        subEn = U.el('span', { class: 'meta-value', text: EG.utils.localize(d.subject && d.subject.en, EG.state.lang) || '-' });
      if (d.subject && d.subject.ar) { const s = document.createElement('span'); s.className = 'meta-value meta-dir'; s.textContent = d.subject.ar; subAr.textContent = ''; subAr.appendChild(s); }
      if (d.subject && d.subject.en) { const s = document.createElement('span'); s.className = 'meta-value meta-dir'; s.textContent = d.subject.en; subEn.textContent = ''; subEn.appendChild(s); }
      const hist = U.el('div', { style: 'margin-top:14px' });
      (d.history || []).slice().reverse().forEach((h) => {
        hist.appendChild(U.el('div', { style: 'display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)' }, [
          U.el('span', { class: 'notif-dot', style: 'margin-top:6px' }),
          U.el('div', {}, [U.el('strong', { text: t(h.action) + (h.status ? ' · ' + t(h.status) : '') }), U.el('div', { class: 'cell-soft', text: (h.note || '') + ' — ' + (h.by || '') + ' · ' + EG.utils.formatDateTime(h.at, EG.state.lang) })]),
        ]));
      });
      const details = U.el('div', { class: 'detail-grid' }, [
        metaRow(t('number'), d.letterNumber || '-'),
        metaRow(t('subject') + ' (AR)', subAr),
        metaRow(t('subject') + ' (EN)', subEn),
        metaRow(t('to'), d.sentTo || '-'),
        metaRow(t('from'), d.fromEntity || '-'),
        metaRow(t('department'), (d.departmentCode || 'GEN')),
        metaRow(t('receivedBy'), d.deliveredBy || '-'),
        metaRow(t('receiver'), d.receiver || '-'),
        metaRow(t('priority'), '' , C.statusBadge(d.priority || 'medium')),
        metaRow(t('date'), EG.utils.formatDate(d.sentDate, EG.state.lang)),
      ]);
      const body = U.el('div', {}, [
        details,
        U.el('div', { style: 'height:1px;background:var(--border);margin:14px 0' }),
        C.fieldWrap(t('status'), sel),
        C.fieldWrap(t('notes'), note),
        U.el('p', { class: 'cell-soft', text: t('history') }),
        hist,
      ]);
      const m = C.modal(t('editLetter') || t('status'), body, {
        size: 'lg',
        footer: [C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
          C.button(t('save'), { icon: 'check', onClick: async () => { try { await EG.api.outgoing.updateStatus(d._id, sel.value, note.value); m.close(); C.toast(t('saved')); EG.router.navigate('outgoing'); } catch (e) { C.toast(EG.api.errMessage(e), 'error'); } } })],
      });

      function metaRow(label, value, node) {
        return U.el('div', { class: 'meta-row' }, [
          U.el('span', { class: 'meta-label', text: label }),
          node || U.el('span', { class: 'meta-value', text: String(value ?? '-') }),
        ]);
      }
    }

    function openSign(d) {
      const name = C.input(d.receiver || '', {});
      const note = C.input('', {});
      const sigLabel = U.el('span', { class: 'cell-soft' });
      let sigPath = null;
      const body = U.el('div', {}, [
        U.el('p', { class: 'cell-soft', text: d.letterNumber + ' — ' + EG.utils.localize(d.subject, EG.state.lang) }),
        C.fieldWrap(t('receiverName'), name),
        C.fieldWrap(t('notes'), note),
        U.el('div', { style: 'display:flex;gap:10px;align-items:center' }, [
          C.button(t('upload'), { icon: 'upload', variant: 'ghost', onClick: async () => { sigPath = await EG.helpers.filePick([{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }]); if (sigPath) sigLabel.textContent = sigPath.split(/[\\/]/).pop(); } }),
          sigLabel,
        ]),
      ]);
      const m = C.modal(t('signNow'), body, {
        size: 'lg',
        footer: [C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
          C.button(t('sign'), { icon: 'sig', onClick: async () => {
            if (!name.value.trim()) { C.toast(t('error'), 'error'); return; }
            await EG.api.outgoing.signReceipt(d._id, { receiverName: name.value.trim(), note: note.value, signatureSrc: sigPath });
            m.close(); C.toast(t('saved')); EG.router.navigate('outgoing');
          } })],
      });
    }

    function openPreview(d) {
      const meta = U.el('div', { class: 'drawer-meta' }, [
        metaRow(t('subject'), '' , U.el('span', { class: 'meta-value', text: EG.utils.localize(d.subject, EG.state.lang) || '-' })),
        metaRow(t('to'), d.sentTo || '-'),
        metaRow(t('from'), d.fromEntity || '-'),
        metaRow(t('department'), d.departmentCode || 'GEN'),
        metaRow(t('status'), '' , C.statusBadge(d.deliveryStatus)),
        metaRow(t('priority'), '' , C.priorityBadge(d.priority)),
        metaRow(t('date'), EG.utils.formatDate(d.sentDate, EG.state.lang)),
        d.receiver ? metaRow(t('receiver'), d.receiver) : null,
        d.notes ? metaRow(t('notes'), d.notes) : null,
      ]);

      const preview = U.el('div', { class: 'preview-box' });
      if (d.filePath) {
        const ext = (d.filePath.split('.').pop() || '').toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
          preview.appendChild(U.el('img', { src: 'file:///' + d.filePath.replace(/\\/g, '/'), class: 'preview-img' }));
        } else if (ext === 'pdf') {
          preview.appendChild(U.el('iframe', { src: 'file:///' + d.filePath.replace(/\\/g, '/'), class: 'preview-frame' }));
        } else {
          preview.appendChild(U.el('div', { class: 'cell-soft', style: 'padding:20px' }, [
            U.el('p', { text: d.filePath.split(/[\\/]/).pop() }),
            C.button(t('openFile'), { icon: 'file', variant: 'ghost', size: 'sm', onClick: () => EG.api.file.open(d.filePath).catch(() => C.toast(t('fileNotFound'), 'error')) }),
          ]));
        }
      } else {
        preview.appendChild(U.el('div', { class: 'cell-soft', style: 'padding:20px', text: t('emptyState') }));
      }

      const body = U.el('div', {}, [meta, U.el('h4', { style: 'margin:18px 0 10px', text: t('preview') }), preview]);
      C.modal(d.letterNumber || t('preview'), body, { size: 'xl', hideFooter: true });

      function metaRow(label, value, node) {
        return U.el('div', { class: 'meta-row' }, [
          U.el('span', { class: 'meta-label', text: label }),
          node || U.el('span', { class: 'meta-value', text: String(value ?? '-') }),
        ]);
      }
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }
  },
};
