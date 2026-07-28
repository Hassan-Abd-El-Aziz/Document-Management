'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.departments = {
  id: 'departments',
  title: 'departments',
  icon: 'departments',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const depts = await EG.api.department.list();
      view.appendChild(C.pageHeader(t('departments'), [
        C.button(t('add'), { icon: 'plus', onClick: () => openForm(null) }),
      ]));

      const table = C.table(
        [t('code'), t('name'), t('manager'), t('status'), t('actions')],
        depts,
        {
          renderRow: (d) => {
            const actions = U.el('div', { class: 'row-actions' }, [
              C.iconButton('edit', { title: t('edit'), onClick: () => openForm(d) }),
              C.iconButton(d.enabled ? 'close' : 'check', { title: d.enabled ? t('disable') : t('enable'), variant: d.enabled ? 'warn' : 'action', onClick: async () => {
                await EG.api.department.toggle(d._id, !d.enabled); C.toast(t('saved')); EG.router.navigate('departments');
              } }),
              C.iconButton('trash', { title: t('delete'), variant: 'danger', onClick: () => C.confirm(t('confirmDelete'), async () => {
                try {
                  await EG.api.department.remove(d._id);
                  C.toast(t('deleted'));
                  EG.router.navigate('departments');
                } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
              }) }),
            ]);
            return U.el('tr', {}, [
              td(d.code, 'cell-title'),
              td(EG.utils.localize(d.name, EG.state.lang)),
              td(d.manager || '-'),
              td('', '', C.badge(t(d.enabled ? 'enabled' : 'disabled'), d.enabled ? 'success' : 'neutral')),
              td('', '', actions),
            ]);
          },
        }
      );
      view.appendChild(depts.length ? table : C.emptyState('departments', t('emptyState')));
    } catch (e) {
      view.appendChild(C.emptyState('error', EG.api.errMessage(e)));
    }

    function openForm(dept) {
      const nameAr = C.input(dept ? (dept.name.ar || '') : '', {});
      const nameEn = C.input(dept ? (dept.name.en || '') : '', {});
      const code = C.input(dept ? dept.code : '', { disabled: !!dept });
      const manager = C.input(dept ? dept.manager : '', {});
      const desc = C.textarea(dept ? dept.description : '', {});
      const body = U.el('div', {}, [
        C.fieldWrap(t('code'), code),
        C.fieldWrap(t('name') + ' (AR)', nameAr),
        C.fieldWrap(t('name') + ' (EN)', nameEn),
        C.fieldWrap(t('manager'), manager),
        C.fieldWrap(t('description'), desc),
      ]);
      const m = C.modal(dept ? t('edit') : t('newDepartment'), body, {
        footer: [
          C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
          C.button(t('save'), { icon: 'save', onClick: async () => {
            const ar = nameAr.value.trim();
            const en = nameEn.value.trim();
            const payload = {
              code: code.value.trim().toUpperCase(),
              name: { ar: ar || en, en: en || ar },
              manager: manager.value.trim(),
              description: desc.value.trim(),
            };
            if (!payload.code || (!ar && !en)) { C.toast(t('fillRequired'), 'error'); return; }
            try {
              if (dept) await EG.api.department.update(dept._id, payload);
              else await EG.api.department.create(payload);
              m.close(); C.toast(t('saved')); EG.router.navigate('departments');
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
