'use strict';

const { getRealm } = require('../database/realm');
const { serialize, serializeList } = require('../utils/serialize');
const { COLLECTIONS } = require('../config/constants');

function localize(value, lang) {
  if (value && typeof value === 'object') return value[lang] || value.en || '';
  return value;
}

function tagsOf(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function matcher(text) {
  const t = String(text || '').toLowerCase();
  return (field) => String(field || '').toLowerCase().includes(t);
}

function searchGlobal(query, lang = 'ar') {
  const realm = getRealm();
  const q = String(query || '').trim();
  if (!q) return { documents: [], incoming: [], outgoing: [], departments: [] };
  const m = matcher(q);
  const out = { documents: [], incoming: [], outgoing: [], departments: [] };

  const docs = serializeList(realm.objects(COLLECTIONS.DOCUMENTS).filtered('deleted == false'));
  out.documents = docs.filter((d) =>
    m(d.fileNumber) || m(localize(d.title, lang)) || m(d.projectName) || tagsOf(d.tags).some(m) || m(d.notes)
  ).slice(0, 50);

  const inc = serializeList(realm.objects(COLLECTIONS.INCOMING).filtered('deleted == false'));
  out.incoming = inc.filter((d) =>
    m(d.letterNumber) || m(localize(d.subject, lang)) || m(d.fromEntity) || m(d.toEntity) || tagsOf(d.tags).some(m)
  ).slice(0, 50);

  const outg = serializeList(realm.objects(COLLECTIONS.OUTGOING).filtered('deleted == false'));
  out.outgoing = outg.filter((d) =>
    m(d.letterNumber) || m(localize(d.subject, lang)) || m(d.sentTo) || tagsOf(d.tags).some(m)
  ).slice(0, 50);

  const depts = serializeList(realm.objects(COLLECTIONS.DEPARTMENTS));
  out.departments = depts.filter((d) => m(d.code) || m(localize(d.name, lang)) || m(d.manager)).slice(0, 50);

  return out;
}

function advancedSearch({ collection, filters = {}, lang = 'ar' }) {
  const realm = getRealm();
  const collectionMap = {
    incoming: COLLECTIONS.INCOMING,
    outgoing: COLLECTIONS.OUTGOING,
    documents: COLLECTIONS.DOCUMENTS,
    departments: COLLECTIONS.DEPARTMENTS,
  };
  const col = collectionMap[collection] || collection;
  const args = {};
  const parts = [];
  const isDepartment = col === COLLECTIONS.DEPARTMENTS;
  if (!isDepartment) parts.push('deleted == false');
  if (filters.departmentCode) { parts.push('departmentCode == $dc'); args.$dc = filters.departmentCode; }
  if (filters.projectName) { parts.push('projectName CONTAINS[c] $pn'); args.$pn = String(filters.projectName); }
  if (filters.status) { parts.push('deliveryStatus == $st'); args.$st = filters.status; }
  if (filters.priority) { parts.push('priority == $pr'); args.$pr = filters.priority; }
  if (filters.fromDate && filters.toDate) {
    if (col === COLLECTIONS.INCOMING) {
      parts.push('receivedDate >= $from AND receivedDate <= $to');
    } else if (col === COLLECTIONS.OUTGOING) {
      parts.push('sentDate >= $from AND sentDate <= $to');
    } else {
      parts.push('createdAt >= $from AND createdAt <= $to');
    }
    args.$from = new Date(filters.fromDate);
    args.$to = new Date(filters.toDate);
  }
  if (filters.number) { parts.push('letterNumber CONTAINS[c] $ln'); args.$ln = String(filters.number); }
  if (filters.subject) { parts.push('subject CONTAINS[c] $su'); args.$su = String(filters.subject); }
  if (isLetter) {
    if (filters.fromEntity) { parts.push('fromEntity CONTAINS[c] $fe'); args.$fe = String(filters.fromEntity); }
    if (filters.toEntity) { parts.push('toEntity CONTAINS[c] $te'); args.$te = String(filters.toEntity); }
  } else if (filters.keyword) {
    parts.push('(notes CONTAINS[c] $kw OR subject CONTAINS[c] $kw OR title CONTAINS[c] $kw)');
    args.$kw = String(filters.keyword);
  }
  const query = parts.length ? parts.join(' AND ') : 'TRUEPREDICATE';
  const argsValues = Object.values(args || {});
  const results = argsValues.length ? realm.objects(col).filtered(query, ...argsValues) : realm.objects(col).filtered(query);
  const sortField = col === COLLECTIONS.INCOMING ? 'receivedDate' : col === COLLECTIONS.OUTGOING ? 'sentDate' : 'createdAt';
  return serialize(results.sorted(sortField, true));
}

module.exports = { searchGlobal, advancedSearch, localize };
