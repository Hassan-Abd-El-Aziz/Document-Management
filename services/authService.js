'use strict';

const { getRealm, hashPassword } = require('../database/realm');
const { serialize } = require('../utils/serialize');
const { COLLECTIONS, ROLES, PERMISSIONS } = require('../config/constants');

let currentSession = null;

function getUserByUsername(username) {
  const realm = getRealm();
  const res = realm.objects(COLLECTIONS.USERS).filtered('username == $0', username);
  return res.length ? serialize(res[0]) : null;
}

function login(username, password) {
  const user = getUserByUsername(username);
  if (!user) throw new Error('INVALID_CREDENTIALS');
  if (!user.active) throw new Error('USER_DISABLED');
  const hashed = hashPassword(password);
  if (hashed !== user.password) throw new Error('INVALID_CREDENTIALS');
  const realm = getRealm();
  realm.write(() => {
    const objs = realm.objects(COLLECTIONS.USERS).filtered('_id == $0', new (require('realm').BSON.UUID)(user._id));
    if (objs.length) objs[0].lastLogin = new Date();
  });
  currentSession = { userId: user._id, username: user.username, role: user.role, fullName: user.fullName };
  return currentSession;
}

function logout() {
  currentSession = null;
  return true;
}

function getSession() {
  return currentSession;
}

function hasPermission(action) {
  if (!currentSession) return false;
  const perms = PERMISSIONS[currentSession.role] || [];
  if (perms.includes('*')) return true;
  return perms.includes(action) || perms.some((p) => p.endsWith(':*') && action.startsWith(p.split(':')[0] + ':'));
}

function requirePermission(action) {
  if (!currentSession) throw new Error('PERMISSION_DENIED:' + action);
  const perms = PERMISSIONS[currentSession.role] || [];
  if (perms.includes('*')) return true;
  return perms.includes(action) || perms.some((p) => p.endsWith(':*') && action.startsWith(p.split(':')[0] + ':'));
}

function verifyPin(pin) {
  const stored = require('./settingsService').getSetting('pinLockEnabled');
  if (!stored) return true;
  const expected = require('./settingsService').getSetting('pin');
  return String(pin) === String(expected);
}

function setPin(pin) {
  require('./settingsService').setSetting('pin', String(pin));
  require('./settingsService').setSetting('pinLockEnabled', true);
  return true;
}

module.exports = {
  login,
  logout,
  getSession,
  hasPermission,
  requirePermission,
  getUserByUsername,
  verifyPin,
  setPin,
};
