const { ipcRenderer } = require('electron');

const bubble = document.getElementById('bubble');

ipcRenderer.on('update-todo', (event, todo) => {
  bubble.textContent = todo;
});

ipcRenderer.on('fade-in', () => {
  bubble.style.opacity = '1';
}); 