'use strict';

window.EG = window.EG || {};

EG.api = (function () {
  async function invoke(action, payload) {
    const res = await window.eg.invoke(action, payload);
    if (res && res.ok) return res.data;
    throw new Error((res && res.error) || 'UNKNOWN_ERROR');
  }

  function errMessage(e) {
    const map = {
      INVALID_CREDENTIALS: 'auth.invalid',
      USER_DISABLED: 'auth.disabled',
      PERMISSION_DENIED: 'permissionDenied',
      USERNAME_EXISTS: 'users.exists',
      BACKUP_INVALID: 'backup.invalid',
      BACKUP_NOT_FOUND: 'backup.notFound',
      FILE_NOT_FOUND: 'file.notFound',
    };
    const key = e && e.message ? e.message.split(':')[0] : '';
    return EG.i18n ? (EG.i18n.t(map[key] || e.message) || e.message) : e.message;
  }

  return new Proxy({
    invoke,
    errMessage,
    auth: {
      login: (u, p) => invoke('auth.login', { username: u, password: p }),
      logout: () => invoke('auth.logout'),
      session: () => invoke('auth.session'),
      setPin: (pin) => invoke('auth.setPin', { pin }),
      verifyPin: (pin) => invoke('auth.verifyPin', { pin }),
      users: () => invoke('auth.users'),
      createUser: (d) => invoke('auth.createUser', d),
      updateUser: (id, d) => invoke('auth.updateUser', { id, data: d }),
      deleteUser: (id) => invoke('auth.deleteUser', { id }),
    },
    settings: {
      get: () => invoke('settings.get'),
      update: (p) => invoke('settings.update', p),
      getShelfLocations: () => invoke('settings.getShelfLocations'),
      updateShelfLocations: (loc) => invoke('settings.updateShelfLocations', { locations: loc }),
    },
    shelves: {
      list: () => invoke('shelves.list'),
      create: (d) => invoke('shelves.create', d),
      update: (id, d) => invoke('shelves.update', { id, data: d }),
      remove: (id) => invoke('shelves.delete', { id }),
    },
    department: {
      list: () => invoke('department.list'),
      create: (d) => invoke('department.create', d),
      update: (id, d) => invoke('department.update', { id, data: d }),
      remove: (id) => invoke('department.delete', { id }),
      toggle: (id, enabled) => invoke('department.toggle', { id, enabled }),
    },
    project: {
      list: (q, a) => invoke('project.list', { query: q, args: a }),
      create: (d) => invoke('project.create', d),
      update: (id, d) => invoke('project.update', { id, data: d }),
      remove: (id) => invoke('project.delete', { id }),
    },
    document: {
      list: (q, a) => invoke('document.list', { query: q, args: a }),
      recent: (l) => invoke('document.recent', { limit: l }),
      favorites: () => invoke('document.favorites'),
      create: (d) => invoke('document.create', d),
      update: (id, d) => invoke('document.update', { id, data: d }),
      favorite: (id, f) => invoke('document.favorite', { id, favorite: f }),
      newVersion: (id, src, note) => invoke('document.newVersion', { id, fileSrc: src, note }),
      remove: (id) => invoke('document.delete', { id }),
      restore: (id) => invoke('document.restore', { id }),
      hardDelete: (id) => invoke('document.hardDelete', { id }),
      get: (id) => invoke('db.get', { collection: 'Document', id }),
      searchByFileNumber: (fn) => invoke('document.searchByFileNumber', { fileNumber: fn }),
      checkFileNumber: (fileNumber, deptCode) => invoke('document.checkFileNumber', { fileNumber, departmentCode: deptCode }),
      bulkUpdateFileNumber: (ids, fileNumber, deptCode) => invoke('document.bulkUpdateFileNumber', { ids, fileNumber, departmentCode: deptCode }),
      suggestNextFileNumber: (deptCode) => invoke('document.suggestNextFileNumber', { departmentCode: deptCode }),
    },
    incoming: {
      list: (q, a) => invoke('incoming.list', { query: q, args: a }),
      create: (d) => invoke('incoming.create', d),
      update: (id, d) => invoke('incoming.update', { id, data: d }),
      updateStatus: (id, status, note) => invoke('incoming.updateStatus', { id, status, note }),
      remove: (id) => invoke('incoming.delete', { id }),
      restore: (id) => invoke('incoming.restore', { id }),
      hardDelete: (id) => invoke('incoming.hardDelete', { id }),
      suggestNextLetterNumber: (deptCode) => invoke('incoming.suggestNextLetterNumber', { departmentCode: deptCode }),
    },
    outgoing: {
      list: (q, a) => invoke('outgoing.list', { query: q, args: a }),
      create: (d) => invoke('outgoing.create', d),
      update: (id, d) => invoke('outgoing.update', { id, data: d }),
      updateStatus: (id, status, note, receiver) => invoke('outgoing.updateStatus', { id, status, note, receiver }),
      signReceipt: (id, d) => invoke('outgoing.signReceipt', { id, ...d }),
      remove: (id) => invoke('outgoing.delete', { id }),
      restore: (id) => invoke('outgoing.restore', { id }),
      hardDelete: (id) => invoke('outgoing.hardDelete', { id }),
      suggestNextLetterNumber: (deptCode) => invoke('outgoing.suggestNextLetterNumber', { departmentCode: deptCode }),
    },
    recycle: { list: () => invoke('recycle.list'), empty: () => invoke('recycle.empty') },
    backup: {
      create: (type, note) => invoke('backup.create', { type, note }),
      list: () => invoke('backup.list'),
      restore: (id) => invoke('backup.restore', { id }),
      restoreFile: (p) => invoke('backup.restoreFile', { path: p }),
      export: (id) => invoke('backup.export', { id }),
      del: (id) => invoke('backup.delete', { id }),
    },
    lending: {
      list: (q, a) => invoke('lending.list', { query: q, args: a }),
      create: (d) => invoke('lending.create', d),
      update: (id, d) => invoke('lending.update', { id, data: d }),
      approve: (id, approval, location) => invoke('lending.approve', { id, approval, location }),
      markReturned: (id, returnTime) => invoke('lending.markReturned', { id, returnTime }),
      inspect: (id, inspectionStatus, note) => invoke('lending.inspect', { id, inspectionStatus, note }),
      transfer: (id, location, borrowerName, lenderName) => invoke('lending.transfer', { id, location, borrowerName, lenderName }),
      del: (id) => invoke('lending.delete', { id }),
      searchByFileNumber: (fn) => invoke('lending.searchByFileNumber', { fileNumber: fn }),
    },
    export: {
      excel: (p) => invoke('export.excel', p),
      pdf: (p) => invoke('export.pdf', p),
    },
    reports: { generate: (p) => invoke('reports.generate', p) },
    search: {
      global: (q, lang) => invoke('search.global', { query: q, lang }),
      advanced: (p) => invoke('search.advanced', p),
    },
    tags: {
      list: () => invoke('tags.list'),
      create: (d) => invoke('tags.create', d),
      remove: (id) => invoke('tags.delete', { id }),
    },
    logs: {
      list: (l, o) => invoke('logs.list', { limit: l, offset: o }),
      clear: () => invoke('logs.clear'),
    },
    emailLog: {
      list: (q) => invoke('emailLog.list', { query: q || {} }),
      get: (id) => invoke('emailLog.get', { id }),
      create: (d) => invoke('emailLog.create', d),
      update: (id, d) => invoke('emailLog.update', { id, data: d }),
      remove: (id) => invoke('emailLog.remove', { id }),
      restore: (id) => invoke('emailLog.restore', { id }),
      stats: () => invoke('emailLog.stats'),
    },
    stats: { dashboard: () => invoke('stats.dashboard') },
    qr: { generate: (d) => invoke('qr.generate', d) },
    file: {
      pick: (o) => invoke('file.pick', o),
      open: (p) => invoke('file.open', { path: p }),
      openFolder: (p) => invoke('file.openFolder', { path: p }),
      saveDialog: (n) => invoke('file.saveDialog', { defaultName: n }),
    },
  }, { get(target, prop) { return target[prop]; } });
})();
