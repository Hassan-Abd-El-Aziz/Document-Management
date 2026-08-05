'use strict';

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const extract = require('extract-zip');
const { ROOT, COLLECTIONS } = require('../config/constants');
const { getRealm } = require('../database/realm');
const { serialize, serializeList } = require('../utils/serialize');
const realmModule = require('../database/realm');

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  if (!fs.existsSync(ROOT.backups)) fs.mkdirSync(ROOT.backups, { recursive: true });
  initialized = true;
}

function backupFolder(type = 'manual') {
  const now = new Date();
  const stamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
  const name = `backup_${type}_${stamp}`;
  return { folder: path.join(ROOT.backups, name), name };
}

function realmDir() {
  return ROOT.realm;
}

function listDbFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) =>
    f.endsWith('.realm') || f.endsWith('.realm.lock') || f.endsWith('.realm.management')
  );
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

async function createBackup({ type = 'manual', note = '' } = {}) {
  ensureInitialized();
  const { folder, name } = backupFolder(type);

  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const srcDir = realmDir();
  const dbFiles = listDbFiles(srcDir);
  let totalSize = 0;

  for (const file of dbFiles) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(folder, file);
    if (fs.existsSync(srcPath) && fs.lstatSync(srcPath).isFile()) {
      try {
        fs.copyFileSync(srcPath, destPath);
        totalSize += fs.statSync(destPath).size;
      } catch (e) {
        console.warn('Could not copy DB file for backup:', file, e.message);
      }
    }
  }

  const storageDir = ROOT.storage;
  const storageDest = path.join(folder, 'storage');
  if (fs.existsSync(storageDir)) {
    if (!fs.existsSync(storageDest)) fs.mkdirSync(storageDest, { recursive: true });
    const entries = fs.readdirSync(storageDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'Backups' || entry.name === 'Temp') continue;
      const src = path.join(storageDir, entry.name);
      const dest = path.join(storageDest, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(src, dest);
      } else if (entry.isFile()) {
        fs.copyFileSync(src, dest);
        totalSize += fs.statSync(dest).size;
      }
    }
  }

  const realm = getRealm();
  const record = {
    _id: new (require('realm').BSON.UUID)(),
    filename: name,
    path: folder,
    fileName: name,
    type,
    size: totalSize,
    itemCount: dbFiles.length,
    isValid: true,
    note: note || '',
    createdAt: new Date(),
  };

  let rec = null;
  realm.write(() => {
    rec = realm.create(COLLECTIONS.BACKUPS, record);
  });
  return serialize(rec);
}

function listBackups() {
  const realm = getRealm();
  return serializeList(realm.objects(COLLECTIONS.BACKUPS).sorted('createdAt', true));
}

