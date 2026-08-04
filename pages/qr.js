'use strict';

window.EG = window.EG || {};
EG.pages = EG.pages || {};

EG.pages.qr = {
  id: 'qr',
  title: 'qr',
  icon: 'qr',
  async render(view) {
    const U = EG.utils, C = EG.components, t = (k) => EG.i18n.t(k);
    U.clear(view);
    const fileNumber = C.input('', {});
    const deptCode = C.input('', {});
    const titleAr = C.input('', {});
    const titleEn = C.input('', {});
    const project = C.input('', {});
    const notes = C.textarea('', {});
    const shelfLocation = C.input('', {});
    const qrWrap = U.el('div', { class: 'qr-result', style: 'display:none;text-align:center;margin-top:18px' });
    const qrImg = U.el('img', { style: 'max-width:320px;border:1px solid var(--border);border-radius:8px' });
    const printBtn = C.button(t('printQR'), { icon: 'print', variant: 'ghost', size: 'sm', onClick: () => { const w = window.open(''); w.document.write('<img src="' + qrImg.src + '"/>'); w.print(); w.close(); } });

    qrWrap.appendChild(qrImg);
    qrWrap.appendChild(U.el('div', { style: 'margin-top:10px' }, [printBtn]));
    view.appendChild(C.pageHeader(t('qrGenerator'), []));
    view.appendChild(U.el('div', { class: 'card', style: 'max-width:720px;margin:0 auto' }, [
      U.el('div', { class: 'form-grid' }, [
        C.fieldWrap(t('fileNumber'), fileNumber),
        C.fieldWrap(t('department'), deptCode),
        C.fieldWrap(t('title') + ' (AR)', titleAr),
        C.fieldWrap(t('title') + ' (EN)', titleEn),
        C.fieldWrap(t('project'), project),
        C.fieldWrap(t('fileLocation'), shelfLocation),
      ]),
      C.fieldWrap(t('notes'), notes),
      U.el('div', { style: 'display:flex;gap:10px;justify-content:flex-end;margin-top:10px' }, [
        C.button(t('generateQR'), { icon: 'qr', variant: 'primary', onClick: async () => {
          const payload = {
            fileNumber: fileNumber.value.trim(),
            departmentCode: deptCode.value.trim(),
            title: { ar: titleAr.value.trim(), en: titleEn.value.trim() },
            project: project.value.trim(),
            notes: notes.value.trim(),
            shelfLocation: shelfLocation.value.trim(),
          };
          if (!payload.fileNumber && !payload.departmentCode && !payload.title.ar && !payload.project) { C.toast(t('fillRequired'), 'error'); return; }
          try {
            const text = EG.helpers.buildQrText(payload);
            const dataUrl = await EG.api.qr.generate(text);
            qrImg.src = dataUrl;
            qrWrap.style.display = 'block';
            C.toast(t('created'));
          } catch (e) { C.toast(EG.api.errMessage(e), 'error'); }
        } }),
      ]),
      qrWrap,
    ]));
  },
};
