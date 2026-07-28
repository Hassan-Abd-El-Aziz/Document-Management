'use strict';

const Realm = require('realm');
const { getRealm } = require('./realm');
const { serialize, serializeList } = require('../utils/serialize');

function newId() {
  return new Realm.BSON.UUID();
}

function prepareForWrite(collection, data) {
  const out = { ...data };
  if (out._id && !(out._id instanceof Realm.BSON.UUID)) {
    try { out._id = new Realm.BSON.UUID(String(out._id)); } catch (_) { delete out._id; }
  }
  return out;
}

function listCollection(collection, query = null, args = {}) {
  const realm = getRealm();
  let results;
  if (query) {
    const values = Object.values(args || {});
    results = values.length ? realm.objects(collection).filtered(query, ...values) : realm.objects(collection).filtered(query);
  } else {
    results = realm.objects(collection);
  }
  return serializeList(results);
}

function getById(collection, id) {
  const realm = getRealm();
  const objs = realm.objects(collection).filtered('_id == $0', new Realm.BSON.UUID(String(id)));
  if (objs.length === 0) return null;
  return serialize(objs[0]);
}

function create(collection, data) {
  const realm = getRealm();
  const payload = prepareForWrite(collection, data);
  if (!payload._id) payload._id = newId();
  let created = null;
  realm.write(() => {
    created = realm.create(collection, payload);
  });
  return serialize(created);
}

function update(collection, id, data) {
  const realm = getRealm();
  const objs = realm.objects(collection).filtered('_id == $0', new Realm.BSON.UUID(String(id)));
  if (objs.length === 0) throw new Error('Record not found: ' + id);
  let updated = null;
  realm.write(() => {
    const obj = objs[0];
    for (const [key, value] of Object.entries(data)) {
      if (key === '_id') continue;
      obj[key] = value;
    }
    updated = obj;
  });
  return serialize(updated);
}

function remove(collection, id) {
  const realm = getRealm();
  const objs = realm.objects(collection).filtered('_id == $0', new Realm.BSON.UUID(String(id)));
  if (objs.length === 0) throw new Error('Record not found: ' + id);
  realm.write(() => {
    realm.delete(objs[0]);
  });
  return true;
}

function count(collection, query = null, args = {}) {
  const realm = getRealm();
  const values = Object.values(args || {});
  const results = query ? realm.objects(collection).filtered(query, ...values) : realm.objects(collection);
  return results.length;
}

function writeTransaction(fn) {
  const realm = getRealm();
  let result = null;
  realm.write(() => {
    result = fn(realm);
  });
  return result;
}

module.exports = {
  listCollection,
  getById,
  create,
  update,
  remove,
  count,
  writeTransaction,
  serialize,
  serializeList,
};
