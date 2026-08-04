'use strict';

window.EG = window.EG || {};

EG.helpers = (function () {
  const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);

  async function filePick(filters) {
    const res = await EG.api.file.pick({ filters: filters || [{ name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'txt'] }] });
    if (res.canceled || !res.paths.length) return null;
    return res.paths[0];
  }

  async function deptOptions(selected) {
    let depts = [];
    try { depts = await EG.api.department.list(); } catch (_) {}
    const opts = [{ value: '', label: t('all') }];
    depts.filter((d) => d.enabled).forEach((d) => opts.push({ value: d.code, label: `${d.code} - ${EG.utils.localize(d.name, EG.state.lang)}` }));
    return { select: C.select(opts, selected || ''), depts };
  }

  // Project selector with a combined "add + list" modal.
  // Returns { node, select, getSelected, reload }.
  async function projectPicker(selected, opts = {}) {
    const wrap = U.el('div', { style: 'display:flex;gap:8px;align-items:stretch' });
    const sel = C.select([{ value: '', label: t('selectProject') }], selected || '', { style: 'flex:1' });
    let projects = [];

    function fill(list, keep) {
      const val = keep != null ? keep : sel.value;
      U.clear(sel);
      const placeholder = U.el('option', { value: '', text: t('selectProject') });
      sel.appendChild(placeholder);
      list.forEach((p) => {
        const o = U.el('option', { value: p._id, text: p.name });
        if (p._id === val) o.selected = true;
        sel.appendChild(o);
      });
    }

    async function reload(keep) {
      try { projects = await EG.api.project.list(); } catch (_) { projects = []; }
      fill(projects, keep);
    }

    const addBtn = C.button('', { icon: 'plus', variant: 'ghost', onClick: () => openProjectPickerModal(async (chosen) => {
      await reload(chosen ? chosen._id : undefined);
      if (opts.onAdd) opts.onAdd(chosen);
    }) });
    addBtn.title = t('addProject');

    wrap.appendChild(sel);
    if (!opts.hideAdd) wrap.appendChild(addBtn);
    await reload(selected);

    return {
      node: wrap,
      select: sel,
      reload,
      getSelected: () => projects.find((p) => p._id === sel.value) || null,
    };
  }

  async function openProjectPickerModal(onChosen) {
    let projects = [];
    try { projects = await EG.api.project.list(); } catch (_) { projects = []; }

    const name = C.input('', {});
    const address = C.input('', {});
    const elevators = C.input('', { type: 'number', min: '0' });
    const models = C.input('', { type: 'number', min: '0' });
    const floors = C.input('', { type: 'number', min: '0' });
    const manager = C.input('', {});
    const managerPhone = C.input('', { type: 'tel' });
    const owner = C.input('', {});
    const consultant = C.input('', {});
    const notes = C.textarea('', {});

    const formSection = U.el('div', { style: 'margin-bottom:14px' }, [
      U.el('div', { class: 'form-grid' }, [
        C.fieldWrap(t('projectName'), name),
        C.fieldWrap(t('projectAddress'), address),
        C.fieldWrap(t('elevators'), elevators),
        C.fieldWrap(t('models'), models),
        C.fieldWrap(t('floors'), floors),
        C.fieldWrap(t('projectManager'), manager),
        C.fieldWrap(t('projectManagerPhone'), managerPhone),
        C.fieldWrap(t('projectOwner'), owner),
        C.fieldWrap(t('projectConsultant'), consultant),
      ]),
      C.fieldWrap(t('notes'), notes),
      U.el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, [
        C.button(t('save'), { icon: 'save', variant: 'primary', size: 'sm', onClick: async () => {
          const payload = {
            name: name.value.trim(),
            address: address.value.trim(),
            elevators: Number(elevators.value) || 0,
            models: Number(models.value) || 0,
            floors: Number(floors.value) || 0,
            manager: manager.value.trim(),
            managerPhone: managerPhone.value.trim(),
            owner: owner.value.trim(),
            consultant: consultant.value.trim(),
            notes: notes.value.trim(),
          };
          if (!payload.name) { C.toast(t('projectNameRequired'), 'error'); return; }
          try {
            const saved = await EG.api.project.create(payload);
            projects.push(saved);
            renderTable();
            name.value = ''; address.value = ''; elevators.value = ''; models.value = ''; floors.value = '';
            manager.value = ''; managerPhone.value = ''; owner.value = ''; consultant.value = ''; notes.value = '';
            C.toast(t('projectSaved'));
            if (onChosen) onChosen(saved);
          } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
        } }),
      ]),
    ]);

    const tableWrap = U.el('div', { class: 'table-wrap', style: 'max-height:320px;overflow-y:auto' });
    const tableEl = U.el('table', { class: 'table' });
    const thead = U.el('thead', {}, [
      U.el('tr', {}, [
        U.el('th', { text: t('projectName') }),
        U.el('th', { text: t('projectAddress') }),
        U.el('th', { text: t('elevators') }),
        U.el('th', { text: t('models') }),
        U.el('th', { text: t('floors') }),
        U.el('th', { text: t('projectManager') }),
        U.el('th', { text: t('actions') }),
      ]),
    ]);
    const tbody = U.el('tbody');
    tableEl.appendChild(thead);
    tableEl.appendChild(tbody);
    tableWrap.appendChild(tableEl);

    function renderTable() {
      U.clear(tbody);
      if (!projects.length) {
        tbody.appendChild(U.el('tr', {}, [U.el('td', { colspan: 7, class: 'table-empty', text: t('none') })]));
        return;
      }
      projects.forEach((p) => {
        const tr = U.el('tr', { style: 'cursor:pointer' }, [
          td(p.name || '-'),
          td(p.address || '-'),
          td(String(p.elevators ?? 0)),
          td(String(p.models ?? 0)),
          td(String(p.floors ?? 0)),
          td(p.manager || '-'),
          td('', '', U.el('div', { class: 'row-actions' }, [
            C.iconButton('edit', { title: t('edit'), variant: 'action', size: 16, onClick: async (e) => {
              e.stopPropagation();
              await openProjectPickerEditModal(p, async (updated) => {
                const idx = projects.findIndex((x) => x._id === updated._id);
                if (idx >= 0) projects[idx] = updated;
                renderTable();
                if (onChosen) onChosen(updated);
              });
            } }),
            EG.helpers.canDelete() ? C.iconButton('trash', { title: t('delete'), variant: 'danger', size: 16, onClick: async (e) => {
              e.stopPropagation();
              try {
                await EG.api.project.remove(p._id);
                projects = projects.filter((x) => x._id !== p._id);
                renderTable();
                C.toast(t('deleted'));
              } catch (err) { C.toast(EG.api.errMessage(err), 'error'); }
            } }) : null,
          ])),
        ]);
        tr.addEventListener('click', () => {
          if (onChosen) onChosen(p);
          m.close();
        });
        tbody.appendChild(tr);
      });
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      const c = U.el('td', { class: cls || '' });
      c.textContent = String(txt ?? '-');
      return c;
    }

    renderTable();

    const body = U.el('div', {}, [formSection, tableWrap]);
    const m = C.modal(t('projects'), body, {
      size: 'xl',
      footer: [
        C.button(t('close'), { variant: 'ghost', onClick: () => m.close() }),
      ],
    });
  }

  async function openProjectPickerEditModal(project, onUpdated) {
    const name = C.input(project ? project.name || '' : '', {});
    const address = C.input(project ? project.address || '' : '', {});
    const elevators = C.input(project ? (project.elevators ?? '') : '', { type: 'number', min: '0' });
    const models = C.input(project ? (project.models ?? '') : '', { type: 'number', min: '0' });
    const floors = C.input(project ? (project.floors ?? '') : '', { type: 'number', min: '0' });
    const manager = C.input(project ? project.manager || '' : '', {});
    const managerPhone = C.input(project ? project.managerPhone || '' : '', { type: 'tel' });
    const owner = C.input(project ? project.owner || '' : '', {});
    const consultant = C.input(project ? project.consultant || '' : '', {});
    const notes = C.textarea(project ? project.notes || '' : '', {});

    const body = U.el('div', {}, [
      U.el('div', { class: 'form-grid' }, [
        C.fieldWrap(t('projectName'), name),
        C.fieldWrap(t('projectAddress'), address),
        C.fieldWrap(t('elevators'), elevators),
        C.fieldWrap(t('models'), models),
        C.fieldWrap(t('floors'), floors),
        C.fieldWrap(t('projectManager'), manager),
        C.fieldWrap(t('projectManagerPhone'), managerPhone),
        C.fieldWrap(t('projectOwner'), owner),
        C.fieldWrap(t('projectConsultant'), consultant),
      ]),
      C.fieldWrap(t('notes'), notes),
      U.el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, [
        C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
        C.button(t('save'), { icon: 'save', variant: 'primary', onClick: async () => {
          const payload = {
            name: name.value.trim(),
            address: address.value.trim(),
            elevators: Number(elevators.value) || 0,
            models: Number(models.value) || 0,
            floors: Number(floors.value) || 0,
            manager: manager.value.trim(),
            managerPhone: managerPhone.value.trim(),
            owner: owner.value.trim(),
            consultant: consultant.value.trim(),
            notes: notes.value.trim(),
          };
          if (!payload.name) { C.toast(t('projectNameRequired'), 'error'); return; }
          try {
            const updated = await EG.api.project.update(project._id, payload);
            m.close();
            C.toast(t('projectSaved'));
            if (onUpdated) onUpdated(updated);
          } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
        } }),
      ]),
    ]);

    const m = C.modal(t('edit'), body, {
      size: 'lg',
      footer: [],
    });
    setTimeout(() => name.focus(), 50);
    return m;
  }

  async function tagEditor(initial = []) {
    let tags = initial || [];
    const wrap = U.el('div', { class: 'tag-editor' });
    const input = C.input('', { placeholder: t('tags') });
    const list = U.el('div', { class: 'tag-list', style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px' });
    function render() {
      U.clear(list);
      tags.forEach((tg, i) => {
        const chip = U.el('span', { class: 'badge badge-info', style: 'display:inline-flex;gap:6px;align-items:center' }, [
          U.el('span', { text: tg }),
          U.el('span', { html: EG.icon('close', 12), style: 'cursor:pointer', onclick: () => { tags.splice(i, 1); render(); } }),
        ]);
        list.appendChild(chip);
      });
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) { e.preventDefault(); tags.push(input.value.trim()); input.value = ''; render(); }
    });
    wrap.appendChild(input);
    wrap.appendChild(list);
    render();
    return { node: wrap, get: () => tags, set: (v) => { tags = v || []; render(); } };
  }

    function statusSelect(value) {
      const opts = ['pending', 'received', 'delivered', 'rejected', 'cancelled'].map((s) => ({ value: s, label: t(s) }));
      return C.select(opts, value || 'pending');
    }

  function prioritySelect(value) {
    const opts = ['low', 'medium', 'high', 'urgent'].map((s) => ({ value: s, label: t(s) }));
    return C.select(opts, value || 'medium');
  }

  function confirmDelete(name, onConfirm) {
    C.confirm(t('confirmDelete'), () => { onConfirm(); }, { title: t('delete') });
  }

  function canDelete() {
    const user = EG.state.user;
    return user && user.role === 'admin';
  }

  function crudPage(opts) {
    return async function (view) {
      U.clear(view);
      try {
        const data = await opts.fetch();
        view.appendChild(C.pageHeader(t(opts.title), [
          C.button(t('add'), { icon: 'plus', onClick: () => opts.onAdd() }),
        ]));
        view.appendChild(opts.renderTable(data));
      } catch (e) {
        view.appendChild(C.emptyState('error', EG.api.errMessage(e)));
      }
    };
  }

  function buildQrText(item) {
    if (!item) return '';
    const title = EG.utils.localize(item.title || item.subject, EG.state.lang) || '';
    const code = item.fileNumber || item.letterNumber || '';
    const project = item.projectName || item.project || '';
    const location = item.shelfLocation || '';
    const dept = item.departmentCode || 'GEN';
    const lines = [
      t('qrFileCode') + ': ' + (code || '-'),
      t('qrFileTitle') + ': ' + (title || '-'),
    ];
    if (project) lines.push(t('project') + ': ' + project);
    lines.push(t('fileLocation') + ': ' + location);
    lines.push(t('department') + ': ' + dept);
    if (item.fromEntity) lines.push(t('from') + ': ' + item.fromEntity);
    if (item.toEntity) lines.push(t('to') + ': ' + item.toEntity);
    if (item.sentTo) lines.push(t('to') + ': ' + item.sentTo);
    if (item.receivedBy) lines.push(t('receivedBy') + ': ' + item.receivedBy);
    if (item.receiver) lines.push(t('receiver') + ': ' + item.receiver);
    if (item.deliveryStatus) lines.push(t('status') + ': ' + t(item.deliveryStatus));
    const d = item.createdAt || item.receivedDate || item.sentDate;
    if (d) lines.push(t('date') + ': ' + EG.utils.formatDate(d, EG.state.lang));
    if (item.notes) lines.push(t('notes') + ': ' + item.notes);
    return lines.join('\n');
  }

  async function downloadQrCode(item, fileName) {
    const text = buildQrText(item);
    if (!text) { C.toast(t('fillRequired'), 'error'); return; }
    try {
      const dataUrl = await EG.api.qr.generate(text);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName || ('qr-' + EG.utils.uuid() + '.png');
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 100);
      C.toast(t('qrDownloaded'));
    } catch (e) {
      C.toast(EG.api.errMessage(e), 'error');
    }
  }

  return { filePick, deptOptions, tagEditor, statusSelect, prioritySelect, confirmDelete, canDelete, crudPage, projectPicker, openProjectPickerModal, buildQrText, downloadQrCode };
})();
