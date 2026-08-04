'use strict';

const os = require('os');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');

const VALID_CODE = 'Hassan01009039628';

function getActivationDir() {
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'activation');
  } catch (_) {
    return path.join(process.cwd(), 'activation');
  }
}

function getActivationFile() {
  return path.join(getActivationDir(), 'license.json');
}

function generateMachineId() {
  const cpus = os.cpus();
  const cpuInfo = cpus.map((c) => c.manufacturer + c.brand + c.speed + c.cores).join('');
  const memInfo = os.totalmem();
  const hostName = os.hostname();
  const osInfo = os.type() + os.release() + os.platform();
  const macs = getMacAddresses();
  const raw = cpuInfo + '|' + memInfo + '|' + hostName + '|' + osInfo + '|' + macs.join(',');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getMacAddresses() {
  const nets = os.networkInterfaces();
  const result = [];
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
        result.push(iface.mac);
      }
    }
  }
  return result.length ? result : ['unknown'];
}

function getMachineInfo() {
  return {
    machineId: generateMachineId(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
    macAddresses: getMacAddresses(),
  };
}

function getActivationData() {
  try {
    const file = getActivationFile();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    }
  } catch (_) {
    return null;
  }
  return null;
}

function isActivated() {
  const data = getActivationData();
  if (!data || !data.activated) return false;
  const currentMachineId = generateMachineId();
  if (data.machineId !== currentMachineId) return false;
  return true;
}

function getMachineId() {
  return generateMachineId();
}

function getMachineIdDisplay() {
  return generateMachineId().slice(0, 8).toUpperCase();
}

function activate(code) {
  if (!code || String(code).trim() !== VALID_CODE) {
    return { ok: false, error: 'INVALID_CODE' };
  }
  const machineId = generateMachineId();
  const data = {
    activated: true,
    machineId: machineId,
    activationCode: code,
    activatedAt: new Date().toISOString(),
    machineInfo: getMachineInfo(),
  };
  try {
    const file = getActivationFile();
    fs.ensureDirSync(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    return { ok: false, error: 'WRITE_FAILED' };
  }
  return { ok: true, data };
}

function deactivate() {
  try {
    const file = getActivationFile();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (_) {}
  return { ok: true };
}

function getActivationStatus() {
  const data = getActivationData();
  return {
    activated: isActivated(),
    machineId: getMachineId(),
    machineIdDisplay: getMachineIdDisplay(),
    activatedAt: data ? data.activatedAt : null,
    machineInfo: data ? data.machineInfo : getMachineInfo(),
  };
}

module.exports = {
  getActivationFile,
  VALID_CODE,
  generateMachineId,
  getMachineId,
  getMachineIdDisplay,
  getMachineInfo,
  isActivated,
  activate,
  deactivate,
  getActivationStatus,
  getActivationData,
};
