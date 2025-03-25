const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

let mainWindow;
let todoContent = '';

// Watch todo.txt file for changes
function setupTodoWatcher() {
  const todoPath = path.join(__dirname, '../desktop/assets/todo.txt');
  console.log('Watching todo file:', todoPath);
  
  try {
    todoContent = fs.readFileSync(todoPath, 'utf8').trim();
    console.log('Initial todo content:', todoContent);
  } catch (err) {
    console.error('Error reading todo file:', err);
    todoContent = 'No todo.txt found!';
  }
  
  const watcher = chokidar.watch(todoPath, {
    persistent: true
  });
  
  watcher.on('change', path => {
    try {
      todoContent = fs.readFileSync(path, 'utf8').trim();
      if (mainWindow) {
        mainWindow.webContents.send('todo-updated', todoContent);
      }
    } catch (err) {
      console.error('Error reading todo file:', err);
    }
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 50,
    height: 50,
    x: width - 100,
    y: height - 90,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  
  console.log(`Screen size: ${width}x${height}`);
  console.log(`Window position: ${width - 100},${height - 90}`);
  
  mainWindow.loadFile('index.html');
  setupTodoWatcher();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers
ipcMain.handle('get-todo-content', () => todoContent);

ipcMain.handle('get-screen-metrics', () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

// Update the IPC handler to be more robust with type conversion
ipcMain.handle('set-window-position', (event, x, y) => {
  if (mainWindow) {
    try {
      // Ensure x and y are valid numbers
      const safeX = typeof x === 'number' ? Math.round(x) : parseInt(x) || 0;
      const safeY = typeof y === 'number' ? Math.round(y) : parseInt(y) || 0;

      // Lock the window size to 50x50 pixels
      mainWindow.setBounds({
        x: safeX,
        y: safeY,
        width: 50,
        height: 50
      });

      return true;
    } catch (err) {
      console.error('Error setting window position:', err);
      return false;
    }
  }
  return false;
});

// Also ensure getWindowPosition returns an object with x and y properties
ipcMain.handle('get-window-position', () => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    return { x, y };
  }
  return { x: 0, y: 0 };
});