const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Keep a global reference of the window object
let mainWindow;

const isDev = process.env.NODE_ENV === 'development';
const isPackaged = app.isPackaged;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: 'Pets Hospital Management System',
    show: false, // Don't show until ready
  });

  // Load the app
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    // Development mode - load from Vite dev server
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - __dirname inside ASAR = app.asar/electron/
    // so ../dist/index.html resolves correctly inside the archive
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Maximize window
    mainWindow.maximize();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Poll until the server is ready on port 3001
function waitForServer(maxWaitMs = 15000) {
  return new Promise((resolve) => {
    const http = require('http');
    const start = Date.now();
    const check = () => {
      const req = http.get('http://localhost:3001/api/license/status', (res) => {
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start >= maxWaitMs) {
          console.error('[Electron] Server did not start in time');
          resolve(false);
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    check();
  });
}

// Start backend server via dynamic ESM import (in-process, no subprocess needed)
async function startServer() {
  const serverPath = isPackaged
    ? path.join(process.resourcesPath, 'server')
    : path.join(__dirname, '../server');

  const serverFile = path.join(serverPath, 'server.js');
  const serverUrl = pathToFileURL(serverFile).href;

  // Set env vars before the import so dotenv picks them up
  process.env.PORT = '3001';
  process.env.NODE_ENV = 'production';
  process.env.PUPPETEER_SKIP_DOWNLOAD = '1';
  process.env.PUPPETEER_EXECUTABLE_PATH = '';
  // Point dotenv to the server's .env file explicitly
  process.env.DOTENV_CONFIG_PATH = path.join(serverPath, '.env');

  console.log('[Electron] Importing server from:', serverFile);

  try {
    await import(serverUrl);
    console.log('[Electron] Server module loaded OK');
  } catch (err) {
    console.error('[Electron] Server import failed:', err);
    // Show a visible dialog so the error is not silent
    dialog.showErrorBox(
      'Backend Server Error',
      `Server failed to start.\n\nFile: ${serverFile}\n\nError: ${err.message || err}`
    );
  }
}

// App event handlers
app.whenReady().then(async () => {
  // In dev mode the server is already started by concurrently
  if (!isDev) {
    await startServer();          // import runs top-level code (calls app.listen)
    await waitForServer(20000);   // then wait for port 3001 to actually be bound
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

// Print handlers
ipcMain.handle('print-to-pdf', async (event, options) => {
  if (!mainWindow) return { success: false, error: 'No window' };
  
  try {
    const pdfPath = options.path || path.join(app.getPath('temp'), 'print.pdf');
    const data = await mainWindow.webContents.printToPDF({
      marginsType: 1,
      printBackground: true,
      printSelectionOnly: false,
      landscape: options.landscape || false,
    });
    
    require('fs').writeFileSync(pdfPath, data);
    return { success: true, path: pdfPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print', async (event, options) => {
  if (!mainWindow) return { success: false, error: 'No window' };
  
  try {
    await mainWindow.webContents.print({
      silent: options.silent || false,
      printBackground: true,
      deviceName: options.printer || '',
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