async function restoreBackup(id) {
  const realm = getRealm();
  const res = realm.objects(COLLECTIONS.BACKUPS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  if (!res.length) throw new Error('BACKUP_NOT_FOUND');
  const backup = serialize(res[0]);

  if (!fs.existsSync(backup.path)) throw new Error('BACKUP_FOLDER_NOT_FOUND:' + backup.path);

  try {
    realmModule.closeDatabase();
  } catch (_) {}

  const dbDir = realmDir();
  const files = fs.readdirSync(backup.path);
  for (const file of files) {
    const src = path.join(backup.path, file);
    const dest = path.join(dbDir, file);
    if (fs.lstatSync(src).isFile()) {
      fs.copyFileSync(src, dest);
    }
  }

  const storageDir = ROOT.storage;
  const storageBackup = path.join(backup.path, 'storage');
  if (fs.existsSync(storageBackup)) {
    const entries = fs.readdirSync(storageBackup, { withFileTypes: true });
    for (const entry of entries) {
      const src = path.join(storageBackup, entry.name);
      const dest = path.join(storageDir, entry.name);
      if (entry.isDirectory()) {
        if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
        fs.mkdirSync(dest, { recursive: true });
        copyDirRecursive(src, dest);
      } else if (entry.isFile()) {
        fs.copyFileSync(src, dest);
      }
    }
  }

  try {
    realmModule.initDatabase();
  } catch (e) {
    throw new Error('RESTORE_INIT_FAILED:' + (e && e.message ? e.message : String(e)));
  }

  return { success: true };
}

async function restoreFromPath(backupPath) {
  if (!fs.existsSync(backupPath)) throw new Error('BACKUP_PATH_NOT_FOUND:' + backupPath);
  const isDir = fs.lstatSync(backupPath).isDirectory();
  let folder = null;
  let tempDir = null;

  if (isDir) {
    folder = backupPath;
  } else if (/\.zip$/i.test(backupPath)) {
    tempDir = path.join(ROOT.temp, 'restore-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    await extract(backupPath, { dir: tempDir });
    folder = tempDir;
  } else {
    throw new Error('BACKUP_PATH_IS_NOT_FOLDER:' + backupPath);
  }

  try {
    const realm = getRealm();
    const res = realm.objects(COLLECTIONS.BACKUPS).filtered('path == $0', folder);
    const backup = res.length ? serialize(res[0]) : { path: folder };

    try {
      realmModule.closeDatabase();
    } catch (_) {}

    const dbDir = realmDir();
    const files = fs.readdirSync(folder);
    for (const file of files) {
      const src = path.join(folder, file);
      const dest = path.join(dbDir, file);
      if (fs.lstatSync(src).isFile()) {
        fs.copyFileSync(src, dest);
      }
    }

    const storageDir = ROOT.storage;
    const storageBackup = path.join(folder, 'storage');
    if (fs.existsSync(storageBackup)) {
      const entries = fs.readdirSync(storageBackup, { withFileTypes: true });
      for (const entry of entries) {
        const src = path.join(storageBackup, entry.name);
        const dest = path.join(storageDir, entry.name);
        if (entry.isDirectory()) {
          if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
          fs.mkdirSync(dest, { recursive: true });
          copyDirRecursive(src, dest);
        } else if (entry.isFile()) {
          fs.copyFileSync(src, dest);
        }
      }
    }

    try {
      realmModule.initDatabase();
    } catch (e) {
      throw new Error('RESTORE_INIT_FAILED:' + (e && e.message ? e.message : String(e)));
    }

    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }

    return { success: true };
  } catch (e) {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
    throw e;
  }
}

async function deleteBackup(id) {
  const realm = getRealm();
  const res = realm.objects(COLLECTIONS.BACKUPS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  if (!res.length) return false;
  const backup = serialize(res[0]);

  try { fs.rmSync(backup.path, { recursive: true, force: true }); } catch (_) {}

  realm.write(() => { realm.delete(res[0]); });
  return true;
}

async function exportBackup(id) {
  const realm = getRealm();
  const res = realm.objects(COLLECTIONS.BACKUPS).filtered('_id == $0', new (require('realm').BSON.UUID)(id));
  if (!res.length) throw new Error('BACKUP_NOT_FOUND');
  const backup = serialize(res[0]);

  if (!fs.existsSync(backup.path)) throw new Error('BACKUP_FOLDER_NOT_FOUND:' + backup.path);

  const stamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
  const zipName = `backup_${backup.type || 'manual'}_${stamp}.zip`;
  const zipPath = path.join(ROOT.exports, zipName);
  if (!fs.existsSync(ROOT.exports)) fs.mkdirSync(ROOT.exports, { recursive: true });

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve({ path: zipPath, fileName: zipName, size: archive.pointer() }));
    archive.on('error', (err) => reject(err));
    archive.pipe(output);

    archive.directory(backup.path, false);
    archive.finalize();
  });
}

function initialize() {
  ensureInitialized();
}

module.exports = {
  initialize,
  createBackup,
  listBackups,
  restoreBackup,
  restoreFromPath,
  deleteBackup,
  exportBackup,
};
