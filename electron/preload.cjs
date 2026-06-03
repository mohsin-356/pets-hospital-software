const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', { 
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Print
  printToPDF: (options) => ipcRenderer.invoke('print-to-pdf', options),
  print: (options) => ipcRenderer.invoke('print', options),
  
  // Platform
  platform: process.platform,
  
  // Check if running in Electron
  isElectron: true,
});

// Expose environment info
contextBridge.exposeInMainWorld('env', {
  NODE_ENV: process.env.NODE_ENV,
  API_URL: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001/api' 
    : 'http://localhost:3001/api',
});
