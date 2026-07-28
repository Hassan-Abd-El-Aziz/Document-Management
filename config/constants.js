'use strict';

const path = require('path');
const { app } = require('electron');

const IS_PACKAGED = app && app.isPackaged;

const USER_DATA = app ? app.getPath('userData') : path.join(__dirname, 'userData');

const ROOT = {
  data: USER_DATA,
  realm: path.join(USER_DATA, 'realm'),
  storage: path.join(USER_DATA, 'storage'),
  backups: path.join(USER_DATA, 'storage', 'Backups'),
  exports: path.join(USER_DATA, 'storage', 'Exports'),
  imports: path.join(USER_DATA, 'storage', 'Imports'),
  logs: path.join(USER_DATA, 'storage', 'Logs'),
  temp: path.join(USER_DATA, 'storage', 'Temp'),
  departments: path.join(USER_DATA, 'storage', 'departments'),
  documents: path.join(USER_DATA, 'storage', 'Documents'),
  incoming: path.join(USER_DATA, 'storage', 'Incoming'),
  outgoing: path.join(USER_DATA, 'storage', 'Outgoing'),
};

const COLLECTIONS = {
  DEPARTMENTS: 'Department',
  DOCUMENTS: 'Document',
  INCOMING: 'IncomingLetter',
  OUTGOING: 'OutgoingLetter',
  USERS: 'User',
  LOGS: 'Log',
  NOTIFICATIONS: 'Notification',
  SETTINGS: 'Setting',
  BACKUPS: 'Backup',
  COUNTERS: 'Counter',
  TAGS: 'Tag',
  EMAIL_LOGS: 'EmailLog',
  PROJECTS: 'Project',
  LENDING: 'Lending',
  SHELVES: 'Shelf',
};

const ROLES = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
  VIEWER: 'viewer',
};

const ROLE_LABELS = {
  admin: { ar: 'مدير', en: 'Admin' },
  employee: { ar: 'موظف', en: 'Employee' },
  viewer: { ar: 'قارئ', en: 'Viewer' },
};

const PERMISSIONS = {
  admin: ['*'],
  employee: [
    'departments:read',
    'documents:*',
    'incoming:*',
    'outgoing:*',
    'archive:read',
    'notifications:*',
    'reports:read',
    'reports:export',
    'search:*',
    'recycle:read',
    'recycle:restore',
    'backup:write',
    'backup:read',
    'lending:read',
    'lending:write',
    'lending:approve',
  ],
  viewer: [
    'departments:read',
    'documents:read',
    'incoming:read',
    'outgoing:read',
    'archive:read',
    'notifications:read',
    'reports:read',
    'search:*',
    'recycle:read',
    'lending:read',
  ],
};

const LETTER_STATUS = {
  PENDING: 'pending',
  RECEIVED: 'received',
  DELIVERED: 'delivered',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const LETTER_STATUS_LABELS = {
  pending: { ar: 'قيد الانتظار', en: 'Pending' },
  received: { ar: 'مستلم', en: 'Received' },
  delivered: { ar: 'تم التسليم', en: 'Delivered' },
  rejected: { ar: 'مرفوض', en: 'Rejected' },
  cancelled: { ar: 'ملغى', en: 'Cancelled' },
};

const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

const PRIORITY_LABELS = {
  low: { ar: 'منخفض', en: 'Low' },
  medium: { ar: 'متوسط', en: 'Medium' },
  high: { ar: 'عالي', en: 'High' },
  urgent: { ar: 'عاجل', en: 'Urgent' },
};

const BACKUP_TYPES = {
  DAILY: 'daily',
  MONTHLY: 'monthly',
  MANUAL: 'manual',
};

const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

const LANG = {
  AR: 'ar',
  EN: 'en',
};

const DELIVERY_STATUS = LETTER_STATUS;

const LENDING_STATUS = {
  IN_ARCHIVE: 'in_archive',
  RESERVED: 'reserved',
  BORROWED: 'borrowed',
  OVERDUE: 'overdue',
  UNDER_REVIEW: 'under_review',
  MISSING: 'missing',
  PENDING_DISPOSAL: 'pending_disposal',
  ARCHIVED: 'archived',
};

const LENDING_STATUS_LABELS = {
  in_archive: { ar: 'داخل الأرشيف', en: 'In Archive' },
  reserved: { ar: 'محجوز', en: 'Reserved' },
  borrowed: { ar: 'معار', en: 'Borrowed' },
  overdue: { ar: 'متأخر', en: 'Overdue' },
  under_review: { ar: 'تحت المراجعة', en: 'Under Review' },
  missing: { ar: 'فقود', en: 'Missing' },
  pending_disposal: { ar: 'قيد الإعدام', en: 'Pending Disposal' },
  archived: { ar: 'مؤرشف نهائيًا', en: 'Archived' },
};

const LENDING_APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const LENDING_TYPES = {
  FILE: 'file',
  CONTRACT: 'contract',
};

module.exports = {
  IS_PACKAGED,
  USER_DATA,
  ROOT,
  COLLECTIONS,
  ROLES,
  ROLE_LABELS,
  PERMISSIONS,
  LETTER_STATUS,
  LETTER_STATUS_LABELS,
  PRIORITY,
  PRIORITY_LABELS,
  BACKUP_TYPES,
  THEME,
  LANG,
  DELIVERY_STATUS,
  LENDING_STATUS,
  LENDING_STATUS_LABELS,
  LENDING_APPROVAL_STATUS,
  LENDING_TYPES,
};
