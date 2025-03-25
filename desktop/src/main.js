const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const chokidar = require('chokidar');

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
    width: 320,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  bubbleWindow.setIgnoreMouseEvents(false);

  mainWindow.loadFile('src/index.html');
  bubbleWindow.loadFile('src/bubble.html');

  // Pass bubble window ID to main window
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('bubble-window-id', bubbleWindow.id);
  });

  // Hide from taskbar
  mainWindow.setSkipTaskbar(true);
  bubbleWindow.setSkipTaskbar(true);

  // Watch for file changes
  const watcher = chokidar.watch(['src/**/*'], {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('change', (path) => {
    mainWindow.reload();
  });
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
  console.log('Showing bubble at:', x, y);
  bubbleWindow.setPosition(x, y);
  bubbleWindow.show();
  bubbleWindow.webContents.send('fade-in');
});

ipcMain.on('hide-bubble', () => {
  // Only hide if not pinned
  if (!bubbleWindow.isPinned) {
    bubbleWindow.hide();
  }
});

ipcMain.on('update-todo', (event, todo) => {
  bubbleWindow.webContents.send('update-todo', todo);
});

ipcMain.on('reload-app', () => {
  mainWindow.reload();
  bubbleWindow.reload();
});

ipcMain.on('pin-bubble', (event, isPinned) => {
  // If pinned, make the bubble window stay on top
  bubbleWindow.setAlwaysOnTop(true);
  
  // Store the pinned state
  bubbleWindow.isPinned = isPinned;
});

ipcMain.on('update-bubble-position', (event, x, y) => {
  bubbleWindow.setPosition(x, y);
});

ipcMain.on('bubble-mouse-enter', () => {
  // Tell the renderer process that mouse is over bubble
  mainWindow.webContents.send('bubble-mouse-enter');
});

ipcMain.on('bubble-mouse-leave', () => {
  // Tell the renderer process that mouse left bubble
  mainWindow.webContents.send('bubble-mouse-leave');
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