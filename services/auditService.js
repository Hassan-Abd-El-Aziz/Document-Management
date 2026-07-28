'use strict';

const { getRealm } = require('../database/realm');
const { serialize } = require('../utils/serialize');
const { COLLECTIONS } = require('../config/constants');
const { getSession } = require('./authService');

function resolveUser(session) {
  if (!session) return { id: null, name: null };
  const fullName = session.fullName && (session.fullName.ar || session.fullName.en);
  const name = (fullName || session.username || null);
  return { id: session.userId || null, name: name ? String(name) : null };
}

function audit(action, entity, entityId, details, fileName) {
  const realm = getRealm();
  const session = getSession();
  const user = resolveUser(session);
  try {
    realm.write(() => {
      realm.create(COLLECTIONS.LOGS, {
        _id: new (require('realm').BSON.UUID)(),
        action,
        entity,
        entityId: entityId || null,
        userId: user.id,
        userName: user.name,
        details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        fileName: fileName || null,
        timestamp: new Date(),
      });
    });
  } catch (_) { /* never block primary action on audit failure */ }
}

function listLogs(limit = 500, offset = 0) {
  const realm = getRealm();
  const all = realm.objects(COLLECTIONS.LOGS).sorted('timestamp', true);
  const slice = Array.from(all).slice(offset, offset + limit);
  return slice.map((l) => serialize(l));
}

function clearLogs() {
  const realm = getRealm();
  realm.write(() => {
    realm.delete(realm.objects(COLLECTIONS.LOGS));
  });
  return true;
}

module.exports = { audit, listLogs, clearLogs };
