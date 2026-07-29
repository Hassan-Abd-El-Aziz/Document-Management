'use strict';

const { COLLECTIONS } = require('../config/constants');

const DocumentVersionSchema = {
  name: 'DocumentVersion',
  embedded: true,
  properties: {
    version: 'int',
    filePath: 'string?',
    fileName: 'string?',
    size: 'int',
    note: 'string?',
    createdAt: 'date',
    createdBy: 'string?',
  },
};

const LetterHistorySchema = {
  name: 'LetterHistory',
  embedded: true,
  properties: {
    action: 'string',
    status: 'string?',
    by: 'string?',
    at: 'date',
    note: 'string?',
  },
};

const ReceiptSchema = {
  name: 'Receipt',
  embedded: true,
  properties: {
    receiverName: 'string?',
    receivedAt: 'date?',
    signatureImagePath: 'string?',
    note: 'string?',
  },
};

const DepartmentSchema = {
  name: COLLECTIONS.DEPARTMENTS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    code: { type: 'string', indexed: true },
    name: 'string{}',
    manager: 'string?',
    description: 'string?',
    folder: 'string?',
    enabled: { type: 'bool', default: true },
    createdAt: 'date',
    updatedAt: 'date',
    createdBy: 'string?',
  },
};

const ProjectSchema = {
  name: COLLECTIONS.PROJECTS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    name: 'string',
    address: 'string?',
    elevators: { type: 'int', default: 0 },
    models: { type: 'int', default: 0 },
    floors: { type: 'int', default: 0 },
    notes: 'string?',
    manager: 'string?',
    managerPhone: 'string?',
    owner: 'string?',
    consultant: 'string?',
    deleted: { type: 'bool', default: false },
    createdAt: 'date',
    updatedAt: 'date',
    createdBy: 'string?',
  },
};

const DocumentSchema = {
  name: COLLECTIONS.DOCUMENTS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    fileNumber: { type: 'string', indexed: true },
    title: 'string{}',
    projectId: 'string?',
    projectName: 'string?',
    departmentId: 'string?',
    departmentCode: 'string?',
    tags: 'string[]',
    filePath: 'string?',
    fileName: 'string?',
    originalName: 'string?',
    mimeType: 'string?',
    size: { type: 'int', default: 0 },
    category: 'string?',
    status: 'string?',
    priority: 'string?',
    notes: 'string?',
    documentType: { type: 'string', default: 'document' },
    shelfLocation: 'string?',
    favorite: { type: 'bool', default: false },
    currentVersion: { type: 'int', default: 1 },
    versions: 'DocumentVersion[]',
    deleted: { type: 'bool', default: false },
    deletedAt: 'date?',
    createdAt: 'date',
    updatedAt: 'date',
    createdBy: 'string?',
  },
};

const IncomingLetterSchema = {
  name: COLLECTIONS.INCOMING,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    letterNumber: { type: 'string', indexed: true },
    subject: 'string{}',
    fromEntity: 'string?',
    toEntity: 'string?',
    departmentId: 'string?',
    departmentCode: 'string?',
    receivedDate: 'date',
    deliveryStatus: { type: 'string', default: 'pending' },
    priority: { type: 'string', default: 'medium' },
    receivedBy: 'string?',
    attachments: 'string[]',
    filePath: 'string?',
    notes: 'string?',
    tags: 'string[]',
    history: 'LetterHistory[]',
    deleted: { type: 'bool', default: false },
    deletedAt: 'date?',
    createdAt: 'date',
    updatedAt: 'date',
    createdBy: 'string?',
  },
};

const OutgoingLetterSchema = {
  name: COLLECTIONS.OUTGOING,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    letterNumber: { type: 'string', indexed: true },
    subject: 'string{}',
    sentTo: 'string?',
    fromEntity: 'string?',
    departmentId: 'string?',
    departmentCode: 'string?',
    sentDate: 'date',
    deliveryStatus: { type: 'string', default: 'pending' },
    priority: { type: 'string', default: 'medium' },
    deliveredBy: 'string?',
    receiver: 'string?',
    deliveryDate: 'date?',
    receipt: 'Receipt?',
    attachments: 'string[]',
    filePath: 'string?',
    notes: 'string?',
    tags: 'string[]',
    history: 'LetterHistory[]',
    deleted: { type: 'bool', default: false },
    deletedAt: 'date?',
    createdAt: 'date',
    updatedAt: 'date',
    createdBy: 'string?',
  },
};

const UserSchema = {
  name: COLLECTIONS.USERS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    username: { type: 'string', indexed: true },
    password: 'string',
    fullName: 'string{}',
    role: { type: 'string', default: 'viewer' },
    email: 'string?',
    phone: 'string?',
    active: { type: 'bool', default: true },
    createdAt: 'date',
    lastLogin: 'date?',
  },
};

