'use strict';

const { getRealm } = require('../database/realm');
const { serialize } = require('../utils/serialize');
const { COLLECTIONS } = require('../config/constants');

function getSettings() {
  const realm = getRealm();
  const out = {};
  const all = realm.objects(COLLECTIONS.SETTINGS);
  for (const s of all) {
    out[s.key] = serialize(s.value);
  }
  return out;
}

function getSetting(key) {
  const realm = getRealm();
  const res = realm.objects(COLLECTIONS.SETTINGS).filtered('key == $0', key);
  return res.length ? serialize(res[0].value) : undefined;
}

function setSetting(key, value) {
  const realm = getRealm();
  const res = realm.objects(COLLECTIONS.SETTINGS).filtered('key == $0', key);
  realm.write(() => {
    if (res.length) {
      res[0].value = value;
      res[0].updatedAt = new Date();
    } else {
      realm.create(COLLECTIONS.SETTINGS, {
        _id: new (require('realm').BSON.UUID)(),
        key,
        value,
        updatedAt: new Date(),
      });
    }
  });
  return value;
}

function updateSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    setSetting(key, value);
  }
  return getSettings();
}

module.exports = { getSettings, getSetting, setSetting, updateSettings };
