const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 50,
    height: 50,
    x: width - 100,
    y: height - 45,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // In development, connect to Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.setSkipTaskbar(true);
}

app.whenReady().then(createWindow);

// Handle IPC events
ipcMain.on('get-position', (event) => {
  const position = mainWindow.getPosition();
  event.returnValue = position;
});

ipcMain.on('set-position', (event, x, y) => {
  mainWindow.setPosition(x, y);
});

ipcMain.on('get-screen-metrics', (event) => {
  const primaryDisplay = screen.getPrimaryDisplay();
  event.returnValue = primaryDisplay.workAreaSize;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 