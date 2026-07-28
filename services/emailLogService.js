'use strict';

const { getRealm } = require('../database/realm');
const { serialize } = require('../utils/serialize');
const { COLLECTIONS } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');

function list(query) {
  const realm = getRealm();
  let all = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('deleted == false');
  if (query && query.status) all = all.filtered('status == $0', query.status);
  if (query && query.relatedType) all = all.filtered('relatedType == $0', query.relatedType);
  if (query && query.fromDate) all = all.filtered('sentAt >= $0', new Date(query.fromDate));
  if (query && query.toDate) all = all.filtered('sentAt <= $0', new Date(query.toDate));
  return serialize(all.sorted('sentAt', true));
}

function getById(id) {
  const realm = getRealm();
  const objs = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  return objs.length ? serialize(objs[0]) : null;
}

function create(data) {
  const realm = getRealm();
  const now = new Date();
  const rec = realm.create(COLLECTIONS.EMAIL_LOGS, {
    _id: new (require('realm').BSON.UUID)(),
    subject: data.subject || null,
    to: data.to || '',
    cc: data.cc || null,
    body: data.body || null,
    hasAttachments: !!(data.attachments && data.attachments.length),
    attachments: data.attachments || [],
    relatedId: data.relatedId || null,
    relatedType: data.relatedType || null,
    status: data.status || 'sent',
    priority: data.priority || 'medium',
    sentAt: data.sentAt ? new Date(data.sentAt) : now,
    createdBy: data.createdBy || null,
    deleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return serialize(rec);
}

function update(id, data) {
  const realm = getRealm();
  const objs = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  if (!objs.length) throw new Error('NOT_FOUND');
  const update = { ...data, updatedAt: new Date() };
  if (data.attachments && data.attachments.length) update.hasAttachments = true;
  realm.write(() => { objs[0].subject = data.subject ?? objs[0].subject; });
  const rec = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  return serialize(rec[0]);
}

function remove(id) {
  const realm = getRealm();
  const objs = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  if (!objs.length) throw new Error('NOT_FOUND');
  realm.write(() => { objs[0].deleted = true; objs[0].deletedAt = new Date(); });
  return true;
}

function restore(id) {
  const realm = getRealm();
  const objs = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  if (!objs.length) throw new Error('NOT_FOUND');
  realm.write(() => { objs[0].deleted = false; objs[0].deletedAt = null; });
  return serialize(objs[0]);
}

function unreadCount() {
  return 0;
}

function stats() {
  const realm = getRealm();
  const total = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('deleted == false').length;
  const withAttachments = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('deleted == false AND hasAttachments == true').length;
  const pending = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('deleted == false AND status == $0', 'pending').length;
  const sent = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('deleted == false AND status == $0', 'sent').length;
  const failed = realm.objects(COLLECTIONS.EMAIL_LOGS).filtered('deleted == false AND status == $0', 'failed').length;
  return { total, withAttachments, pending, sent, failed };
}

module.exports = {
  list, getById, create, update, remove, restore, unreadCount, stats,
};
