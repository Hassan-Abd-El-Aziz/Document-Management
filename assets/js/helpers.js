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

  // Project selector with an inline "add project" button.
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

    const addBtn = C.button('', { icon: 'plus', variant: 'ghost', onClick: () => openProjectForm(null, async (created) => {
      await reload(created ? created._id : undefined);
      if (opts.onAdd) opts.onAdd(created);
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

  // Modal form to create/edit a project.
  function openProjectForm(project, onSaved) {
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
        C.fieldWrap(t('elevatorsCount'), elevators),
        C.fieldWrap(t('modelsCount'), models),
        C.fieldWrap(t('floorsCount'), floors),
        C.fieldWrap(t('projectManager'), manager),
        C.fieldWrap(t('projectManagerPhone'), managerPhone),
        C.fieldWrap(t('projectOwner'), owner),
        C.fieldWrap(t('projectConsultant'), consultant),
      ]),
      C.fieldWrap(t('notes'), notes),
    ]);

    const m = C.modal(project ? t('edit') : t('newProject'), body, {
      size: 'lg',
      footer: [
        C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
        C.button(t('save'), { icon: 'save', onClick: async () => {
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
            const saved = project
              ? await EG.api.project.update(project._id, payload)
              : await EG.api.project.create(payload);
            m.close();
            C.toast(t('projectSaved'));
            if (onSaved) onSaved(saved);
          } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
        } }),
      ],
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

  return { filePick, deptOptions, tagEditor, statusSelect, prioritySelect, confirmDelete, crudPage, projectPicker, openProjectForm };
})();
