'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  invoke(action, payload) {
    return ipcRenderer.invoke('eg:invoke', { action, payload: payload || {} });
  },
  onAutoLock(callback) {
    ipcRenderer.on('eg:autoLock', () => callback());
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('eg', api);
