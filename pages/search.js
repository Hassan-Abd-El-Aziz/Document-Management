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
            const cols = [g.key === 'departments' ? t('code') : t('number'), t('title')];
            if (g.key === 'documents') cols.push(t('project'));
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
                if (g.key === 'documents') cells.push(td(it.projectName || '-'));
                cells.push(td(it.departmentCode || 'GEN'));
                cells.push(previewCell(it, g.key === 'departments' ? 'departments' : g.key));
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
      const resultBox = U.el('div');

      const collectionSel = C.select([
        { value: 'incoming', label: t('incoming') },
        { value: 'outgoing', label: t('outgoing') },
        { value: 'documents', label: t('documents') },
        { value: 'departments', label: t('departments') },
      ], 'documents');

      const deptCodeKw = C.input('', { placeholder: t('searchByCode') });

      const numberKw = C.input('', { placeholder: t('searchByNumber') });
      const subjectKw = C.input('', { placeholder: t('searchBySubject') });
      const fromEntityKw = C.input('', { placeholder: t('searchByFrom') });
      const toEntityKw = C.input('', { placeholder: t('searchByTo') });
      const statusSel = (() => { const s = EG.helpers.statusSelect(''); s.value = ''; return s; })();

      const docCodeKw = C.input('', { placeholder: t('searchByCode') });
      const docTitleKw = C.input('', { placeholder: t('title') });

      const localize = (v) => EG.utils.localize(v, EG.state.lang);
      const { select: deptSel, depts } = await EG.helpers.deptOptions();
      const deptNameSel = C.select(
        [{ value: '', label: t('all') }, ...depts.filter((d) => d.enabled).map((d) => ({ value: localize(d.name), label: `${d.code} - ${localize(d.name)}` }))],
        ''
      );
      let projectList = [];
      try { projectList = await EG.api.project.list(); } catch (_) { projectList = []; }
      const projectSel = C.select([{ value: '', label: t('selectProject') }, ...projectList.map((p) => ({ value: p._id, label: p.name }))], '');
      const fromDate = C.input('', { type: 'date' });
      const toDate = C.input('', { type: 'date' });

      const deptCodeField = C.fieldWrap(t('searchByCode'), deptCodeKw);
      const deptNameField = C.fieldWrap(t('searchByName'), deptNameSel);
      const numberField = C.fieldWrap(t('searchByNumber'), numberKw);
      const subjectField = C.fieldWrap(t('subject'), subjectKw);
      const fromField = C.fieldWrap(t('searchByFrom'), fromEntityKw);
      const toField = C.fieldWrap(t('searchByTo'), toEntityKw);
      const statusField = C.fieldWrap(t('searchByStatus'), statusSel);
      const docCodeField = C.fieldWrap(t('searchByCode'), docCodeKw);
      const docTitleField = C.fieldWrap(t('title'), docTitleKw);
      const docProjectField = C.fieldWrap(t('project'), projectSel);
      const deptField = C.fieldWrap(t('searchByDepartment'), deptSel);
      const fromDateField = C.fieldWrap(t('searchFrom'), fromDate);
      const toDateField = C.fieldWrap(t('searchTo'), toDate);

      const labelStyle = 'grid-column:1/-1;font-weight:700;margin:14px 0 6px;color:#0f172a;';
      const deptLabel = U.el('div', { style: labelStyle, text: t('searchByDepartment') });
      const letterLabel = U.el('div', { style: labelStyle, text: t('searchIncoming') });
      const docLabel = U.el('div', { style: labelStyle, text: t('searchByDocument') });
      const dateLabel = U.el('div', { style: labelStyle, text: t('date') });

      function syncFields() {
        const v = collectionSel.value;
        const isDept = v === 'departments';
        const isDoc = v === 'documents';
        const isLetter = v === 'incoming' || v === 'outgoing';
        letterLabel.textContent = v === 'outgoing' ? t('searchOutgoing') : t('searchIncoming');

        deptLabel.style.display = isDept ? '' : 'none';
        letterLabel.style.display = isLetter ? '' : 'none';
        docLabel.style.display = isDoc ? '' : 'none';
        dateLabel.style.display = (isLetter || isDoc) ? '' : 'none';

        deptCodeField.style.display = isDept ? '' : 'none';
        deptNameField.style.display = isDept ? '' : 'none';
        numberField.style.display = isLetter ? '' : 'none';
        subjectField.style.display = isLetter ? '' : 'none';
        fromField.style.display = isLetter ? '' : 'none';
        toField.style.display = isLetter ? '' : 'none';
        statusField.style.display = isLetter ? '' : 'none';
        docCodeField.style.display = isDoc ? '' : 'none';
        docTitleField.style.display = isDoc ? '' : 'none';
        docProjectField.style.display = isDoc ? '' : 'none';
        deptField.style.display = (isLetter || isDoc) ? '' : 'none';
        fromDateField.style.display = (isLetter || isDoc) ? '' : 'none';
        toDateField.style.display = (isLetter || isDoc) ? '' : 'none';
      }
      collectionSel.addEventListener('change', syncFields);
      syncFields();

      const grid = U.el('div', { class: 'form-grid adv-grid' });
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(210px,1fr))';
      grid.style.gap = '8px 12px';
      grid.appendChild(C.fieldWrap(t('reportType'), collectionSel));
      grid.appendChild(deptLabel);
      grid.appendChild(deptCodeField);
      grid.appendChild(deptNameField);
      grid.appendChild(letterLabel);
      grid.appendChild(numberField);
      grid.appendChild(subjectField);
      grid.appendChild(fromField);
      grid.appendChild(toField);
      grid.appendChild(statusField);
      grid.appendChild(docLabel);
      grid.appendChild(docCodeField);
      grid.appendChild(docTitleField);
      grid.appendChild(docProjectField);
      grid.appendChild(dateLabel);
      grid.appendChild(deptField);
      grid.appendChild(fromDateField);
      grid.appendChild(toDateField);

      wrap.appendChild(C.card([
        grid,
        U.el('div', { style: 'margin-top:14px' }, [C.button(t('search'), { icon: 'search', onClick: run })]),
      ]));
      wrap.appendChild(resultBox);

      async function run() {
        U.clear(resultBox);
        resultBox.appendChild(C.loadingBlock());
        try {
          const collection = collectionSel.value;
          const isLetter = collection === 'incoming' || collection === 'outgoing';
          const isDoc = collection === 'documents';
          const isDept = collection === 'departments';
          const lang = EG.state.lang;

          const filters = {};
          if (isDept) {
            if (deptCodeKw.value.trim()) filters.code = deptCodeKw.value.trim();
            if (deptNameSel.value) filters.name = deptNameSel.value;
          } else {
            if (deptSel.value) filters.departmentCode = deptSel.value;
            if (fromDate.value) filters.fromDate = fromDate.value;
            if (toDate.value) filters.toDate = toDate.value;
            if (isLetter) {
              if (numberKw.value.trim()) filters.number = numberKw.value.trim();
              if (subjectKw.value.trim()) filters.subject = subjectKw.value.trim();
              if (fromEntityKw.value.trim()) filters.fromEntity = fromEntityKw.value.trim();
              if (statusSel.value) filters.status = statusSel.value;
              if (toEntityKw.value.trim()) {
                if (collection === 'incoming') filters.toEntity = toEntityKw.value.trim();
                else filters.sentTo = toEntityKw.value.trim();
              }
            }
            if (isDoc) {
              if (docCodeKw.value.trim()) filters.fileNumber = docCodeKw.value.trim();
              if (docTitleKw.value.trim()) filters.subject = docTitleKw.value.trim();
              const selProj = projectList.find((p) => String(p._id) === String(projectSel.value));
              if (selProj) filters.projectName = selProj.name;
            }
          }

          const res = await EG.api.search.advanced({ collection, filters });
          U.clear(resultBox);
          if (!res.length) { resultBox.appendChild(C.emptyState('search', t('noResults'))); return; }

          if (isDept) {
            const cols = [t('code'), t('name'), t('manager')];
            resultBox.appendChild(C.table(cols, res, {
              renderRow: (r) => U.el('tr', {}, [
                td(r.code || '', 'cell-title'),
                td(EG.utils.localize(r.name, lang)),
                td(r.manager || '-'),
              ]),
            }));
          } else {
            const cols = [];
            cols.push(isDoc ? t('fileNumber') : t('letterNo'));
            cols.push(t('title'));
            if (isDoc) cols.push(t('project'));
            if (isLetter) { cols.push(t('from')); cols.push(t('to')); }
            cols.push(t('department'));
            if (isLetter) cols.push(t('status'));
            cols.push(t('date'));
            cols.push(t('preview'));

            resultBox.appendChild(C.table(cols, res, {
              renderRow: (r) => {
                const c = [];
                c.push(td(r.fileNumber || r.letterNumber || '', 'cell-title'));
                c.push(td(EG.utils.localize(r.title || r.subject, lang)));
                if (isDoc) c.push(td(r.projectName || '-'));
                if (isLetter) {
                  c.push(td(r.fromEntity || '-'));
                  c.push(td(r.toEntity || r.sentTo || '-'));
                }
                c.push(td(r.departmentCode || 'GEN'));
                if (isLetter) c.push(td('', '', C.statusBadge(r.deliveryStatus || 'pending')));
                const dField = isDoc ? r.createdAt : collection === 'incoming' ? r.receivedDate : r.sentDate;
                c.push(td(EG.utils.formatDate(dField, lang), 'cell-soft'));
                c.push(previewCell(r, collection));
                return U.el('tr', {}, c);
              },
            }));
          }
        } catch (e) {
          U.clear(resultBox);
          resultBox.appendChild(C.emptyState('error', EG.api.errMessage(e)));
        }
      }
      return wrap;
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }

    function previewCell(it, collection) {
      if (!it.filePath) return td('');
      return td('', '', C.iconButton('eye', { title: t('preview'), onClick: (e) => { e.stopPropagation(); openPreview(it, collection); } }));
    }

    async function openPreview(d, collection) {
      const lang = EG.state.lang;
      const title = EG.utils.localize(d.title || d.subject, lang) || '-';
      const isLetter = collection === 'incoming' || collection === 'outgoing';
      const isDoc = collection === 'documents';
      const dateVal = isDoc ? d.createdAt : collection === 'incoming' ? d.receivedDate : d.sentDate;

      const meta = U.el('div', { class: 'drawer-meta' }, [
        metaRow(t('title'), title),
        d.projectName ? metaRow(t('project'), d.projectName) : null,
        d.departmentCode ? metaRow(t('department'), d.departmentCode) : null,
        isLetter ? metaRow(t('searchByFrom'), d.fromEntity || '-') : null,
        isLetter && collection === 'incoming' ? metaRow(t('searchByTo'), d.toEntity || '-') : null,
        isLetter && collection === 'outgoing' ? metaRow(t('searchByTo'), d.sentTo || '-') : null,
        d.deliveryStatus ? metaRow(t('status'), '', C.statusBadge(d.deliveryStatus)) : null,
        dateVal ? metaRow(t('date'), EG.utils.formatDate(dateVal, lang)) : null,
        isDoc && d.shelfLocation ? metaRow(t('shelfLocation'), d.shelfLocation) : null,
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
      C.modal(d.fileNumber || d.letterNumber || d.code || t('preview'), body, { size: 'xl', hideFooter: true });
    }

    function metaRow(label, value, node) {
      return U.el('div', { class: 'meta-row' }, [
        U.el('span', { class: 'meta-label', text: label }),
        node || U.el('span', { class: 'meta-value', text: String(value ?? '-') }),
      ]);
    }
  },
};
