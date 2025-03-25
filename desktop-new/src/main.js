const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow, bubbleWindow;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Create the main window
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

  // Create the bubble window
  bubbleWindow = new BrowserWindow({
    width: 200,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('src/index.html');
  bubbleWindow.loadFile('src/bubble.html');

  // Pass bubble window ID to main window
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('bubble-window-id', bubbleWindow.id);
  });

  // Hide from taskbar
  mainWindow.setSkipTaskbar(true);
  bubbleWindow.setSkipTaskbar(true);
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

ipcMain.on('show-bubble', (event, x, y) => {
  bubbleWindow.setPosition(x, y);
  bubbleWindow.show();
  bubbleWindow.webContents.send('fade-in');
});

ipcMain.on('hide-bubble', () => {
  bubbleWindow.hide();
});

ipcMain.on('update-todo', (event, todo) => {
  bubbleWindow.webContents.send('update-todo', todo);
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