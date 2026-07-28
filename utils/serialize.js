'use strict';

const Realm = require('realm');

function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Realm.BSON.UUID || (value.constructor && value.constructor.name === 'UUID')) return value.toString();
  if (value instanceof Realm.BSON.ObjectId || (value.constructor && value.constructor.name === 'ObjectId')) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => serialize(v));
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = serialize(value[key]);
    }
    return out;
  }
  return value;
}

function serializeList(results) {
  return Array.from(results).map((item) => serialize(item));
}

module.exports = { serialize, serializeList };
