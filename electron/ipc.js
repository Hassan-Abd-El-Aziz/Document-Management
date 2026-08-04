'use strict';

const { ipcMain, dialog, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const dayjs = require('dayjs');

const { getRealm } = require('../database/realm');
const repo = require('../database/repository');
const { serialize, serializeList } = require('../utils/serialize');
const constants = require('../config/constants');
const { COLLECTIONS, ROOT } = constants;
const QRCode = require('qrcode');

const auth = require('../services/authService');
const settings = require('../services/settingsService');
const activation = require('../services/activationService');
const numbering = require('../services/numberingService');
const fileSvc = require('../services/fileService');
const audit = require('../services/auditService');
const notify = require('../services/notificationService');
const emailLog = require('../services/emailLogService');
const shelves = require('../services/shelvesService');
const backup = require('../services/backupService');
const exporter = require('../services/exportService');
const search = require('../services/searchService');

const C = constants;

function loc(v) { return v && (v.ar || v.en) || ''; }

function ok(data) { return { ok: true, data }; }
function fail(error) { return { ok: false, error: error && error.message ? error.message : String(error) }; }

function getLang() {
  try {
    const s = settings.getSettings();
    return s && s.language ? s.language : 'ar';
  } catch (_) { return 'ar'; }
}

function auditMsg(action, entity, detail) {
  const lang = getLang();
  const create = detail ? (lang === 'ar' ? 'تم إنشاء' : 'Created') : '';
  const update = lang === 'ar' ? 'تم تحديث' : 'Updated';
  const delete_ = lang === 'ar' ? 'تم حذف' : 'Deleted';
  const requested = lang === 'ar' ? 'طلب' : 'Requested';
  const statusMap = {
    pending: lang === 'ar' ? 'قيد الانتظار' : 'Pending',
    received: lang === 'ar' ? 'مستلم' : 'Received',
    delivered: lang === 'ar' ? 'تم التسليم' : 'Delivered',
    rejected: lang === 'ar' ? 'مرفوض' : 'Rejected',
    cancelled: lang === 'ar' ? 'ملغى' : 'Cancelled',
    in_archive: lang === 'ar' ? 'داخل الأرشيف' : 'In Archive',
    reserved: lang === 'ar' ? 'محجوز' : 'Reserved',
    borrowed: lang === 'ar' ? 'معار' : 'Borrowed',
    returned: lang === 'ar' ? 'مرجع' : 'Returned',
    overdue: lang === 'ar' ? 'متأخر' : 'Overdue',
    under_review: lang === 'ar' ? 'تحت المراجعة' : 'Under Review',
    missing: lang === 'ar' ? 'فقود' : 'Missing',
    pending_disposal: lang === 'ar' ? 'قيد الإعدام' : 'Pending Disposal',
    archived: lang === 'ar' ? 'مؤرشف' : 'Archived',
    approved: lang === 'ar' ? 'معتمد' : 'Approved',
  };
  const map = {
    user: lang === 'ar' ? 'المستخدم' : 'User',
    department: lang === 'ar' ? 'القسم' : 'Department',
    project: lang === 'ar' ? 'المشروع' : 'Project',
    document: lang === 'ar' ? 'الوثيقة' : 'Document',
    incoming: lang === 'ar' ? 'الوارد' : 'Incoming',
    outgoing: lang === 'ar' ? 'الصادر' : 'Outgoing',
    lending: lang === 'ar' ? 'الاستعارة' : 'Lending',
    recycle: lang === 'ar' ? 'السلة' : 'Recycle Bin',
  };
  const entityLabel = map[entity] || entity;
  const detailLabel = typeof detail === 'string' ? (statusMap[detail] || detail) : detail;
  if (action === 'create') return `${create} ${entityLabel} ${detailLabel || ''}`.trim();
  if (action === 'update') return `${update} ${entityLabel}`;
  if (action === 'delete') return `${delete_} ${entityLabel}`;
  if (action === 'status') return `${update} حالة ${entityLabel}: ${detailLabel || ''}`.trim();
  if (action === 'approve' || action === 'reject') return `${action === 'approve' ? (lang === 'ar' ? 'اعتماد' : 'Approve') : (lang === 'ar' ? 'رفض' : 'Reject')} ${entityLabel}`;
  if (action === 'lendingLoanRequested') return `${lang === 'ar' ? 'طلب' : 'Requested'} ${entityLabel}: ${detail || ''}`.trim();
  if (action === 'lendingRecordDeleted') return `${delete_} ${entityLabel}`;
  if (action === 'lendingUpdated') return `${update} ${entityLabel}`;
  if (action === 'restore') return `${lang === 'ar' ? 'تمت استعادة' : 'Restored'} ${entityLabel}`;
  if (action === 'receipt') return detail || `${action} ${entityLabel}`;
  if (action === 'version') return detail || `${action} ${entityLabel}`;
  return detail || `${action} ${entityLabel}`;
}

async function handle({ action, payload = {} }) {
  try {
    switch (action) {

      /* ---------- AUTH ---------- */
      case 'auth.login':
        return ok(auth.login(payload.username, payload.password));
      case 'auth.logout':
        return ok(auth.logout());
      case 'auth.session':
        return ok(auth.getSession());
      case 'auth.setPin':
        return ok(auth.setPin(payload.pin));
      case 'auth.verifyPin':
        return ok({ valid: auth.verifyPin(payload.pin) });

      /* ---------- ACTIVATION ---------- */
      case 'activation.status':
        return ok(activation.getActivationStatus());
      case 'activation.activate': {
        const result = activation.activate(payload.code);
        if (!result.ok) throw new Error(result.error || 'INVALID_CODE');
        return ok(result.data);
      }
      case 'activation.deactivate':
        return ok(activation.deactivate());
      case 'activation.isActivated':
        return ok(activation.isActivated());

      case 'auth.users':
        auth.requirePermission('users:read');
        return ok(repo.listCollection(COLLECTIONS.USERS));
      case 'auth.createUser': {
        auth.requirePermission('users:write');
        const exists = auth.getUserByUsername(payload.username);
        if (exists) throw new Error('USERNAME_EXISTS');
        const user = repo.create(COLLECTIONS.USERS, {
          username: payload.username,
          password: getRealm ? require('../database/realm').hashPassword(payload.password) : payload.password,
          fullName: payload.fullName || { ar: payload.username, en: payload.username },
          role: payload.role || 'viewer',
          email: payload.email || '',
          phone: payload.phone || '',
          active: true,
          createdAt: new Date(),
          lastLogin: null,
        });
        audit.audit('create', 'user', user._id, auditMsg('create', 'user', payload.username));
        return ok(user);
      }
      case 'auth.updateUser': {
        auth.requirePermission('users:write');
        const data = { ...payload.data };
        if (data.password) data.password = require('../database/realm').hashPassword(data.password);
        const user = repo.update(COLLECTIONS.USERS, payload.id, data);
        audit.audit('update', 'user', payload.id, auditMsg('update', 'user'));
        return ok(user);
      }
      case 'auth.deleteUser': {
        auth.requirePermission('users:write');
        repo.remove(COLLECTIONS.USERS, payload.id);
        audit.audit('delete', 'user', payload.id, auditMsg('delete', 'user'));
        return ok(true);
      }

      /* ---------- SETTINGS ---------- */
      case 'settings.get':
        return ok(settings.getSettings());
      case 'settings.update': {
        auth.requirePermission('settings:write');
        const updated = settings.updateSettings(payload);
        try { require('../main').scheduleBackups(); } catch (_) {}
        try { require('../main').scheduleUrgentAlerts(); } catch (_) {}
        try { require('../main').scheduleDailyReminders(); } catch (_) {}
        return ok(updated);
      }
      case 'settings.getShelfLocations':
        return ok(settings.getSetting('shelfLocations') || []);
      case 'settings.updateShelfLocations': {
        auth.requirePermission('settings:write');
        return ok(settings.setSetting('shelfLocations', payload.locations));
      }

      /* ---------- SHELVES ---------- */
      case 'shelves.list':
        return ok(repo.listCollection(COLLECTIONS.SHELVES, 'TRUEPREDICATE', {}));
      case 'shelves.create': {
        auth.requirePermission('settings:write');
        return ok(shelves.create(payload));
      }
      case 'shelves.update': {
        auth.requirePermission('settings:write');
        return ok(shelves.update(payload.id, payload.data));
      }
      case 'shelves.delete': {
        auth.requirePermission('settings:write');
        return ok(shelves.remove(payload.id));
      }

      /* ---------- GENERIC DB ---------- */
      case 'db.list':
        return ok(repo.listCollection(payload.collection, payload.query, payload.args || {}));
      case 'db.get':
        return ok(repo.getById(payload.collection, payload.id));
      case 'db.create':
        auth.requirePermission(payload.permission || 'db:write');
        return ok(repo.create(payload.collection, payload.data));
      case 'db.update':
        auth.requirePermission(payload.permission || 'db:write');
        return ok(repo.update(payload.collection, payload.id, payload.data));
      case 'db.delete':
        auth.requirePermission(payload.permission || 'db:write');
        return ok(repo.remove(payload.collection, payload.id));

      /* ---------- DEPARTMENTS ---------- */
      case 'department.list':
        return ok(repo.listCollection(COLLECTIONS.DEPARTMENTS));
      case 'department.create': {
        auth.requirePermission('departments:write');
        const code = String(payload.code || '').toUpperCase();
        const folder = path.join(ROOT.departments, code);
        await fs.ensureDir(folder);
        const dept = repo.create(COLLECTIONS.DEPARTMENTS, {
          code,
          name: payload.name,
          manager: payload.manager || '',
          description: payload.description || '',
          folder,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: auth.getSession() ? auth.getSession().userId : null,
        });
        audit.audit('create', 'department', dept._id, auditMsg('create', 'department', code));
        return ok(dept);
      }
      case 'department.update': {
        auth.requirePermission('departments:write');
        const dept = repo.update(COLLECTIONS.DEPARTMENTS, payload.id, { ...payload.data, updatedAt: new Date() });
        audit.audit('update', 'department', payload.id, auditMsg('update', 'department'));
        return ok(dept);
      }
      case 'department.delete': {
        auth.requirePermission('departments:write');
        repo.remove(COLLECTIONS.DEPARTMENTS, payload.id);
        audit.audit('delete', 'department', payload.id, auditMsg('delete', 'department'));
        return ok(true);
      }
      case 'department.toggle': {
        auth.requirePermission('departments:write');
        const dept = repo.update(COLLECTIONS.DEPARTMENTS, payload.id, { enabled: !!payload.enabled, updatedAt: new Date() });
        return ok(dept);
      }

      /* ---------- PROJECTS ---------- */
      case 'project.list':
        return ok(repo.listCollection(COLLECTIONS.PROJECTS, payload.query || 'deleted == false', payload.args || {}));
      case 'project.create': {
        auth.requirePermission('documents:write');
        const proj = repo.create(COLLECTIONS.PROJECTS, {
          name: String(payload.name || '').trim(),
          address: payload.address || '',
          elevators: Number(payload.elevators) || 0,
          models: Number(payload.models) || 0,
          floors: Number(payload.floors) || 0,
          notes: payload.notes || '',
          manager: payload.manager || '',
          managerPhone: payload.managerPhone || '',
          owner: payload.owner || '',
          consultant: payload.consultant || '',
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: auth.getSession() ? auth.getSession().userId : null,
        });
        audit.audit('create', 'project', proj._id, auditMsg('create', 'project', proj.name));
        return ok(proj);
      }
      case 'project.update': {
        auth.requirePermission('documents:write');
        const proj = repo.update(COLLECTIONS.PROJECTS, payload.id, { ...payload.data, updatedAt: new Date() });
        audit.audit('update', 'project', payload.id, auditMsg('update', 'project'));
        return ok(proj);
      }
      case 'project.delete': {
        auth.requirePermission('documents:write');
        repo.update(COLLECTIONS.PROJECTS, payload.id, { deleted: true, updatedAt: new Date() });
        audit.audit('delete', 'project', payload.id, auditMsg('delete', 'project'));
        return ok(true);
      }

      /* ---------- DOCUMENTS ---------- */
      case 'document.list':
        return ok(repo.listCollection(COLLECTIONS.DOCUMENTS, payload.query || 'deleted == false', payload.args || {}));
      case 'document.checkFileNumber': {
        if (!payload.fileNumber) return ok(true);
        const matches = repo.listCollection(COLLECTIONS.DOCUMENTS, 'fileNumber == $0 AND departmentCode == $1 AND deleted == false', { $0: payload.fileNumber, $1: payload.departmentCode || 'GEN' });
        return ok(matches.length === 0);
      }
      case 'document.suggestNextFileNumber': {
        const deptCode = payload.departmentCode || 'GEN';
        return ok(numbering.suggestNextDocumentNumber(deptCode));
      }
      case 'document.searchByFileNumber': {
        const fn = String(payload.fileNumber || '').trim();
        if (!fn) return ok(null);
        const realm = getRealm();
        const results = realm.objects(COLLECTIONS.DOCUMENTS).filtered('fileNumber == $0 AND deleted == false', fn);
        if (results.length) {
          const doc = serialize(results[0]);
          return ok({ id: doc._id, fileNumber: doc.fileNumber, title: doc.title, shelfLocation: doc.shelfLocation });
        }
        return ok(null);
      }
      case 'document.bulkUpdateFileNumber': {
        auth.requirePermission('documents:write');
        const { ids, fileNumber, departmentCode } = payload;
        if (!Array.isArray(ids) || !ids.length || !fileNumber) throw new Error('INVALID_PAYLOAD');
        const docs = repo.listCollection(COLLECTIONS.DOCUMENTS, `_id IN ${JSON.stringify(ids)} AND deleted == false`, {});
        const results = [];
        for (const doc of docs) {
          const updated = repo.update(COLLECTIONS.DOCUMENTS, doc._id, {
            fileNumber,
            departmentCode: doc.departmentCode || departmentCode || 'GEN',
            updatedAt: new Date(),
          });
          results.push(updated);
          audit.audit('update', 'document', doc._id, auditMsg('update', 'document', fileNumber));
        }
        return ok(results);
      }
      case 'document.recent':
        return ok(serializeList(getRealm().objects(COLLECTIONS.DOCUMENTS).filtered('deleted == false').sorted('createdAt', true).slice(0, payload.limit || 8)));
      case 'document.favorites':
        return ok(repo.listCollection(COLLECTIONS.DOCUMENTS, 'deleted == false AND favorite == true', {}));
      case 'document.create': {
        auth.requirePermission('documents:write');
        const useManual = !!payload.fileNumber;
        const num = useManual ? null : numbering.nextCounter({ type: numbering.TYPES.DOCUMENT, deptCode: payload.departmentCode, year: payload.year });
        const fileNumber = payload.fileNumber || (num ? num.fileNumber : null);
        let fileMeta = {};
        if (payload.fileSrc) {
          const storageDir = fileSvc.storageDirFor('document', payload.departmentCode);
          const baseName = fileNumber || `DOC-${Date.now()}`;
          fileMeta = await fileSvc.saveFromPath(payload.fileSrc, storageDir, `${baseName}${path.extname(payload.fileSrc)}`);
        }
        const doc = repo.create(COLLECTIONS.DOCUMENTS, {
          fileNumber,
          title: payload.title,
          projectId: payload.projectId || null,
          projectName: payload.projectName || null,
          departmentId: payload.departmentId || null,
          departmentCode: payload.departmentCode || 'GEN',
          tags: payload.tags || [],
          filePath: fileMeta.filePath || null,
          fileName: fileMeta.fileName || null,
          originalName: payload.originalName || null,
          mimeType: fileMeta.mimeType || null,
          size: fileMeta.size || 0,
          category: payload.category || 'general',
          status: payload.status || 'active',
          priority: payload.priority || 'medium',
          notes: payload.notes || '',
          documentType: payload.documentType || 'document',
          shelfLocation: payload.shelfLocation || null,
          favorite: false,
          currentVersion: 1,
          versions: [],
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: auth.getSession() ? auth.getSession().userId : null,
        });
        audit.audit('create', 'document', doc._id, auditMsg('create', 'document', doc.fileNumber), loc(doc.title));
        notify.createNotification({ type: 'document', title: { ar: 'وثيقة جديدة', en: 'New Document' }, body: { ar: doc.fileNumber, en: doc.fileNumber } });
        return ok(doc);
      }
      case 'document.update': {
        auth.requirePermission('documents:write');
        const doc = repo.update(COLLECTIONS.DOCUMENTS, payload.id, { ...payload.data, updatedAt: new Date() });
        audit.audit('update', 'document', payload.id, auditMsg('update', 'document'));
        return ok(doc);
      }
      case 'document.favorite': {
        auth.requirePermission('documents:write');
        return ok(repo.update(COLLECTIONS.DOCUMENTS, payload.id, { favorite: !!payload.favorite }));
      }
      case 'document.newVersion': {
        auth.requirePermission('documents:write');
        const realm = getRealm();
        const objs = realm.objects(COLLECTIONS.DOCUMENTS).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        if (!objs.length) throw new Error('DOC_NOT_FOUND');
        const doc = serialize(objs[0]);
        const fileMeta = await fileSvc.saveFromPath(payload.fileSrc, fileSvc.storageDirFor('document', doc.departmentCode), `${doc.fileNumber}-v${doc.currentVersion + 1}${path.extname(payload.fileSrc)}`);
        realm.write(() => {
          objs[0].versions.push({ version: doc.currentVersion + 1, filePath: fileMeta.filePath, fileName: fileMeta.fileName, size: fileMeta.size, note: payload.note || '', createdAt: new Date(), createdBy: auth.getSession() ? auth.getSession().userId : null });
          objs[0].currentVersion = doc.currentVersion + 1;
          objs[0].updatedAt = new Date();
        });
        audit.audit('version', 'document', payload.id, auditMsg('create', 'document', `v${doc.currentVersion + 1}`), loc(doc.title));
        return ok(serialize(objs[0]));
      }
      case 'document.delete': {
        auth.requirePermission('documents:write');
        const realm = getRealm();
        const objs = realm.objects(COLLECTIONS.DOCUMENTS).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        const doc = objs.length ? serialize(objs[0]) : null;
        repo.update(COLLECTIONS.DOCUMENTS, payload.id, { deleted: true, deletedAt: new Date() });
        audit.audit('delete', 'document', payload.id, auditMsg('delete', 'document'), doc ? `${doc.fileNumber} - ${loc(doc.title)}` : null);
        return ok(true);
      }
      case 'document.restore': {
        auth.requirePermission('documents:write');
        repo.update(COLLECTIONS.DOCUMENTS, payload.id, { deleted: false, deletedAt: null });
        audit.audit('restore', 'document', payload.id, auditMsg('restore', 'document'));
        return ok(true);
      }
      case 'document.hardDelete': {
        auth.requirePermission('documents:write');
        const realm = getRealm();
        const objs = realm.objects(COLLECTIONS.DOCUMENTS).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        let docName = null;
        if (objs.length) {
          const d = serialize(objs[0]);
          docName = `${d.fileNumber} - ${loc(d.title)}`;
          if (d.filePath) await fileSvc.deleteFile(d.filePath);
          (d.versions || []).forEach((v) => fileSvc.deleteFile(v.filePath));
        }
        repo.remove(COLLECTIONS.DOCUMENTS, payload.id);
        audit.audit('delete', 'document', payload.id, auditMsg('delete', 'document'), docName);
        return ok(true);
      }

      /* ---------- INCOMING ---------- */
      case 'incoming.list':
        return ok(repo.listCollection(COLLECTIONS.INCOMING, payload.query || 'deleted == false', payload.args || {}));
      case 'incoming.suggestNextLetterNumber': {
        const deptCode = payload.departmentCode || 'GEN';
        const realm = getRealm();
        const items = realm.objects(COLLECTIONS.INCOMING).filtered('departmentCode == $0 AND deleted == false AND letterNumber != null', deptCode);
        let maxSeq = 0;
        for (const item of items) {
          const parts = String(item.letterNumber || '').split('-');
          if (parts.length >= 4 && parts[2] === 'In') {
            const seq = parseInt(parts[3], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          } else if (parts.length >= 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
        const year = payload.year || dayjs().year();
        return ok(`${year}-${deptCode}-In-${String(maxSeq + 1).padStart(6, '0')}`);
      }
      case 'incoming.create': {
        auth.requirePermission('incoming:write');
        const num = numbering.nextCounter({ type: numbering.TYPES.INCOMING, deptCode: payload.departmentCode, year: payload.year });
        let fileMeta = {};
        if (payload.fileSrc) fileMeta = await fileSvc.saveFromPath(payload.fileSrc, fileSvc.storageDirFor('incoming', payload.departmentCode), `${num.fileNumber}${path.extname(payload.fileSrc)}`);
        const rec = repo.create(COLLECTIONS.INCOMING, {
          letterNumber: payload.letterNumber || num.fileNumber,
          subject: payload.subject,
          fromEntity: payload.fromEntity || '',
          toEntity: payload.toEntity || '',
          departmentId: payload.departmentId || null,
          departmentCode: payload.departmentCode || 'GEN',
          receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : new Date(),
          archiveDeliveryDate: payload.archiveDeliveryDate ? new Date(payload.archiveDeliveryDate) : null,
          deliveryStatus: payload.deliveryStatus || 'pending',
          priority: payload.priority || 'medium',
          receivedBy: payload.receivedBy || '',
          attachments: payload.attachments || [],
          filePath: fileMeta.filePath || null,
          notes: payload.notes || '',
          tags: payload.tags || [],
          history: [{ action: 'created', status: payload.deliveryStatus || 'pending', by: auth.getSession() ? auth.getSession().username : null, at: new Date(), note: '' }],
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: auth.getSession() ? auth.getSession().userId : null,
        });
        audit.audit('create', 'incoming', rec._id, auditMsg('create', 'incoming', rec.letterNumber), loc(rec.subject));
        if (rec.priority === 'urgent') {
          notify.createNotification({ type: 'urgent', title: { ar: 'خطاب وارد عاجل', en: 'Urgent Incoming Letter' }, body: { ar: `وارد عاجل برقم ${rec.letterNumber}`, en: `Urgent incoming #${rec.letterNumber}` }, priority: 'high' });
        } else {
          notify.createNotification({ type: 'incoming', title: { ar: 'خطاب وارد جديد', en: 'New Incoming Letter' }, body: { ar: rec.letterNumber, en: rec.letterNumber }, priority: rec.priority || 'medium' });
        }
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(rec);
      }
      case 'incoming.updateStatus': {
        auth.requirePermission('incoming:write');
        const realm = getRealm();
        const objs = realm.objects(COLLECTIONS.INCOMING).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        if (!objs.length) throw new Error('NOT_FOUND');
        realm.write(() => {
          objs[0].deliveryStatus = payload.status;
          objs[0].updatedAt = new Date();
          objs[0].history.push({ action: 'status', status: payload.status, by: auth.getSession() ? auth.getSession().username : null, at: new Date(), note: payload.note || '' });
        });
        audit.audit('status', 'incoming', payload.id, auditMsg('status', 'incoming', payload.status));
        if (['delivered', 'rejected', 'cancelled'].includes(payload.status)) notify.markUrgentResolved(payload.id);
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(serialize(objs[0]));
      }
      case 'incoming.update': {
        auth.requirePermission('incoming:write');
        const upd = { ...payload.data, updatedAt: new Date() };
        if ('archiveDeliveryDate' in upd) upd.archiveDeliveryDate = upd.archiveDeliveryDate ? new Date(upd.archiveDeliveryDate) : null;
        const rec = repo.update(COLLECTIONS.INCOMING, payload.id, upd);
        audit.audit('update', 'incoming', payload.id, auditMsg('update', 'incoming'));
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(rec);
      }
      case 'incoming.delete': {
        auth.requirePermission('incoming:write');
        const realm = getRealm();
        const objs = realm.objects(COLLECTIONS.INCOMING).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        const rec = objs.length ? serialize(objs[0]) : null;
        repo.update(COLLECTIONS.INCOMING, payload.id, { deleted: true, deletedAt: new Date() });
        audit.audit('delete', 'incoming', payload.id, auditMsg('delete', 'incoming'), rec ? `${rec.letterNumber} - ${loc(rec.subject)}` : null);
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(true);
      }
      case 'incoming.restore': {
        auth.requirePermission('incoming:write');
        const rec = repo.update(COLLECTIONS.INCOMING, payload.id, { deleted: false, deletedAt: null });
        audit.audit('restore', 'incoming', payload.id, auditMsg('restore', 'incoming'));
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(rec);
      }
      case 'incoming.hardDelete': {
        auth.requirePermission('incoming:write');
        const objs = getRealm().objects(COLLECTIONS.INCOMING).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        let recName = null;
        if (objs.length) { const d = serialize(objs[0]); recName = `${d.letterNumber} - ${loc(d.subject)}`; if (d.filePath) await fileSvc.deleteFile(d.filePath); }
        repo.remove(COLLECTIONS.INCOMING, payload.id);
        audit.audit('delete', 'incoming', payload.id, auditMsg('delete', 'incoming'), recName);
        return ok(true);
      }

      /* ---------- OUTGOING ---------- */
      case 'outgoing.list':
        return ok(repo.listCollection(COLLECTIONS.OUTGOING, payload.query || 'deleted == false', payload.args || {}));
      case 'outgoing.suggestNextLetterNumber': {
        const deptCode = payload.departmentCode || 'GEN';
        const realm = getRealm();
        const items = realm.objects(COLLECTIONS.OUTGOING).filtered('departmentCode == $0 AND deleted == false AND letterNumber != null', deptCode);
        let maxSeq = 0;
        for (const item of items) {
          const parts = String(item.letterNumber || '').split('-');
          if (parts.length >= 4 && parts[2] === 'OL') {
            const seq = parseInt(parts[3], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          } else if (parts.length >= 4 && parts[2] === 'Out') {
            const seq = parseInt(parts[3], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          } else if (parts.length >= 3) {
            const seq = parseInt(parts[2], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
        const year = payload.year || dayjs().year();
        return ok(`${year}-${deptCode}-OL-${String(maxSeq + 1).padStart(6, '0')}`);
      }
      case 'outgoing.create': {
        auth.requirePermission('outgoing:write');
        const num = numbering.nextCounter({ type: numbering.TYPES.OUTGOING, deptCode: payload.departmentCode, year: payload.year });
        let fileMeta = {};
        if (payload.fileSrc) fileMeta = await fileSvc.saveFromPath(payload.fileSrc, fileSvc.storageDirFor('outgoing', payload.departmentCode), `${num.fileNumber}${path.extname(payload.fileSrc)}`);
        const rec = repo.create(COLLECTIONS.OUTGOING, {
          letterNumber: payload.letterNumber || num.fileNumber,
          subject: payload.subject,
          sentTo: payload.sentTo || '',
          fromEntity: payload.fromEntity || '',
          departmentId: payload.departmentId || null,
          departmentCode: payload.departmentCode || 'GEN',
          sentDate: payload.sentDate ? new Date(payload.sentDate) : new Date(),
          archiveDeliveryDate: payload.archiveDeliveryDate ? new Date(payload.archiveDeliveryDate) : null,
          deliveryStatus: 'pending',
          priority: payload.priority || 'medium',
          deliveredBy: payload.deliveredBy || '',
          receiver: '',
          deliveryDate: null,
          receipt: null,
          attachments: payload.attachments || [],
          filePath: fileMeta.filePath || null,
          notes: payload.notes || '',
          tags: payload.tags || [],
          history: [{ action: 'created', status: 'pending', by: auth.getSession() ? auth.getSession().username : null, at: new Date(), note: '' }],
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: auth.getSession() ? auth.getSession().userId : null,
        });
        audit.audit('create', 'outgoing', rec._id, auditMsg('create', 'outgoing', rec.letterNumber), loc(rec.subject));
        if (rec.priority === 'urgent') {
          notify.createNotification({ type: 'urgent', title: { ar: 'خطاب صادر عاجل', en: 'Urgent Outgoing Letter' }, body: { ar: `صادر عاجل برقم ${rec.letterNumber}`, en: `Urgent outgoing #${rec.letterNumber}` }, priority: 'high' });
        } else {
          notify.createNotification({ type: 'outgoing', title: { ar: 'خطاب صادر جديد', en: 'New Outgoing Letter' }, body: { ar: rec.letterNumber, en: rec.letterNumber }, priority: rec.priority || 'medium' });
        }
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(rec);
      }
      case 'outgoing.updateStatus':
        auth.requirePermission('outgoing:write');
        return ok(await updateOutgoingStatus(payload));
      case 'outgoing.signReceipt': {
        auth.requirePermission('outgoing:write');
        const realm = getRealm();
        const objs = realm.objects(COLLECTIONS.OUTGOING).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        if (!objs.length) throw new Error('NOT_FOUND');
        let sigPath = null;
        if (payload.signatureSrc) sigPath = (await fileSvc.saveFromPath(payload.signatureSrc, ROOT.temp, `sig-${Date.now()}.png`)).filePath;
        realm.write(() => {
          objs[0].receipt = { receiverName: payload.receiverName, receivedAt: new Date(), signatureImagePath: sigPath, note: payload.note || '' };
          objs[0].deliveryStatus = 'delivered';
          objs[0].receiver = payload.receiverName;
          objs[0].deliveryDate = new Date();
          objs[0].updatedAt = new Date();
          objs[0].history.push({ action: 'delivered', status: 'delivered', by: auth.getSession() ? auth.getSession().username : null, at: new Date(), note: 'Signed receipt' });
        });
        audit.audit('receipt', 'outgoing', payload.id, `${getLang() === 'ar' ? 'تم الاستلام بواسطة' : 'Signed by'} ${payload.receiverName}`);
        notify.markUrgentResolved(payload.id);
        return ok(serialize(objs[0]));
      }
      case 'outgoing.update': {
        auth.requirePermission('outgoing:write');
        const upd = { ...payload.data, updatedAt: new Date() };
        if ('archiveDeliveryDate' in upd) upd.archiveDeliveryDate = upd.archiveDeliveryDate ? new Date(upd.archiveDeliveryDate) : null;
        const rec = repo.update(COLLECTIONS.OUTGOING, payload.id, upd);
        audit.audit('update', 'outgoing', payload.id, auditMsg('update', 'outgoing'));
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(rec);
      }
      case 'outgoing.delete': {
        auth.requirePermission('outgoing:write');
        const realm = getRealm();
        const objs = realm.objects(COLLECTIONS.OUTGOING).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        const rec = objs.length ? serialize(objs[0]) : null;
        repo.update(COLLECTIONS.OUTGOING, payload.id, { deleted: true, deletedAt: new Date() });
        audit.audit('delete', 'outgoing', payload.id, auditMsg('delete', 'outgoing'), rec ? `${rec.letterNumber} - ${loc(rec.subject)}` : null);
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(true);
      }
      case 'outgoing.restore': {
        auth.requirePermission('outgoing:write');
        const rec = repo.update(COLLECTIONS.OUTGOING, payload.id, { deleted: false, deletedAt: null });
        audit.audit('restore', 'outgoing', payload.id, auditMsg('restore', 'outgoing'));
        try { notify.generateSystemReminders(); } catch (_) {}
        return ok(rec);
      }
      case 'outgoing.hardDelete': {
        auth.requirePermission('outgoing:write');
        const objs = getRealm().objects(COLLECTIONS.OUTGOING).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        let recName = null;
        if (objs.length) { const d = serialize(objs[0]); recName = `${d.letterNumber} - ${loc(d.subject)}`; if (d.filePath) await fileSvc.deleteFile(d.filePath); if (d.receipt && d.receipt.signatureImagePath) await fileSvc.deleteFile(d.receipt.signatureImagePath); }
        repo.remove(COLLECTIONS.OUTGOING, payload.id);
        audit.audit('delete', 'outgoing', payload.id, auditMsg('delete', 'outgoing'), recName);
        return ok(true);
      }

      /* ---------- RECYCLE ---------- */
      case 'recycle.list': {
        const realm = getRealm();
        const docs = serializeList(realm.objects(COLLECTIONS.DOCUMENTS).filtered('deleted == true'));
        const inc = serializeList(realm.objects(COLLECTIONS.INCOMING).filtered('deleted == true'));
        const out = serializeList(realm.objects(COLLECTIONS.OUTGOING).filtered('deleted == true'));
        return ok([...docs.map((d) => ({ ...d, kind: 'document' })), ...inc.map((d) => ({ ...d, kind: 'incoming' })), ...out.map((d) => ({ ...d, kind: 'outgoing' }))]);
      }
      case 'recycle.empty':
        auth.requirePermission('recycle:write');
        await emptyRecycle();
        return ok(true);

      /* ---------- NOTIFICATIONS ---------- */
      case 'notifications.list':
        return ok(notify.listNotifications(payload.unreadOnly || false));
      case 'notifications.unread':
        return ok(notify.unreadCount());
      case 'notifications.read':
        notify.markRead(payload.id);
        return ok(true);
      case 'notifications.readAll':
        notify.markAllRead();
        return ok(true);

      /* ---------- BACKUP ---------- */
      case 'backup.create':
        auth.requirePermission('backup:write');
        return ok(await backup.createBackup({ type: payload.type || 'manual', note: payload.note || '' }));
      case 'backup.list':
        return ok(backup.listBackups());
      case 'backup.restore':
        auth.requirePermission('backup:write');
        return ok(await backup.restoreBackup(payload.id));
      case 'backup.restoreFile':
        auth.requirePermission('backup:write');
        return ok(await backup.restoreFromPath(payload.path));
      case 'backup.export': {
        auth.requirePermission('backup:write');
        const zip = await backup.exportBackup(payload.id);
        const win = BrowserWindow.getFocusedWindow();
        const res = await dialog.showSaveDialog(win, {
          defaultPath: zip.fileName,
          filters: [{ name: 'Backup', extensions: ['zip'] }],
        });
        if (res.canceled || !res.filePath) return ok({ canceled: true });
        await fs.copyFileSync(zip.path, res.filePath);
        return ok({ path: res.filePath, fileName: path.basename(res.filePath) });
      }
      case 'backup.delete':
        auth.requirePermission('backup:write');
        return ok(await backup.deleteBackup(payload.id));

      /* ---------- LENDING ---------- */
      case 'lending.list':
        return ok(repo.listCollection(COLLECTIONS.LENDING, payload.query || 'TRUEPREDICATE', payload.args || {}));
      case 'lending.searchByFileNumber': {
        const fn = String(payload.fileNumber || '').trim();
        if (!fn) return ok([]);
        const items = repo.listCollection(COLLECTIONS.LENDING, `TRUEPREDICATE`, {});
        return ok(items.filter((l) => (l.itemReference || '').toLowerCase().includes(fn.toLowerCase()) || (l.itemName || '').toLowerCase().includes(fn.toLowerCase())).slice(0, 20));
      }
      case 'lending.create': {
        auth.requirePermission('lending:write');
        const session = auth.getSession();
        const now = new Date();
        const history = [{ action: 'requested', fromStatus: null, toStatus: 'in_archive', fromApproval: null, toApproval: 'pending', note: 'Loan requested', by: session ? session.username : null, at: now }];
        const rec = repo.create(COLLECTIONS.LENDING, {
          itemType: payload.itemType || 'document',
          materialType: payload.materialType || 'document',
          itemReference: payload.itemReference || '',
          itemName: String(payload.itemName || '').trim(),
          filePath: payload.filePath || '',
          borrowerId: session ? session.userId : null,
          borrowerName: String(payload.borrowerName || '').trim(),
          borrowerDepartment: String(payload.borrowerDepartment || '').trim(),
          lenderId: null,
          lenderName: null,
          currentLocation: String(payload.currentLocation || 'Archive'),
          status: 'in_archive',
          approvalStatus: 'pending',
          approvedBy: null,
          approvedById: null,
          requestDate: now,
          approvalDate: null,
          lendDate: payload.lendDate ? new Date(payload.lendDate) : null,
          receiveTime: null,
          returnDeadline: payload.returnDeadline ? new Date(payload.returnDeadline) : null,
          returnTime: null,
          returnInspectionStatus: 'none',
          returnInspectedBy: null,
          returnInspectionNote: null,
          notes: payload.notes || '',
          borrowPurpose: payload.borrowPurpose || '',
          lendingType: payload.lendingType || 'borrowed',
          approvalAttachment: payload.approvalAttachment || '',
          history,
          createdBy: session ? session.username : null,
          createdAt: now,
          updatedAt: now,
          deleted: false,
        });
        audit.audit('create', 'lending', rec._id, auditMsg('lendingLoanRequested', 'lending', `${rec.itemName} - ${rec.borrowerName}`));
        notify.createNotification({ type: 'lending_request', title: { ar: 'طلب استعارة جديد', en: 'New Lending Request' }, body: { ar: `طلب استعارة ${rec.itemName} من ${rec.borrowerName}`, en: `${rec.borrowerName} requested ${rec.itemName}` }, relatedId: String(rec._id), priority: 'medium' });
        return ok(rec);
      }

      // helper for status transitions
      function lendingTransition(collection, id, changes, extraHistory) {
        const realm = getRealm();
        const objs = realm.objects(collection).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
        if (!objs.length) throw new Error('LENDING_NOT_FOUND');
        const existing = serialize(objs[0]);
        const hist = Array.isArray(existing.history) ? [...existing.history] : [];
        const entry = {
          action: changes.action || 'updated',
          fromStatus: changes.fromStatus ?? existing.status,
          toStatus: changes.toStatus ?? existing.status,
          fromApproval: changes.fromApproval ?? existing.approvalStatus,
          toApproval: changes.toApproval ?? existing.approvalStatus,
          fromLocation: changes.fromLocation ?? existing.currentLocation,
          toLocation: changes.toLocation ?? existing.currentLocation,
          note: changes.note || '',
          by: auth.getSession() ? auth.getSession().username : null,
          at: new Date(),
        };
        if (extraHistory) hist.push(...extraHistory);
        else hist.push(entry);
        const data = { ...changes, history: hist, updatedAt: new Date() };
        const rec = repo.update(collection, id, data);
        audit.audit('status', 'lending', id, auditMsg('status', 'lending', `${change?.action || 'updated'} ${rec.itemName}`));
        return serialize(rec);
      }

      case 'lending.approve': {
        auth.requirePermission('lending:approve');
        const appr = payload.approval === 'approved' ? 'approved' : 'rejected';
        const rec = lendingTransition(COLLECTIONS.LENDING, payload.id, {
          action: appr === 'approved' ? 'approved' : 'rejected',
          approvalStatus: appr,
          approvedBy: auth.getSession() ? auth.getSession().username : null,
          approvedById: auth.getSession() ? auth.getSession().userId : null,
          approvalDate: new Date(),
          ...(appr === 'approved' ? { toStatus: 'reserved', toLocation: payload.location || 'Reserved Shelf' } : {}),
        });
        if (appr === 'approved') {
          try {
            const realm = getRealm();
            const docs = realm.objects(COLLECTIONS.DOCUMENTS).filtered('fileNumber == $0 AND deleted == false', rec.itemReference);
            if (docs.length) {
              const doc = docs[0];
              realm.write(() => {
                if (!rec.previousDocumentLocation && doc.shelfLocation) {
                  rec.previousDocumentLocation = doc.shelfLocation;
                }
                doc.shelfLocation = rec.borrowerName || rec.currentLocation;
              });
            }
          } catch (_) {}
        }
        return ok(rec);
      }
      case 'lending.markReturned': {
        auth.requirePermission('lending:write');
        const realm = getRealm();
        const objs = realm.objects(COLLECTIONS.LENDING).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
        const existing = objs.length ? serialize(objs[0]) : null;
        
        const rec = lendingTransition(COLLECTIONS.LENDING, payload.id, {
          action: 'returned',
          toStatus: 'under_review',
          toApproval: 'approved',
          returnTime: payload.returnTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          returnInspectionStatus: 'pending',
          toLocation: 'Return Desk',
        }, [{ action: 'received_back', fromStatus: 'borrowed', toStatus: 'under_review', note: 'Item received back', by: auth.getSession() ? auth.getSession().username : null, at: new Date() }]);
        
        if (existing && existing.previousDocumentLocation && existing.itemReference) {
          try {
            const docs = realm.objects(COLLECTIONS.DOCUMENTS).filtered('fileNumber == $0 AND deleted == false', existing.itemReference);
            if (docs.length) {
              realm.write(() => {
                docs[0].shelfLocation = existing.previousDocumentLocation;
              });
            }
          } catch (_) {}
        }
        
        notify.createNotification({ type: 'return_inspection', title: { ar: 'فحص إرجاع', en: 'Return Inspection' }, body: { ar: `تم استلام ${rec.itemName} بانتظار الفحص`, en: `${rec.itemName} received, pending inspection` }, relatedId: String(rec._id), priority: 'medium' });
        return ok(rec);
      }
      case 'lending.inspect': {
        auth.requirePermission('lending:write');
        const inspection = payload.inspectionStatus || 'good';
        const finalStatus = inspection === 'good' ? 'in_archive' : 'missing';
        const rec = lendingTransition(COLLECTIONS.LENDING, payload.id, {
          action: 'inspected',
          toStatus: finalStatus,
          returnInspectionStatus: inspection,
          returnInspectedBy: auth.getSession() ? auth.getSession().username : null,
          returnInspectionNote: payload.note || '',
          toLocation: finalStatus === 'in_archive' ? 'Archive' : 'Missing/Damaged',
        });
        notify.createNotification({ type: 'inspection_complete', title: { ar: 'اكتمل فحص الإرجاع', en: 'Inspection Complete' }, body: { ar: `فحص ${rec.itemName}: ${inspection === 'good' ? 'سليم' : 'تالف/فقد'}`, en: `${rec.itemName} inspection: ${inspection === 'good' ? 'good' : 'damaged/missing'}` }, relatedId: String(rec._id), priority: inspection === 'good' ? 'medium' : 'high' });
        return ok(rec);
      }
      case 'lending.transfer': {
        auth.requirePermission('lending:write');
        const rec = lendingTransition(COLLECTIONS.LENDING, payload.id, {
          action: 'transferred',
          toLocation: String(payload.location || ''),
          borrowerName: payload.borrowerName ? String(payload.borrowerName) : undefined,
          lenderName: payload.lenderName ? String(payload.lenderName) : undefined,
        });
        return ok(rec);
      }
      case 'lending.update': {
        auth.requirePermission('lending:write');
        const rec = repo.update(COLLECTIONS.LENDING, payload.id, { ...payload.data, updatedAt: new Date() });
        audit.audit('update', 'lending', payload.id, auditMsg('update', 'lending'));
        return ok(rec);
      }
      case 'lending.delete': {
        auth.requirePermission('lending:write');
        repo.remove(COLLECTIONS.LENDING, payload.id);
        audit.audit('delete', 'lending', payload.id, auditMsg('lendingRecordDeleted', 'lending'));
        return ok(true);
      }

      /* ---------- EXPORT / REPORTS ---------- */
      case 'export.excel':
        auth.requirePermission('reports:export');
        return ok(await exporter.exportToExcel(payload));
      case 'export.pdf':
        auth.requirePermission('reports:export');
        return ok(await exporter.exportToPdf(payload));
      case 'reports.generate': {
        auth.requirePermission('reports:read');
        return ok(buildReport(payload));
      }

      /* ---------- SEARCH ---------- */
      case 'search.global':
        return ok(search.searchGlobal(payload.query, payload.lang || 'ar'));
      case 'search.advanced':
        auth.requirePermission('search:*');
        return ok(search.advancedSearch(payload));

      /* ---------- TAGS ---------- */
      case 'tags.list':
        return ok(repo.listCollection(COLLECTIONS.TAGS));
      case 'tags.create':
        auth.requirePermission('documents:write');
        return ok(repo.create(COLLECTIONS.TAGS, { name: payload.name, color: payload.color || '#16a34a', createdAt: new Date() }));
      case 'tags.delete':
        auth.requirePermission('documents:write');
        return ok(repo.remove(COLLECTIONS.TAGS, payload.id));

      /* ---------- LOGS ---------- */
      case 'logs.list':
        auth.requirePermission('logs:read');
        return ok(audit.listLogs(payload.limit || 500, payload.offset || 0));
      case 'logs.clear':
        auth.requirePermission('logs:write');
        return ok(audit.clearLogs());

      /* ---------- STATS / DASHBOARD ---------- */
      case 'stats.dashboard':
        return ok(buildDashboard());

      /* ---------- FILE OPS ---------- */
      case 'file.pick': {
        const win = BrowserWindow.getFocusedWindow();
        const res = await dialog.showOpenDialog(win, {
          properties: ['openFile', ...(payload.multi ? ['multiSelections'] : [])],
          filters: payload.filters || [],
        });
        return ok({ canceled: res.canceled, paths: res.filePaths });
      }
      case 'file.open':
        await fileSvc.openFile(payload.path);
        return ok(true);
      case 'file.openFolder':
        await fileSvc.openFolder(payload.path);
        return ok(true);
      case 'file.saveDialog': {
        const win = BrowserWindow.getFocusedWindow();
        const res = await dialog.showSaveDialog(win, { defaultPath: payload.defaultName || 'report' });
        return ok({ canceled: res.canceled, path: res.filePath });
      }

      /* ---------- EMAIL LOG ---------- */
      case 'emailLog.list':
        return ok(emailLog.list(payload.query || {}));
      case 'emailLog.get':
        return ok(emailLog.getById(payload.id));
      case 'emailLog.create':
        return ok(emailLog.create(payload));
      case 'emailLog.update':
        return ok(emailLog.update(payload.id, payload.data));
      case 'emailLog.remove':
        return ok(emailLog.remove(payload.id));
      case 'emailLog.restore':
        return ok(emailLog.restore(payload.id));
      case 'emailLog.stats':
        return ok(emailLog.stats());
      case 'qr.generate': {
        const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const dataUrl = await QRCode.toDataURL(text, { width: 600, margin: 2 });
        return ok(dataUrl);
      }

      default:
        throw new Error('UNKNOWN_ACTION:' + action);
    }
  } catch (e) {
    return fail(e);
  }
}

async function updateOutgoingStatus(payload) {
  const realm = getRealm();
  const objs = realm.objects(COLLECTIONS.OUTGOING).filtered('_id == $0', new (require('realm').BSON.UUID)(payload.id));
  if (!objs.length) throw new Error('NOT_FOUND');
  realm.write(() => {
    objs[0].deliveryStatus = payload.status;
    if (payload.status === 'delivered') { objs[0].deliveryDate = new Date(); if (payload.receiver) objs[0].receiver = payload.receiver; }
    objs[0].updatedAt = new Date();
    objs[0].history.push({ action: 'status', status: payload.status, by: auth.getSession() ? auth.getSession().username : null, at: new Date(), note: payload.note || '' });
  });
  audit.audit('status', 'outgoing', payload.id, auditMsg('status', 'outgoing', payload.status));
  if (['delivered', 'rejected', 'cancelled'].includes(payload.status)) notify.markUrgentResolved(payload.id);
  try { notify.generateSystemReminders(); } catch (_) {}
  return serialize(objs[0]);
}

async function emptyRecycle() {
  const realm = getRealm();
  const targets = [
    [COLLECTIONS.DOCUMENTS, 'document'],
    [COLLECTIONS.INCOMING, 'incoming'],
    [COLLECTIONS.OUTGOING, 'outgoing'],
  ];
  realm.write(() => {
    for (const [col] of targets) {
      const del = realm.objects(col).filtered('deleted == true');
      realm.delete(del);
    }
  });
      audit.audit('delete', 'recycle', null, auditMsg('delete', 'recycle'));
}

function buildDashboard() {
  const realm = getRealm();
  const departments = realm.objects(COLLECTIONS.DEPARTMENTS).length;
  const documents = realm.objects(COLLECTIONS.DOCUMENTS).filtered('deleted == false').length;
  const incoming = realm.objects(COLLECTIONS.INCOMING).filtered('deleted == false').length;
  const outgoing = realm.objects(COLLECTIONS.OUTGOING).filtered('deleted == false').length;
  const totalLendings = realm.objects(COLLECTIONS.LENDING).filtered('deleted == false').length;
  const returnedLendings = realm.objects(COLLECTIONS.LENDING).filtered('deleted == false AND lendingType == $0', 'returned').length;
  const borrowedLendings = totalLendings - returnedLendings;
  const pendingIn = realm.objects(COLLECTIONS.INCOMING).filtered('deleted == false AND deliveryStatus == $0', 'pending').length;
  const pendingOut = realm.objects(COLLECTIONS.OUTGOING).filtered('deleted == false AND deliveryStatus == $0', 'pending').length;
  const deliveredIn = realm.objects(COLLECTIONS.INCOMING).filtered('deleted == false AND deliveryStatus == $0', 'delivered').length;
  const deliveredOut = realm.objects(COLLECTIONS.OUTGOING).filtered('deleted == false AND deliveryStatus == $0', 'delivered').length;

  const today = dayjs().startOf('day').toDate();
  const todayActivities = realm.objects(COLLECTIONS.LOGS).filtered('timestamp >= $0', today).length;
  const recentDocs = serializeList(realm.objects(COLLECTIONS.DOCUMENTS).filtered('deleted == false').sorted('createdAt', true).slice(0, 6));
  const recentLogs = serializeList(realm.objects(COLLECTIONS.LOGS).sorted('timestamp', true).slice(0, 8));
  const lendingHistory = serializeList(realm.objects(COLLECTIONS.LENDING).filtered('deleted == false AND lendingType == $0', 'borrowed').sorted('createdAt', true).slice(0, 10));

  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = dayjs().subtract(i, 'day').startOf('day').toDate();
    const next = dayjs(d).add(1, 'day').toDate();
    const inc = realm.objects(COLLECTIONS.INCOMING).filtered('createdAt >= $0 AND createdAt < $1', d, next).length;
    const out = realm.objects(COLLECTIONS.OUTGOING).filtered('createdAt >= $0 AND createdAt < $1', d, next).length;
    const doc = realm.objects(COLLECTIONS.DOCUMENTS).filtered('createdAt >= $0 AND createdAt < $1', d, next).length;
    daily.push({ date: dayjs(d).format('MM/DD'), incoming: inc, outgoing: out, documents: doc });
  }

  const storageUsage = computeStorage();
  return {
    departments, documents, incoming, outgoing, borrowedLendings,
    pendingIn, pendingOut, deliveredIn, deliveredOut,
    pendingLetters: pendingIn + pendingOut,
    deliveredLetters: deliveredIn + deliveredOut,
    todayActivities, recentDocs, recentLogs, daily, storageUsage,
    lendingHistory,
  };
}

function computeStorage() {
  try {
    const size = dirSize(ROOT.storage);
    const total = require('os').totalmem();
    return { usedBytes: size, usedMB: +(size / (1024 * 1024)).toFixed(2) };
  } catch (_) { return { usedBytes: 0, usedMB: 0 }; }
}

function dirSize(dir) {
  let total = 0;
  const walk = (p) => {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(p, e.name);
      if (e.isDirectory()) walk(fp);
      else total += fs.statSync(fp).size;
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return total;
}

function buildReport(payload) {
  const collectionMap = { incoming: COLLECTIONS.INCOMING, outgoing: COLLECTIONS.OUTGOING, documents: COLLECTIONS.DOCUMENTS, departments: COLLECTIONS.DEPARTMENTS };
  const col = collectionMap[payload.collection];
  if (!col) throw new Error('INVALID_COLLECTION');
  const realm = getRealm();
  const isDepartment = col === COLLECTIONS.DEPARTMENTS;
  let results = realm.objects(col);
  if (!isDepartment) results = results.filtered('deleted == false');
  if (payload.fromDate && payload.toDate) {
    const from = new Date(payload.fromDate);
    const to = new Date(payload.toDate);
    if (col === COLLECTIONS.INCOMING) {
      results = results.filtered('receivedDate >= $0 AND receivedDate <= $1', from, to);
    } else if (col === COLLECTIONS.OUTGOING) {
      results = results.filtered('sentDate >= $0 AND sentDate <= $1', from, to);
    } else {
      results = results.filtered('createdAt >= $0 AND createdAt <= $1', from, to);
    }
  }
  if (payload.departmentCode && !isDepartment) results = results.filtered('departmentCode == $0', payload.departmentCode);
  return serializeList(results.sorted('createdAt', true));
}

function registerIPC() {
  ipcMain.handle('eg:invoke', async (_e, msg) => handle(msg));
}

module.exports = { registerIPC, handle };
