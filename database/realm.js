'use strict';

const Realm = require('realm');
const path = require('path');
const fs = require('fs-extra');
const { schemas } = require('./schema');
const { ROOT } = require('../config/constants');
const { STORAGE_DIRS, DEFAULT_SETTINGS, DEFAULT_ADMIN } = require('../config/defaults');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

let realmInstance = null;

async function ensureDirectories() {
  for (const dir of STORAGE_DIRS) {
    await fs.ensureDir(path.join(ROOT.data, dir));
  }
}

function getRealm() {
  if (!realmInstance) {
    throw new Error('Realm is not initialized. Call initDatabase() first.');
  }
  return realmInstance;
}

async function initDatabase() {
  await ensureDirectories();

  realmInstance = await Realm.open({
    path: path.join(ROOT.realm, 'egypt-gulf.realm'),
    schema: schemas,
    schemaVersion: 11,
    migration: (oldRealm, newRealm) => {
      const oldVersion = oldRealm.schemaVersion;
      if (oldVersion < 7) {
        const documents = oldRealm.objects('Document');
        const lendings = oldRealm.objects('Lending');
        oldRealm.write(() => {
          for (const doc of documents) {
            doc.documentType = doc.documentType || 'document';
            doc.shelfLocation = doc.shelfLocation || null;
          }
          for (const lending of lendings) {
            lending.materialType = lending.materialType || 'document';
            lending.borrowPurpose = lending.borrowPurpose || '';
            lending.approvalAttachment = lending.approvalAttachment || null;
          }
        });
      }
      if (oldVersion < 8) {
        const shelves = newRealm.objects('Shelf');
        if (!shelves.length) {
          newRealm.write(() => {
            ['Shelf A', 'Shelf B', 'Shelf C', 'Shelf D', 'Safe Box'].forEach((name, idx) => {
              newRealm.create('Shelf', {
                _id: new (require('realm').BSON.UUID)(),
                name,
                code: 'SH-' + String(idx + 1).padStart(3, '0'),
                createdAt: new Date(),
              });
            });
          });
        }
      }
      if (oldVersion < 9) {
        const lendings = oldRealm.objects('Lending');
        newRealm.write(() => {
          for (const lending of lendings) {
            lending.previousDocumentLocation = lending.previousDocumentLocation || null;
          }
        });
      }
      if (oldVersion < 10) {
        const lendings = oldRealm.objects('Lending');
        newRealm.write(() => {
          for (const lending of lendings) {
            lending.lendingType = lending.lendingType || 'borrowed';
          }
        });
      }
      if (oldVersion < 11) {
        const documents = newRealm.objects('Document');
        const incoming = newRealm.objects('IncomingLetter');
        const outgoing = newRealm.objects('OutgoingLetter');
        newRealm.write(() => {
          for (const doc of documents) {
            if (doc.properties.includes('documentDate')) doc.documentDate = doc.documentDate || null;
            if (doc.properties.includes('archiveDeliveryDate')) doc.archiveDeliveryDate = doc.archiveDeliveryDate || null;
          }
          for (const letter of incoming) {
            if (letter.properties.includes('archiveDeliveryDate')) letter.archiveDeliveryDate = letter.archiveDeliveryDate || null;
          }
          for (const letter of outgoing) {
            if (letter.properties.includes('archiveDeliveryDate')) letter.archiveDeliveryDate = letter.archiveDeliveryDate || null;
          }
        });
      }
    },
    deleteRealmIfMigrationNeeded: false,
  });

  await seedIfEmpty();
  return realmInstance;
}

function hashPassword(pw) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(pw)).digest('hex');
}

async function seedIfEmpty() {
  const realm = getRealm();
  const users = realm.objects('User');
  if (users.length === 0) {
    realm.write(() => {
      realm.create('User', {
        _id: Realm.BSON.UUID ? new Realm.BSON.UUID() : uuidv4(),
        username: DEFAULT_ADMIN.username,
        password: hashPassword(DEFAULT_ADMIN.password),
        fullName: DEFAULT_ADMIN.fullName,
        role: DEFAULT_ADMIN.role,
        email: DEFAULT_ADMIN.email,
        phone: '',
        active: true,
        createdAt: new Date(),
        lastLogin: null,
      });
    });
  }

  const settings = realm.objects('Setting');
  if (settings.length === 0) {
    realm.write(() => {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        realm.create('Setting', {
          _id: Realm.BSON.UUID ? new Realm.BSON.UUID() : uuidv4(),
          key,
          value,
          updatedAt: new Date(),
        });
      }
    });
  }
}

function closeDatabase() {
  if (realmInstance && !realmInstance.isClosed) {
    realmInstance.close();
    realmInstance = null;
  }
}

module.exports = {
  initDatabase,
  getRealm,
  closeDatabase,
  ensureDirectories,
  hashPassword,
};
