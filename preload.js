'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  invoke(action, payload) {
    return ipcRenderer.invoke('eg:invoke', { action, payload: payload || {} });
  },
  onAutoLock(callback) {
    ipcRenderer.on('eg:autoLock', () => callback());
  },
  onActivationSuccess(callback) {
    ipcRenderer.on('eg:activationSuccess', () => callback());
  },
  sendActivationSuccess() {
    ipcRenderer.send('eg:activationSuccess');
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('eg', api);
