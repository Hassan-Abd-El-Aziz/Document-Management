'use strict';

const { getRealm } = require('../database/realm');
const { serialize } = require('../utils/serialize');
const { COLLECTIONS } = require('../config/constants');
const dayjs = require('dayjs');

function createNotification({ type, title, body, relatedId, priority = 'medium' }) {
  const realm = getRealm();
  let created = null;
  realm.write(() => {
    created = realm.create(COLLECTIONS.NOTIFICATIONS, {
      _id: new (require('realm').BSON.UUID)(),
      type,
      title: typeof title === 'string' ? { ar: title, en: title } : title,
      body: typeof body === 'string' ? { ar: body, en: body } : body,
      relatedId: relatedId || null,
      read: false,
      priority,
      createdAt: new Date(),
    });
  });
  return serialize(created);
}

function listNotifications(unreadOnly = false) {
  const realm = getRealm();
  const all = realm.objects(COLLECTIONS.NOTIFICATIONS);
  const filtered = unreadOnly ? all.filtered('read == false') : all;
  return serialize(filtered.sorted('createdAt', true));
}

function unreadCount() {
  const realm = getRealm();
  return realm.objects(COLLECTIONS.NOTIFICATIONS).filtered('read == false').length;
}

function markRead(id) {
  const realm = getRealm();
  const res = realm.objects(COLLECTIONS.NOTIFICATIONS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  if (res.length) {
    realm.write(() => { res[0].read = true; });
  }
  return true;
}

function markAllRead() {
  const realm = getRealm();
  realm.write(() => {
    const unread = realm.objects(COLLECTIONS.NOTIFICATIONS).filtered('read == false');
    for (const n of unread) n.read = true;
  });
  return true;
}

function generateSystemReminders() {
  const realm = getRealm();
  realm.write(() => {
    realm.objects(COLLECTIONS.NOTIFICATIONS).filtered('read == false').forEach((n) => { n.read = true; });
  });
  const pendingIncoming = realm.objects(COLLECTIONS.INCOMING).filtered('deliveryStatus == $0 AND deleted == false', 'pending').length;
  const pendingOutgoing = realm.objects(COLLECTIONS.OUTGOING).filtered('deliveryStatus == $0 AND deleted == false', 'pending').length;
  if (pendingIncoming > 0) {
    createNotification({
      type: 'pending',
      title: { ar: 'خطابات واردة معلقة', en: 'Pending Incoming Letters' },
      body: { ar: `لديك ${pendingIncoming} خطاب وارد بانتظار المعالجة`, en: `You have ${pendingIncoming} pending incoming letters` },
      priority: 'medium',
    });
  }
  if (pendingOutgoing > 0) {
    createNotification({
      type: 'pending',
      title: { ar: 'خطابات صادرة معلقة', en: 'Pending Outgoing Letters' },
      body: { ar: `لديك ${pendingOutgoing} خطاب صادر بانتظار التسليم`, en: `You have ${pendingOutgoing} pending outgoing letters` },
      priority: 'medium',
    });
  }
  const urgentPendingIncoming = realm.objects(COLLECTIONS.INCOMING).filtered('deliveryStatus == $0 AND priority == $1 AND deleted == false', 'pending', 'urgent').length;
  const urgentPendingOutgoing = realm.objects(COLLECTIONS.OUTGOING).filtered('deliveryStatus == $0 AND priority == $1 AND deleted == false', 'pending', 'urgent').length;
  if (urgentPendingIncoming > 0) {
    createNotification({
      type: 'urgent_pending',
      title: { ar: 'خطابات واردة عاجلة معلقة', en: 'Urgent Pending Incoming Letters' },
      body: { ar: `لديك ${urgentPendingIncoming} خطاب وارد عاجل بانتظار المعالجة`, en: `You have ${urgentPendingIncoming} urgent pending incoming letters` },
      priority: 'high',
    });
  }
  if (urgentPendingOutgoing > 0) {
    createNotification({
      type: 'urgent_pending',
      title: { ar: 'خطابات صادرة عاجلة معلقة', en: 'Urgent Pending Outgoing Letters' },
      body: { ar: `لديك ${urgentPendingOutgoing} خطاب صادر عاجل بانتظار التسليم`, en: `You have ${urgentPendingOutgoing} urgent pending outgoing letters` },
      priority: 'high',
    });
  }
  return true;
}

const TERMINAL_STATUS = ['delivered', 'rejected', 'cancelled'];

function letterById(collection, idStr) {
  const realm = getRealm();
  const objs = realm.objects(collection).filtered('_id == $0', new (require('realm').BSON.UUID)(idStr));
  return objs.length ? objs[0] : null;
}

function resolveStaleUrgentFollowups() {
  const realm = getRealm();
  const pending = realm.objects(COLLECTIONS.NOTIFICATIONS).filtered('type == $0 AND read == false', 'urgent_followup');
  const stale = [];
  for (const n of pending) {
    if (!n.relatedId) continue;
    const letter = letterById(COLLECTIONS.INCOMING, n.relatedId) || letterById(COLLECTIONS.OUTGOING, n.relatedId);
    if (!letter || letter.deleted || TERMINAL_STATUS.includes(letter.deliveryStatus)) stale.push(n);
  }
  realm.write(() => { for (const n of stale) n.read = true; });
}

function generateUrgentFollowups() {
  const realm = getRealm();
  resolveStaleUrgentFollowups();
  const scan = (collection, dirKey, dirAr) => {
    const letters = realm.objects(collection).filtered('priority == $p AND deleted == false', { p: 'urgent' });
    for (const letter of letters) {
      if (TERMINAL_STATUS.includes(letter.deliveryStatus)) continue;
      const idStr = letter._id.toString();
      const existing = realm.objects(COLLECTIONS.NOTIFICATIONS).filtered('type == $0 AND relatedId == $1 AND read == false', 'urgent_followup', idStr);
      if (existing.length) continue;
      createNotification({
        type: 'urgent_followup',
        title: { ar: 'متابعة خطاب عاجل', en: 'Urgent Letter Follow-up' },
        body: { ar: `${dirAr} عاجل برقم ${letter.letterNumber} بانتظار المعالجة`, en: `Urgent ${dirKey} #${letter.letterNumber} is awaiting action` },
        relatedId: idStr,
        priority: 'high',
      });
    }
  };
  scan(COLLECTIONS.INCOMING, 'incoming', 'وارد');
  scan(COLLECTIONS.OUTGOING, 'outgoing', 'صادر');
  return true;
}

function markUrgentResolved(relatedId) {
  const realm = getRealm();
  const res = realm.objects(COLLECTIONS.NOTIFICATIONS).filtered('type == $0 AND relatedId == $1 AND read == false', 'urgent_followup', String(relatedId));
  realm.write(() => { for (const n of res) n.read = true; });
  return true;
}

module.exports = {
  createNotification,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  generateSystemReminders,
  generateUrgentFollowups,
  markUrgentResolved,
};
