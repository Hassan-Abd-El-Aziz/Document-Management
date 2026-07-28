'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.documents = {
  id: 'documents',
  title: 'documents',
  icon: 'documents',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const docs = await EG.api.document.list();
      view.appendChild(C.pageHeader(t('documents'), [
        C.button(t('add'), { icon: 'plus', onClick: () => openForm(null) }),
      ]));

      const table = C.table(
        [t('fileNumber'), t('title'), t('project'), t('department'), t('fileLocation'), t('date'), t('actions')],
        docs,
        {
          renderRow: (d) => {
            const actions = U.el('div', { class: 'row-actions' }, [
              C.iconButton('eye', { title: t('preview'), onClick: () => showPreview(d) }),
              C.iconButton('edit', { title: t('edit'), variant: 'action', onClick: () => openForm(d) }),
              d.filePath ? C.iconButton('file', { title: t('openFile'), onClick: () => EG.api.file.open(d.filePath).catch((e) => C.toast(EG.api.errMessage(e), 'error')) }) : null,
              C.iconButton('trash', { title: t('delete'), variant: 'danger', onClick: () => C.confirm(t('confirmDelete'), async () => {
                try {
                  await EG.api.document.remove(d._id);
                  C.toast(t('deleted'));
                  EG.router.navigate('documents');
                } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
              }) }),
            ]);
            return U.el('tr', {}, [
              td(d.fileNumber, 'cell-title'),
              td(EG.utils.localize(d.title, EG.state.lang)),
              td(d.projectName || '-'),
              td(d.departmentCode || 'GEN'),
              td(d.shelfLocation || '-'),
              td(EG.utils.formatDate(d.createdAt, EG.state.lang), 'cell-soft'),
              td('', '', actions),
            ]);
          },
        }
      );
      view.appendChild(docs.length ? table : C.emptyState('documents', t('emptyState')));

      const docsWithoutNumbers = docs.filter((d) => !d.fileNumber || d.fileNumber.trim() === '');
      if (docsWithoutNumbers.length > 0) {
        const bulkCard = C.card([
          U.el('div', { class: 'card-title', html: EG.icon('edit', 18) + '<span>' + 'Bulk File Number Assignment (' + docsWithoutNumbers.length + ' documents without file number)' + '</span>' }),
          U.el('div', { style: 'display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap' }, [
            C.fieldWrap(t('department'), (() => { const s = C.select([{ value: 'GEN', label: 'GEN' }], 'GEN'); return s; })()),
            C.fieldWrap('Start Seq', C.input('000001', { maxlength: '6', style: 'width:110px;text-align:center' })),
            C.button('Assign Numbers', { variant: 'action', onClick: async () => {
              const deptCode = bulkCard.querySelector('select').value || 'GEN';
              const startSeq = parseInt(bulkCard.querySelector('input[maxlength="6"]').value.replace(/\D/g, '') || '1', 10);
              if (isNaN(startSeq) || startSeq < 1) { C.toast('Invalid sequence number', 'error'); return; }

              const confirmMsg = `This will assign file numbers to ${docsWithoutNumbers.length} documents starting from sequence ${String(startSeq).padStart(6, '0')} in department ${deptCode}. Continue?`;
              C.confirm(confirmMsg, async () => {
                try {
                  const year = new Date().getFullYear();
                  const updates = [];
                  for (let i = 0; i < docsWithoutNumbers.length; i++) {
                    const seq = startSeq + i;
                    const fileNumber = `${year}-${deptCode}-${String(seq).padStart(6, '0')}`;
                    updates.push({ id: docsWithoutNumbers[i]._id, fileNumber, departmentCode: deptCode });
                  }

                  for (const update of updates) {
                    await EG.api.document.update(update.id, {
                      fileNumber: update.fileNumber,
                      departmentCode: update.departmentCode,
                    });
                  }

                  C.toast(`Assigned ${updates.length} file numbers successfully`);
                  EG.router.navigate('documents');
                } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
              });
            } }),
          ]),
          U.el('div', { style: 'margin-top:8px' }, [
            U.el('small', { class: 'cell-soft', text: 'This will assign sequential file numbers to all documents that don\'t have a file number yet.' }),
          ]),
        ]);
        view.appendChild(bulkCard);
      }
    } catch (e) {
      view.appendChild(C.emptyState('error', EG.api.errMessage(e)));
    }

    async function openForm(existing) {
      const { select: deptSel } = await EG.helpers.deptOptions(existing ? existing.departmentCode : '');
      const projectPicker = await EG.helpers.projectPicker(existing ? existing.projectId : '');
      const titleAr = C.input(existing ? (EG.utils.localize(existing.title, 'ar') || '') : '', {});
      const titleEn = C.input(existing ? (EG.utils.localize(existing.title, 'en') || '') : '', {});
      const priority = EG.helpers.prioritySelect(existing ? existing.priority : 'medium');
      const notes = C.textarea(existing ? existing.notes || '' : '', {});
      const documentType = C.select([{ value: 'document', label: t('document') }, { value: 'contract', label: t('contract') }], existing ? (existing.documentType || 'document') : 'document');
      const shelfLocation = C.input(existing ? (existing.shelfLocation || '') : '', {});

      const currentYear = new Date().getFullYear();
      let fileNumber = existing ? (existing.fileNumber || '') : '';
      let yearPart = '', deptPart = '', seqPart = '000001';

      if (fileNumber) {
        const parts = fileNumber.split('-');
        if (parts.length >= 3) {
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
      const dash1 = U.el('span', { text: ' - ', style: 'align-self:center' });
      const dash2 = U.el('span', { text: ' - ', style: 'align-self:center' });

      function composeFileNumber() {
        const y = yearInput.value.trim() || String(currentYear);
        const d = deptInput.value.trim() || 'GEN';
        const s = String(parseInt(seqInput.value.replace(/\D/g, '') || '1', 10)).padStart(6, '0').slice(0, 6);
        return `${y}-${d.toUpperCase()}-${s}`;
      }

      function updateFromParts() {
        fileNumberInput.value = composeFileNumber();
      }

      const fileNumberInput = C.input(fileNumber, {});
      yearInput.addEventListener('input', updateFromParts);
      deptInput.addEventListener('input', updateFromParts);
      seqInput.addEventListener('input', updateFromParts);
      deptSel.addEventListener('change', () => {
        deptInput.value = deptSel.value || 'GEN';
        updateFromParts();
      });

      const fileNumberRow = U.el('div', { style: 'display:flex;gap:6px;align-items:center;margin-bottom:6px' }, [
        yearInput, dash1, deptInput, dash2, seqInput,
        U.el('span', { class: 'cell-soft', style: 'font-size:11px', text: existing ? t('editFileNumber') : t('suggestedFileNumber') }),
      ]);

      async function validateUnique(fn, excludeId) {
        if (!fn) return true;
        try {
          let query = 'fileNumber == $0 AND departmentCode == $1 AND deleted == false';
          const args = [fn, deptInput.value.trim()];
          if (excludeId) {
            query += ' AND _id != $2';
            args.push(excludeId);
          }
          const existingDocs = await EG.api.document.list(query, args);
          return existingDocs.length === 0;
        } catch (_) { return true; }
      }

      let filePath = null;
      const fileLabel = U.el('span', { class: 'cell-soft', text: t('fileNumber') + ': -' });
      const pickBtn = C.button(t('upload'), { icon: 'upload', variant: 'ghost', onClick: async () => { filePath = await EG.helpers.filePick(); if (filePath) fileLabel.textContent = filePath.split(/[\\/]/).pop(); } });

      const shelfRow = U.el('div', { style: 'display:flex;gap:6px;align-items:center;margin-bottom:6px' }, [
        C.fieldWrap(t('shelfLocation'), shelfLocation, { style: 'flex:1' }),
        C.button(t('addShelfLocation'), { icon: 'plus', variant: 'ghost', size: 'sm', onClick: () => openShelfModal() }),
      ]);

      async function openShelfModal() {
        let shelfObjects = [];
        try {
          shelfObjects = await EG.api.shelves.list();
        } catch (_) {}
        
        let shelves = shelfObjects.map(s => s.name || '').filter(Boolean);
        if (!shelves.length) {
          shelves = ['Shelf A', 'Shelf B', 'Shelf C', 'Shelf D', 'Safe Box'];
        }
        
        const newInput = C.input('', { placeholder: t('newShelfLocation') });
        const addBtn = C.button(t('add'), { icon: 'plus', variant: 'ghost', size: 'sm', onClick: async () => {
          const val = newInput.value.trim();
          if (!val) return;
          if (!shelves.includes(val)) {
            try {
              await EG.api.shelves.create({ name: val });
              newInput.value = '';
              shelfObjects = await EG.api.shelves.list();
              shelves = shelfObjects.map(s => s.name || '').filter(Boolean);
              renderList();
              C.toast(t('saved'));
            } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
          }
        } });
        
        const listContainer = U.el('div', { style: 'max-height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;margin-top:10px' });
        
        function renderList() {
          U.clear(listContainer);
          if (!shelves.length) {
            listContainer.appendChild(U.el('div', { style: 'padding:12px;color:var(--muted)', text: t('none') }));
            return;
          }
          shelves.forEach((name, idx) => {
            const row = U.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer' });
            row.addEventListener('click', () => {
              shelfLocation.value = name;
              m.close();
            });
            row.appendChild(U.el('span', { text: name }));
            const delBtn = C.iconButton('trash', { title: t('delete'), variant: 'danger', size: 16, onClick: async (e) => {
              e.stopPropagation();
              if (!confirm('Delete "' + name + '"?')) return;
              try {
                const shelfObj = shelfObjects.find(s => s.name === name);
                if (shelfObj && shelfObj._id) {
                  await EG.api.shelves.remove(shelfObj._id);
                }
                shelfObjects = shelfObjects.filter(s => s.name !== name);
                shelves = shelfObjects.map(s => s.name || '').filter(Boolean);
                if (shelfLocation.value === name) shelfLocation.value = '';
                renderList();
                C.toast(t('deleted'));
              } catch (err) { C.toast(EG.api.errMessage(err), 'error'); }
            } });
            row.appendChild(delBtn);
            listContainer.appendChild(row);
          });
        }
        
        renderList();
        
        const body = U.el('div', {}, [
          U.el('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:12px' }, [newInput, addBtn]),
          U.el('div', { style: 'font-size:12px;color:var(--muted);margin-bottom:6px' }, [U.el('span', { text: t('selectLocation') || 'اختر مكان الرف:' })]),
          listContainer,
        ]);
        const m = C.modal(t('addShelfLocation'), body, {
          size: 'sm',
          footer: [
            C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
            C.button(t('save'), { icon: 'save', onClick: () => m.close() }),
          ],
        });
      }

      const body = U.el('div', {}, [
        U.el('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:14px' }, [pickBtn, fileLabel]),
        C.fieldWrap(t('fileNumber'), fileNumberInput),
        fileNumberRow,
        shelfRow,
        U.el('div', { class: 'form-grid' }, [
          C.fieldWrap(t('documentType'), documentType),
          C.fieldWrap(t('department'), deptSel),
        ]),
        C.fieldWrap(t('title') + ' (AR)', titleAr),
        C.fieldWrap(t('title') + ' (EN)', titleEn),
        C.fieldWrap(t('project'), projectPicker.node),
        C.fieldWrap(t('priority'), priority),
        C.fieldWrap(t('notes'), notes),
      ]);

      const previewBtn = C.button(t('preview') || 'Preview', { icon: 'eye', variant: 'ghost', onClick: () => showPreview(existing) });
      const m = C.modal(existing ? t('edit') : t('newDocument'), body, {
        size: 'lg',
        footer: [
          existing ? previewBtn : null,
          C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
          C.button(t('save'), { icon: 'save', onClick: async () => {
            const ar = titleAr.value.trim();
            const en = titleEn.value.trim();
            if (!ar && !en) { C.toast(t('fillRequired'), 'error'); return; }

            const fileNumber = fileNumberInput.value.trim();
            if (!fileNumber) { C.toast('Please enter a file number', 'error'); return; }

            const isUnique = await validateUnique(fileNumber, existing ? existing._id : null);
            if (!isUnique) { C.toast('File number already exists in this department', 'error'); return; }

            const project = projectPicker.getSelected();
            try {
              const payload = {
                title: { ar: ar || en, en: en || ar },
                projectId: project ? project._id : null,
                projectName: project ? project.name : null,
                departmentCode: deptInput.value.trim() || 'GEN',
                departmentId: '',
                fileNumber: fileNumber,
                documentType: documentType.value,
                shelfLocation: shelfLocation.value.trim() || null,
                priority: priority.value,
                notes: notes.value,
                fileSrc: filePath,
              };
              if (existing) {
                await EG.api.document.update(existing._id, payload);
              } else {
                await EG.api.document.create(payload);
              }
              m.close(); C.toast(t('saved')); EG.router.navigate('documents');
            } catch (e2) { C.toast(EG.api.errMessage(e2), 'error'); }
          } }),
        ].filter(Boolean),
      });

      if (!fileNumber) {
        setTimeout(updateFromParts, 50);
      }
    }

    async function showPreview(doc) {
      if (!doc) return;
      const previewBody = U.el('div', {}, [
        U.el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
          U.el('div', {}, [U.el('strong', { text: t('fileNumber') }), U.el('div', { text: doc.fileNumber || '-' })]),
          U.el('div', {}, [U.el('strong', { text: t('department') }), U.el('div', { text: doc.departmentCode || '-' })]),
          U.el('div', {}, [U.el('strong', { text: t('project') }), U.el('div', { text: doc.projectName || '-' })]),
          U.el('div', {}, [U.el('strong', { text: t('date') }), U.el('div', { text: EG.utils.formatDate(doc.createdAt, EG.state.lang) })]),
          U.el('div', { style: 'grid-column:1/-1' }, [U.el('strong', { text: t('title') + ' (AR)' }), U.el('div', { text: EG.utils.localize(doc.title, 'ar') || '-' })]),
          U.el('div', { style: 'grid-column:1/-1' }, [U.el('strong', { text: t('title') + ' (EN)' }), U.el('div', { text: EG.utils.localize(doc.title, 'en') || '-' })]),
        ]),
      ]);
      const pm = C.modal(t('preview') || 'Preview', previewBody, {
        footer: [C.button(t('close'), { variant: 'ghost', onClick: () => pm.close() })],
      });
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }
  },
};
