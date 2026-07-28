'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.search = {
  id: 'search',
  title: 'search',
  icon: 'search',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);

    const tabBar = U.el('div', { class: 'tab-bar', style: 'display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap' });
    const content = U.el('div');

    const quick = await buildQuick();
    const advanced = await buildAdvanced();
    const tabs = { quick, advanced };

    function activate(key) {
      U.clear(content);
      content.appendChild(tabs[key]);
      Array.from(tabBar.children).forEach((b) => b.classList.toggle('active', b.dataset.tab === key));
    }
    [['quick', t('quickSearch')], ['advanced', t('advancedSearch')]].forEach(([key, label]) => {
      const b = U.el('button', { class: 'tab-btn', text: label, dataset: { tab: key }, onclick: () => activate(key) });
      tabBar.appendChild(b);
    });

    view.appendChild(C.pageHeader(t('search')));
    view.appendChild(tabBar);
    view.appendChild(content);
    activate('quick');

    async function buildQuick() {
      const wrap = U.el('div');
      const prefill = (EG.state.quickQuery || '').trim();
      const kw = C.input('', { placeholder: t('searchPlaceholder'), value: prefill });
      const resultBox = U.el('div');
      const run = U.debounce(doQuick, 300);
      kw.addEventListener('input', run);

      wrap.appendChild(C.card([
        U.el('div', { class: 'form-grid' }, [
          C.fieldWrap(t('search'), kw),
        ]),
        U.el('div', { style: 'margin-top:8px' }, [C.button(t('search'), { icon: 'search', onClick: doQuick })]),
      ]));
      wrap.appendChild(resultBox);

      EG.state.quickQuery = '';
      if (prefill) doQuick();

      async function doQuick() {
        const q = kw.value.trim();
        U.clear(resultBox);
        if (!q) { resultBox.appendChild(C.emptyState('search', t('searchPlaceholder'))); return; }
        resultBox.appendChild(C.loadingBlock());
        try {
          const res = await EG.api.search.global(q, EG.state.lang);
          U.clear(resultBox);
          const groups = [
            { key: 'documents', label: t('documents'), target: 'documents' },
            { key: 'incoming', label: t('incoming'), target: 'incoming' },
            { key: 'outgoing', label: t('outgoing'), target: 'outgoing' },
            { key: 'departments', label: t('departments'), target: 'departments' },
          ];
          let any = false;
          for (const g of groups) {
            const items = (res[g.key] || []).slice(0, 10);
            if (!items.length) continue;
            any = true;
            const isDoc = g.key === 'documents';
            const cols = [g.key === 'departments' ? t('code') : t('number'), t('title')];
            if (isDoc) cols.push(t('project'));
            cols.push(t('department'), t('preview'));
            resultBox.appendChild(U.el('h4', { style: 'margin:16px 0 6px', text: g.label }));
            resultBox.appendChild(C.table(
              cols,
              items,
              { renderRow: (it) => {
                const cells = [
                  td(g.key === 'departments' ? (it.code || '') : (it.fileNumber || it.letterNumber), 'cell-title'),
                  td(g.key === 'departments' ? EG.utils.localize(it.name, EG.state.lang) : (EG.utils.localize(it.title || it.subject, EG.state.lang) || '')),
                ];
                if (isDoc) cells.push(td(it.projectName || '-'));
                cells.push(td(it.departmentCode || 'GEN'));
                cells.push(previewCell(it));
                return U.el('tr', { style: 'cursor:pointer', onclick: () => EG.router.navigate(g.target) }, cells);
              } }
            ));
          }
          if (!any) resultBox.appendChild(C.emptyState('search', t('noResults')));
        } catch (e) {
          U.clear(resultBox);
          resultBox.appendChild(C.emptyState('error', EG.api.errMessage(e)));
        }
      }
      return wrap;
    }

    async function buildAdvanced() {
      const wrap = U.el('div');
      const collectionSel = C.select([
        { value: 'incoming', label: t('incoming') },
        { value: 'outgoing', label: t('outgoing') },
        { value: 'documents', label: t('documents') },
        { value: 'departments', label: t('departments') },
      ], 'documents');
      const numberKw = C.input('', { placeholder: t('searchByNumber') });
      const subjectKw = C.input('', { placeholder: t('searchBySubject') });
      const fromEntityKw = C.input('', { placeholder: t('searchByFrom') });
      const toEntityKw = C.input('', { placeholder: t('searchByTo') });
      const { select: deptSel } = await EG.helpers.deptOptions();
      const projectKw = C.input('', { placeholder: t('searchByProject') });
      const statusSel = (() => { const s = EG.helpers.statusSelect(''); s.value = ''; return s; })();
      const prioritySel = (() => { const s = EG.helpers.prioritySelect(''); s.value = ''; return s; })();
      const fromDate = C.input('', { type: 'date' });
      const toDate = C.input('', { type: 'date' });
      const resultBox = U.el('div');

      const projectField = C.fieldWrap(t('project'), projectKw);
      const numberField = C.fieldWrap(t('number'), numberKw);
      const subjectField = C.fieldWrap(t('subject'), subjectKw);
      const fromField = C.fieldWrap(t('from'), fromEntityKw);
      const toField = C.fieldWrap(t('to'), toEntityKw);
      const fromDateField = C.fieldWrap(t('searchFrom'), fromDate);
      const toDateField = C.fieldWrap(t('searchTo'), toDate);
      const statusField = C.fieldWrap(t('searchByStatus'), statusSel);
      const priorityField = C.fieldWrap(t('priority'), prioritySel);
      const deptField = C.fieldWrap(t('searchByDepartment'), deptSel);
      const letterLabel = U.el('div', { style: 'font-weight:700;margin:6px 0 4px;color:#0f172a;' });
      const docLabel = U.el('div', { style: 'font-weight:700;margin:6px 0 4px;color:#0f172a;' });
      const dateLabelWrapper = U.el('div', { style: 'font-weight:700;margin:10px 0 4px;color:#0f172a;' });

      function syncLetterFields() {
        const isLetter = collectionSel.value === 'incoming' || collectionSel.value === 'outgoing';
        numberField.style.display = isLetter ? '' : 'none';
        subjectField.style.display = isLetter ? '' : 'none';
        fromField.style.display = isLetter ? '' : 'none';
        toField.style.display = isLetter ? '' : 'none';
        projectField.style.display = collectionSel.value === 'documents' ? '' : 'none';
        fromDateField.style.display = isLetter ? '' : 'none';
        toDateField.style.display = isLetter ? '' : 'none';
        statusField.style.display = isLetter ? '' : 'none';
        priorityField.style.display = isLetter ? '' : 'none';
        const suffix = collectionSel.value === 'incoming' ? 'incoming' : collectionSel.value === 'outgoing' ? 'outgoing' : '';
        letterLabel.style.display = isLetter ? '' : 'none';
        if (isLetter) {
          letterLabel.textContent = suffix === 'incoming' ? t('searchIncoming') : t('searchOutgoing');
        }
        docLabel.style.display = collectionSel.value === 'documents' ? '' : 'none';
        dateLabelWrapper.textContent = isLetter ? t('letterDate') : collectionSel.value === 'documents' ? t('createdAt') : '';
        dateLabelWrapper.style.display = (isLetter || collectionSel.value === 'documents') ? '' : 'none';
      }
      collectionSel.addEventListener('change', syncLetterFields);
      syncLetterFields();

      wrap.appendChild(C.card([
        U.el('div', { class: 'form-grid' }, [
          C.fieldWrap(t('reportType'), collectionSel),
          letterLabel,
          numberField,
          subjectField,
          fromField,
          toField,
          statusField,
          priorityField,
          dateLabelWrapper,
          fromDateField,
          toDateField,
          deptField,
          docLabel,
          projectField,
        ]),
        U.el('div', { style: 'margin-top:8px' }, [C.button(t('search'), { icon: 'search', onClick: run })]),
      ]));
      wrap.appendChild(resultBox);

      async function run() {
        U.clear(resultBox);
        resultBox.appendChild(C.loadingBlock());
        try {
          const collection = collectionSel.value;
          const isLetter = collection === 'incoming' || collection === 'outgoing';
          const res = await EG.api.search.advanced({
            collection,
            filters: {
              departmentCode: deptSel.value || undefined,
              projectName: collection === 'documents' ? (projectKw.value || undefined) : undefined,
              status: isLetter ? (statusSel.value || undefined) : undefined,
              priority: isLetter ? (prioritySel.value || undefined) : undefined,
              number: isLetter ? (numberKw.value || undefined) : undefined,
              subject: isLetter ? (subjectKw.value || undefined) : undefined,
              fromEntity: isLetter ? (fromEntityKw.value || undefined) : undefined,
              toEntity: isLetter ? (toEntityKw.value || undefined) : undefined,
              fromDate: isLetter ? (fromDate.value || undefined) : undefined,
              toDate: isLetter ? (toDate.value || undefined) : undefined,
            },
          });
          U.clear(resultBox);
          if (!res.length) { resultBox.appendChild(C.emptyState('search', t('noResults'))); return; }
          const isDoc = collectionSel.value === 'documents';
          const isIncoming = collectionSel.value === 'incoming';
          const cols = [isDoc ? t('fileNumber') : t('number'), t('title')];
          if (isDoc) cols.push(t('project'));
          cols.push(t('department'), t('status'), t('date'), t('preview'));
          resultBox.appendChild(C.table(
            cols,
            res,
            { renderRow: (r) => {
              const dateField = isIncoming ? r.receivedDate : isDoc ? r.createdAt : r.sentDate;
              const cells = [
                td(r.fileNumber || r.letterNumber, 'cell-title'),
                td(EG.utils.localize(r.title || r.subject, EG.state.lang)),
              ];
              if (isDoc) cells.push(td(r.projectName || '-'));
              cells.push(td(r.departmentCode || 'GEN'));
              cells.push(td('', '', C.statusBadge(r.deliveryStatus || 'active')));
              cells.push(td(EG.utils.formatDate(dateField, EG.state.lang), 'cell-soft'));
              cells.push(previewCell(r));
              return U.el('tr', {}, cells);
            } }
          ));
        } catch (e) { U.clear(resultBox); resultBox.appendChild(C.emptyState('error', EG.api.errMessage(e))); }
      }
      run();
      return wrap;
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }

    function previewCell(it) {
      if (!it.filePath) return td('');
      return td('', '', C.iconButton('eye', { title: t('preview'), onClick: (e) => { e.stopPropagation(); openPreview(it); } }));
    }

    function openPreview(d) {
      const title = EG.utils.localize(d.title || d.subject, EG.state.lang) || '-';
      const meta = U.el('div', { class: 'drawer-meta' }, [
        metaRow(t('title'), title),
        d.projectName ? metaRow(t('project'), d.projectName) : null,
        d.departmentCode ? metaRow(t('department'), d.departmentCode) : null,
        d.deliveryStatus ? metaRow(t('status'), '' , C.statusBadge(d.deliveryStatus)) : null,
        d.priority ? metaRow(t('priority'), '' , C.priorityBadge(d.priority)) : null,
        d.createdAt ? metaRow(t('date'), EG.utils.formatDate(d.createdAt, EG.state.lang)) : null,
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
      C.modal(d.fileNumber || d.letterNumber || t('preview'), body, { size: 'xl', hideFooter: true });
    }

    function metaRow(label, value, node) {
      return U.el('div', { class: 'meta-row' }, [
        U.el('span', { class: 'meta-label', text: label }),
        node || U.el('span', { class: 'meta-value', text: String(value ?? '-') }),
      ]);
    }
  },
};
