'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.users = {
  id: 'users',
  title: 'users',
  icon: 'users',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    try {
      const users = await EG.api.auth.users();
      view.appendChild(C.pageHeader(t('users'), [C.button(t('add'), { icon: 'plus', onClick: () => openForm(null) })]));
      const table = C.table(
        [t('username'), t('fullName'), t('role'), t('email'), t('status'), t('actions')],
        users,
        {
          renderRow: (u) => {
            const actions = U.el('div', { class: 'row-actions' }, [
              C.iconButton('edit', { title: t('edit'), onClick: () => openForm(u) }),
              EG.helpers.canDelete() ? C.iconButton('trash', { title: t('delete'), variant: 'danger', onClick: () => C.confirm(t('confirmDelete'), async () => {
                try { await EG.api.auth.deleteUser(u._id); C.toast(t('deleted')); EG.router.navigate('users'); }
                catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
              }) }) : null,
            ]);
            return U.el('tr', {}, [
              td(u.username, 'cell-title'), td(EG.utils.localize(u.fullName, EG.state.lang)), td(t(u.role)),
              td(u.email || '-'), td('', '', C.badge(u.active ? t('active') : t('disabled'), u.active ? 'success' : 'neutral')), td('', '', actions),
            ]);
          },
        }
      );
      view.appendChild(users.length ? table : C.emptyState('users', t('emptyState')));
    } catch (e) { view.appendChild(C.emptyState('error', EG.api.errMessage(e))); }

    function openForm(user) {
      const uname = C.input(user ? user.username : '', { disabled: !!user });
      const fnameAr = C.input(user ? (user.fullName.ar || '') : '', {});
      const fnameEn = C.input(user ? (user.fullName.en || '') : '', {});
      const email = C.input(user ? (user.email || '') : '', { type: 'email' });
      const phone = C.input(user ? (user.phone || '') : '', {});
      const role = C.select([{ value: 'admin', label: t('admin') }, { value: 'employee', label: t('employee') }, { value: 'viewer', label: t('viewer') }], user ? user.role : 'viewer');
      const pass = C.input('', { type: 'password', placeholder: user ? '•••••' : '' });
      const body = U.el('div', {}, [
        C.fieldWrap(t('username'), uname),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('fullName') + ' (AR)', fnameAr), C.fieldWrap(t('fullName') + ' (EN)', fnameEn)]),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('email'), email), C.fieldWrap(t('phone'), phone)]),
        U.el('div', { class: 'form-grid' }, [C.fieldWrap(t('role'), role), C.fieldWrap(user ? t('password') + ' (' + t('regenerate') + ')' : t('password'), pass)]),
      ]);
      const m = C.modal(user ? t('edit') : t('users'), body, {
        size: 'lg',
        footer: [C.button(t('cancel'), { variant: 'ghost', onClick: () => m.close() }),
          C.button(t('save'), { icon: 'save', onClick: async () => {
            const payload = { fullName: { ar: fnameAr.value.trim(), en: fnameEn.value.trim() }, email: email.value, phone: phone.value, role: role.value };
            if (!user && !pass.value) { C.toast(t('error'), 'error'); return; }
            if (pass.value) payload.password = pass.value;
            try {
              if (user) await EG.api.auth.updateUser(user._id, payload);
              else await EG.api.auth.createUser({ username: uname.value.trim(), ...payload });
              m.close(); C.toast(t('saved')); EG.router.navigate('users');
            } catch (e2) { C.toast(EG.api.errMessage(e2), 'error'); }
          } })],
      });
    }

    function td(txt, cls, node) {
      if (node) { const c = U.el('td', { class: cls || '' }); c.appendChild(node); return c; }
      return U.el('td', { class: cls || '', text: String(txt ?? '') });
    }
  },
};
