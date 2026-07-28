'use strict';

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ROOT } = require('../config/constants');

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  txt: 'text/plain',
  zip: 'application/zip',
};

function extOf(name) {
  const i = String(name).lastIndexOf('.');
  return i >= 0 ? String(name).slice(i + 1).toLowerCase() : '';
}

function mimeOf(name) {
  return MIME_BY_EXT[extOf(name)] || 'application/octet-stream';
}

function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_');
}

async function saveFromPath(srcPath, destDir, name) {
  await fs.ensureDir(destDir);
  const finalName = name ? safeName(name) : `${uuidv4()}.${extOf(srcPath)}`;
  const dest = path.join(destDir, finalName);
  await fs.copy(srcPath, dest, { overwrite: true });
  const stat = await fs.stat(dest);
  return { fileName: finalName, filePath: dest, size: stat.size, mimeType: mimeOf(finalName) };
}

async function writeBuffer(buffer, destDir, name) {
  await fs.ensureDir(destDir);
  const dest = path.join(destDir, safeName(name));
  await fs.writeFile(dest, buffer);
  const stat = await fs.stat(dest);
  return { fileName: safeName(name), filePath: dest, size: stat.size, mimeType: mimeOf(name) };
}

async function moveFile(src, destDir, name) {
  await fs.ensureDir(destDir);
  const dest = path.join(destDir, name || path.basename(src));
  await fs.move(src, dest, { overwrite: true });
  return dest;
}

async function deleteFile(filePath) {
  if (!filePath) return false;
  try { await fs.remove(filePath); return true; } catch (_) { return false; }
}

function storageDirFor(category, deptCode) {
  switch (category) {
    case 'incoming': return ROOT.incoming;
    case 'outgoing': return ROOT.outgoing;
    case 'department': return path.join(ROOT.departments, deptCode || 'general');
    default: return ROOT.documents;
  }
}

async function openFile(filePath) {
  const { shell } = require('electron');
  if (filePath && await fs.pathExists(filePath)) {
    return shell.openPath(filePath);
  }
  throw new Error('FILE_NOT_FOUND');
}

async function openFolder(folderPath) {
  const { shell } = require('electron');
  await shell.openPath(folderPath);
  return true;
}

module.exports = {
  extOf,
  mimeOf,
  safeName,
  saveFromPath,
  writeBuffer,
  moveFile,
  deleteFile,
  storageDirFor,
  openFile,
  openFolder,
};
