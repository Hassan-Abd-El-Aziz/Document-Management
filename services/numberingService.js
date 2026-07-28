'use strict';

const Realm = require('realm');
const { getRealm } = require('../database/realm');
const { serialize } = require('../utils/serialize');
const { COLLECTIONS } = require('../config/constants');
const dayjs = require('dayjs');

const TYPES = { INCOMING: 'incoming', OUTGOING: 'outgoing', DOCUMENT: 'document' };

function pad(num, size = 6) {
  return String(num).padStart(size, '0');
}

function formatNumber(type, year, deptCode, value) {
  const code = (deptCode || 'GEN').toUpperCase();
  const padded = String(value).padStart(6, '0');
  if (type === TYPES.INCOMING) return `${year}-${code}-In-${padded}`;
  if (type === TYPES.OUTGOING) return `${year}-${code}-Out-${padded}`;
  return `${year}-${code}-${padded}`;
}

function formatCustomNumber(year, deptCode, seq) {
  const code = (deptCode || 'GEN').toUpperCase();
  const numeric = String(seq || '').replace(/\D/g, '');
  const padded = numeric.padStart(6, '0').slice(0, 6);
  return `${year}-${code}-${padded}`;
}

function composeCustomNumber(year, deptCode, seqInput) {
  return formatCustomNumber(year, deptCode, seqInput);
}

function validateSequence(seq) {
  const numeric = String(seq || '').replace(/\D/g, '');
  return numeric.length === 6 && /^\d{6}$/.test(numeric);
}

function nextCounter({ type, deptCode = 'GEN', year = dayjs().year() }) {
  const realm = getRealm();
  const id = `${type}-${year}-${deptCode}`;
  const res = realm.objects(COLLECTIONS.COUNTERS).filtered('_id == $0', id);
  let value = 1;
  realm.write(() => {
    if (res.length) {
      res[0].value += 1;
      value = res[0].value;
    } else {
      realm.create(COLLECTIONS.COUNTERS, {
        _id: id,
        deptCode,
        year: Number(year),
        type,
        value: 1,
      });
      value = 1;
    }
  });
  return { fileNumber: formatNumber(type, year, deptCode, value), raw: value };
}

function currentCounter({ type, deptCode = 'GEN', year = dayjs().year() }) {
  const realm = getRealm();
  const id = `${type}-${year}-${deptCode}`;
  const res = realm.objects(COLLECTIONS.COUNTERS).filtered('_id == $0', id);
  return res.length ? serialize(res[0]) : { value: 0 };
}

function isUnique(collection, field, value) {
  const realm = getRealm();
  const res = realm.objects(collection).filtered(`${field} == $0 AND deleted == false`, value);
  return res.length === 0;
}

function suggestNextDocumentNumber(deptCode = 'GEN', year = dayjs().year()) {
  const realm = getRealm();
  const docs = realm.objects(COLLECTIONS.DOCUMENTS).filtered('departmentCode == $0 AND deleted == false AND fileNumber != null', deptCode);
  let maxSeq = 0;
  for (const doc of docs) {
    const parts = String(doc.fileNumber || '').split('-');
    if (parts.length >= 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  const nextSeq = maxSeq + 1;
  return formatCustomNumber(year, deptCode, String(nextSeq));
}

module.exports = { nextCounter, currentCounter, isUnique, formatNumber, formatCustomNumber, composeCustomNumber, validateSequence, suggestNextDocumentNumber, TYPES };
