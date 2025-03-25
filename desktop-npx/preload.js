const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getTodoContent: () => ipcRenderer.invoke('get-todo-content'),
  getScreenMetrics: () => ipcRenderer.invoke('get-screen-metrics'),
  setWindowPosition: (x, y) => ipcRenderer.invoke('set-window-position', x, y),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  onTodoUpdated: (callback) => {
    ipcRenderer.on('todo-updated', (_, value) => callback(value));
    return () => {
      ipcRenderer.removeAllListeners('todo-updated');
    };
  }
});