const LogSchema = {
  name: COLLECTIONS.LOGS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    action: 'string',
    entity: 'string',
    entityId: 'string?',
    userId: 'string?',
    userName: 'string?',
    details: 'string?',
    fileName: 'string?',
    timestamp: 'date',
  },
};

const NotificationSchema = {
  name: COLLECTIONS.NOTIFICATIONS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    type: 'string',
    title: 'string{}',
    body: 'string{}',
    relatedId: 'string?',
    read: { type: 'bool', default: false },
    priority: { type: 'string', default: 'medium' },
    createdAt: 'date',
  },
};

const SettingSchema = {
  name: COLLECTIONS.SETTINGS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    key: { type: 'string', indexed: true },
    value: 'mixed',
    updatedAt: 'date',
  },
};

const BackupSchema = {
  name: COLLECTIONS.BACKUPS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    type: 'string',
    path: 'string',
    fileName: 'string',
    size: { type: 'int', default: 0 },
    itemCount: { type: 'int', default: 0 },
    isValid: { type: 'bool', default: true },
    note: 'string?',
    createdAt: 'date',
  },
};

const LendingSchema = {
  name: COLLECTIONS.LENDING,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    itemType: { type: 'string', default: 'document' },
    materialType: { type: 'string', default: 'document' },
    itemReference: 'string?',
    itemName: 'string',
    filePath: 'string?',
    borrowerId: 'string?',
    borrowerName: 'string',
    borrowerDepartment: 'string',
    lenderId: 'string?',
    lenderName: 'string?',
    currentLocation: 'string',
    status: { type: 'string', default: 'in_archive' },
    approvalStatus: { type: 'string', default: 'pending' },
    approvedBy: 'string?',
    approvedById: 'string?',
    requestDate: 'date',
    approvalDate: 'date?',
    lendDate: 'date?',
    receiveTime: 'string?',
    returnDeadline: 'date?',
    returnTime: 'string?',
    returnInspectionStatus: { type: 'string', default: 'none' },
    returnInspectedBy: 'string?',
    returnInspectionNote: 'string?',
    notes: 'string?',
    borrowPurpose: 'string?',
    lendingType: { type: 'string', default: 'borrowed' },
    approvalAttachment: 'string?',
    previousDocumentLocation: 'string?',
    history: 'LendingHistory[]',
    createdBy: 'string?',
    createdAt: 'date',
    updatedAt: 'date',
    deleted: { type: 'bool', default: false },
  },
};

const LendingHistorySchema = {
  name: 'LendingHistory',
  embedded: true,
  properties: {
    action: 'string',
    fromStatus: 'string?',
    toStatus: 'string?',
    fromApproval: 'string?',
    toApproval: 'string?',
    fromLocation: 'string?',
    toLocation: 'string?',
    note: 'string?',
    by: 'string?',
    at: 'date',
  },
};

const ShelfSchema = {
  name: COLLECTIONS.SHELVES,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    name: { type: 'string', indexed: true },
    code: 'string?',
    createdAt: 'date',
  },
};

const CounterSchema = {
  name: COLLECTIONS.COUNTERS,
  primaryKey: '_id',
  properties: {
    _id: 'string',
    deptCode: 'string',
    year: 'int',
    type: 'string',
    value: { type: 'int', default: 0 },
  },
};

const TagSchema = {
  name: COLLECTIONS.TAGS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    name: 'string{}',
    color: { type: 'string', default: '#16a34a' },
    createdAt: 'date',
  },
};

const EmailAttachmentSchema = {
  name: 'EmailAttachment',
  embedded: true,
  properties: {
    fileName: 'string',
    filePath: 'string?',
    size: 'int?',
    mimeType: 'string?',
  },
};

const EmailLogSchema = {
  name: COLLECTIONS.EMAIL_LOGS,
  primaryKey: '_id',
  properties: {
    _id: 'uuid',
    subject: 'string?',
    to: 'string',
    cc: 'string?',
    body: 'string?',
    hasAttachments: { type: 'bool', default: false },
    attachments: 'EmailAttachment[]',
    relatedId: 'string?',
    relatedType: 'string?',
    status: { type: 'string', default: 'sent' },
    priority: { type: 'string', default: 'medium' },
    sentAt: 'date',
    createdBy: 'string?',
    deleted: { type: 'bool', default: false },
    deletedAt: 'date?',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

const schemas = [
  DocumentVersionSchema,
  LetterHistorySchema,
  ReceiptSchema,
  DepartmentSchema,
  DocumentSchema,
  IncomingLetterSchema,
  OutgoingLetterSchema,
  UserSchema,
  LogSchema,
  NotificationSchema,
  SettingSchema,
  BackupSchema,
  CounterSchema,
  TagSchema,
  EmailAttachmentSchema,
  EmailLogSchema,
  ProjectSchema,
  LendingSchema,
  LendingHistorySchema,
  ShelfSchema,
];

module.exports = { schemas };
