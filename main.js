'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const cron = require('node-cron');

const { initDatabase, closeDatabase } = require('./database/realm');
const { registerIPC } = require('./electron/ipc');
const backup = require('./services/backupService');
const notify = require('./services/notificationService');
const settings = require('./services/settingsService');

let mainWindow = null;
let backupJob = null;
let urgentJob = null;
let dailyReminderJob = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#f4f6f8',
    title: getAppTitle(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function getAppTitle() {
  try {
    const s = settings.getSettings();
    const name = s.companyName && (s.companyName.ar || s.companyName.en) ? (s.companyName.ar || s.companyName.en) : 'Egypt Gulf';
    return name + ' - Document Management';
  } catch (_) {
    return 'Egypt Gulf - Document Management';
  }
}

function scheduleUrgentAlerts() {
  if (urgentJob) urgentJob.stop();
  const cfg = settings.getSettings();
  if (!cfg.urgentAlertsEnabled) return;
  const minutes = Math.min(Math.max(Number(cfg.urgentAlertIntervalMinutes) || 30, 1), 59);
  const expr = `*/${minutes} * * * *`;
  try {
    urgentJob = cron.schedule(expr, async () => {
      try { notify.generateUrgentFollowups(); } catch (_) { /* ignore */ }
    });
  } catch (_) { /* cron expression fallback */ }
}

function scheduleDailyReminders() {
  if (dailyReminderJob) dailyReminderJob.stop();
  const cfg = settings.getSettings();
  if (!cfg.notificationsEnabled) return;
  const [h, m] = String(cfg.dailyReminderTime || '09:00').split(':').map(Number);
  const expr = `${m} ${h} * * *`;
  try {
    dailyReminderJob = cron.schedule(expr, async () => {
      try { notify.generateSystemReminders(); } catch (_) { /* ignore */ }
    });
  } catch (_) { /* cron expression fallback */ }
}

function scheduleBackups() {
  if (backupJob) backupJob.stop();
  const cfg = settings.getSettings();
  if (!cfg.backupEnabled) return;
  const [h, m] = String(cfg.backupTime || '23:00').split(':').map(Number);
  const expr = `${m} ${h} * * *`;
  try {
    backupJob = cron.schedule(expr, async () => {
      try {
        await backup.createBackup({ type: 'daily' });
        notify.createNotification({ type: 'backup', title: { ar: 'نسخة احتياطية', en: 'Backup' }, body: { ar: 'تم إنشاء النسخة اليومية', en: 'Daily backup created' } });
      } catch (_) { /* ignore */ }
    });
  } catch (_) { /* cron expression fallback */ }
}

function setupAutoLock() {
  let timer = null;
  const reset = () => {
    if (timer) clearTimeout(timer);
    const cfg = settings.getSettings();
    if (!cfg.autoLockEnabled || !cfg.requireLogin) return;
    const ms = (cfg.sessionTimeoutMinutes || 15) * 60 * 1000;
    timer = setTimeout(() => {
      if (mainWindow) mainWindow.webContents.send('eg:autoLock');
    }, ms);
  };
  if (mainWindow) {
    mainWindow.on('focus', reset);
    mainWindow.on('blur', reset);
  }
  reset();
}

async function boot() {
  await app.whenReady();
  await initDatabase();
  backup.initialize();
  registerIPC();
  createWindow();
  scheduleBackups();
  scheduleUrgentAlerts();
  scheduleDailyReminders();
  try { notify.generateSystemReminders(); } catch (_) {}
  try { notify.generateUrgentFollowups(); } catch (_) {}
  setupAutoLock();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on('window-all-closed', () => {
  try {
    const cfg = settings.getSettings();
    if (cfg.backupOnExitEnabled !== false) {
      backup.createBackup({ type: 'auto', note: 'Auto-backup on exit' });
    }
  } catch (err) {
    console.error('Auto-backup on exit failed:', err);
  }
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

boot().catch((e) => {
  console.error('Failed to start Egypt Gulf DMS:', e);
});

module.exports = { scheduleBackups, scheduleUrgentAlerts, scheduleDailyReminders };
