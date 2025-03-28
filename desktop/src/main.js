const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const chokidar = require('chokidar');
const { spawn } = require('child_process');

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
    height: 400, // Increased height
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

// Function to start the Python email service
function startEmailService() {
  console.log('Starting email service...');
  
  const pythonProcess = spawn('python', ['src/main.py'], {
    stdio: 'inherit',
    shell: true
  });
  
  pythonProcess.on('error', (err) => {
    console.error('Failed to start email service:', err);
  });
  
  pythonProcess.on('close', (code) => {
    console.log(`Email service exited with code ${code}`);
  });
  
  return pythonProcess;
}

// Start the email service when the app starts
let emailServiceProcess;
app.whenReady().then(() => {
  createWindow();
  emailServiceProcess = startEmailService();
});

// Kill the Python process when the app closes
app.on('will-quit', () => {
  if (emailServiceProcess) {
    console.log('Stopping email service...');
    emailServiceProcess.kill();
  }
});

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
  // Position the bubble window
  bubbleWindow.setPosition(x, y);
  
  // Show the bubble window
  bubbleWindow.show();
  
  // Tell the bubble window to fade in
  setTimeout(() => {
    bubbleWindow.webContents.send('fade-in');
  }, 50);
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
  // Tell the bubble window to update its position
  bubbleWindow.webContents.send('position-bubble', x, y);
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