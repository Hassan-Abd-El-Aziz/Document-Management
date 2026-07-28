const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initDatabase, closeDatabase } = require('./database/realm');
const { handle } = require('./electron/ipc');
const ROOT = __dirname;
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'file://' + ROOT + '/' });
const { window } = dom;
global.window = window; global.document = window.document;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
(async () => {
  await initDatabase();
  // simulate full IPC round-trip for department + document deletes
  for (const [act, createPayload, delAction] of [
    ['department.create', { code: 'TST', name: { ar: 'ت', en: 'T' } }, 'department.delete'],
    ['document.create', { title: { ar: 'و', en: 'w' }, departmentCode: 'GEN' }, 'document.delete'],
  ]) {
    const c = await handle({ action: act, payload: createPayload });
    const id = c.data._id;
    console.log(act, '-> _id typeof:', typeof id, '(should be string)');
    const del = await handle({ action: delAction, payload: { id } });
    console.log('  delete ok:', del.ok);
  }
  // render documents page (icons removed) - must not throw
  window.eg = {
    invoke: async (action) => {
      if (action === 'settings.get') return { ok: true, data: { theme: 'system', language: 'ar', requireLogin: false } };
      if (action === 'auth.session') return { ok: true, data: null };
      if (action === 'document.list') return handle({ action: 'document.list', payload: {} });
      if (action === 'recycle.list') return handle({ action: 'recycle.list', payload: {} });
      return { ok: true, data: [] };
    }, onAutoLock: () => {},
  };
  for (const f of ['assets/js/utils.js','assets/js/icons.js','assets/js/api.js','assets/js/i18n.js','assets/js/theme.js','assets/js/components.js','assets/js/router.js','assets/js/helpers.js','pages/documents.js']) {
    window.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  }
  const EG = window.EG; EG.i18n.setLang('ar');
  const view = document.getElementById('view');
  await EG.pages.documents.render(view);
  console.log('documents page rendered, rows:', view.querySelectorAll('.table tbody tr').length);
  closeDatabase(); process.exit(0);
})();
