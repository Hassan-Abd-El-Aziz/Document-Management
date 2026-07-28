'use strict';

const { getRealm } = require('../database/realm');
const { serialize } = require('../utils/serialize');
const { COLLECTIONS } = require('../config/constants');

function list() {
  const realm = getRealm();
  return serializeList(realm.objects(COLLECTIONS.SHELVES).sorted('createdAt', true));
}

function create(data) {
  const realm = getRealm();
  const rec = realm.write(() => {
    return realm.create(COLLECTIONS.SHELVES, {
      _id: new (require('realm').BSON.UUID)(),
      name: String(data.name || '').trim(),
      code: data.code || null,
      createdAt: new Date(),
    });
  });
  return serialize(rec);
}

function update(id, data) {
  const realm = getRealm();
  const objs = realm.objects(COLLECTIONS.SHELVES).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  if (!objs.length) throw new Error('Shelf not found');
  const rec = objs[0];
  realm.write(() => {
    rec.name = String(data.name || rec.name).trim();
    rec.code = data.code !== undefined ? data.code : rec.code;
    rec.updatedAt = new Date();
  });
  return serialize(rec);
}

function remove(id) {
  const realm = getRealm();
  realm.write(() => {
    realm.delete(realm.objects(COLLECTIONS.SHELVES).filtered('_id == $0', new (require('realm').BSON.UUID)(id)));
  });
  return true;
}

function serializeList(results) {
  return Array.from(results).map((item) => serialize(item));
}

module.exports = { list, create, update, remove, serializeList };
