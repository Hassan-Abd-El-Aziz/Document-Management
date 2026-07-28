'use strict';

const { THEME, LANG, ROLES } = require('./constants');

const DEFAULT_SETTINGS = {
  theme: THEME.SYSTEM,
  language: LANG.AR,
  companyName: { ar: 'شركة الخليج مصر', en: 'Egypt Gulf Company' },
  companyAddress: '',
  companyPhone: '',
  companyLogo: '',
  documentFolder: '',
  backupFolder: '',
  sessionTimeoutMinutes: 15,
  autoLockEnabled: true,
  pinLockEnabled: false,
  requireLogin: false,
  backupEnabled: true,
  backupTime: '23:00',
  backupRetentionDays: 30,
  backupOnExitEnabled: true,
  notificationsEnabled: true,
  dailyReminderTime: '09:00',
  dailyReportEnabled: true,
  urgentAlertsEnabled: true,
  urgentAlertIntervalMinutes: 30,
  numberFormat: 'YYYY-DEPT-000000',
  defaultPriority: 'medium',
  rtl: true,
  shelfLocations: ['Shelf A', 'Shelf B', 'Shelf C', 'Shelf D', 'Safe Box'],
};

const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  fullName: { ar: 'مدير النظام', en: 'System Admin' },
  role: ROLES.ADMIN,
  email: 'admin@egyptgulf.local',
  active: true,
};

const STORAGE_DIRS = [
  'realm',
  'storage',
  'storage/Backups',
  'storage/Backups/Daily',
  'storage/Backups/Monthly',
  'storage/Backups/Manual',
  'storage/Exports',
  'storage/Imports',
  'storage/Logs',
  'storage/Temp',
  'storage/departments',
  'storage/Documents',
  'storage/Incoming',
  'storage/Outgoing',
];

module.exports = {
  DEFAULT_SETTINGS,
  DEFAULT_ADMIN,
  STORAGE_DIRS,
};
