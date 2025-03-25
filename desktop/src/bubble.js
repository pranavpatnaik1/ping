const { ipcRenderer } = require('electron');

const bubble = document.getElementById('bubble');

// Track mouse events on the bubble
bubble.addEventListener('mouseenter', () => {
  // Tell the main process that mouse is over bubble
  ipcRenderer.send('bubble-mouse-enter');
});

bubble.addEventListener('mouseleave', () => {
  // Tell the main process that mouse left bubble
  ipcRenderer.send('bubble-mouse-leave');
});

ipcRenderer.on('update-todo', (event, todo) => {
  // Clear existing content
  bubble.innerHTML = '';
  
  // Split the content by lines
  const lines = todo.trim().split('\n');
  
  // Process each line
  lines.forEach(line => {
    if (!line.trim()) return; // Skip empty lines
    
    const item = document.createElement('div');
    
    // Check if it's an email notification
    if (line.startsWith('📧')) {
      item.className = 'notification-item email-notification';
      // Remove the emoji for cleaner display
      line = line.replace('📧 ', '');
    } else {
      item.className = 'notification-item task-item';
    }
    
    item.textContent = line;
    bubble.appendChild(item);
  });
});

ipcRenderer.on('fade-in', () => {
  bubble.style.opacity = '1';
});

ipcRenderer.on('pin-bubble', (event, isPinned) => {
  if (isPinned) {
    bubble.classList.add('pinned');
  } else {
    bubble.classList.remove('pinned');
  }
}); 