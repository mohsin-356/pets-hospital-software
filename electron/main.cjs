const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Keep a global reference of the window object
let mainWindow;
let serverProcess;

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
    // Production mode - load built files
    const indexPath = isPackaged
      ? path.join(process.resourcesPath, 'app/dist/index.html')
      : path.join(__dirname, '../dist/index.html');
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

// Start the backend server
function startServer() {
  if (isPackaged) {
    // In packaged app, server is in resources/server
    const serverPath = path.join(process.resourcesPath, 'server');
    const serverFile = path.join(serverPath, 'server.js');
    
    serverProcess = spawn('node', [serverFile], {
      cwd: serverPath,
      env: { ...process.env, PORT: '3001', NODE_ENV: 'production' },
      stdio: 'pipe',
    });
  } else {
    // In development, server is in ./server
    const serverPath = path.join(__dirname, '../server');
    const serverFile = path.join(serverPath, 'server.js');
    
    serverProcess = spawn('node', [serverFile], {
      cwd: serverPath,
      env: { ...process.env, PORT: '3001', NODE_ENV: 'development' },
      stdio: 'pipe',
    });
  }

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server]: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

// App event handlers
app.whenReady().then(() => {
  startServer();
  
  // Wait a bit for server to start
  setTimeout(() => {
    createWindow();
  }, 2000);
});

app.on('window-all-closed', () => {
  // Kill server process
  if (serverProcess) {
    serverProcess.kill();
  }
  
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
