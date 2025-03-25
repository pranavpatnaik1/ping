const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

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

// Function to read and parse the notifications file
function readNotifications() {
  try {
    const notificationsPath = path.join(__dirname, '../assets/notifications.json');
    console.log('Reading notifications from:', notificationsPath);
    
    if (fs.existsSync(notificationsPath)) {
      const data = fs.readFileSync(notificationsPath, 'utf8');
      console.log('Notifications file content:', data);
      
      try {
        const parsed = JSON.parse(data);
        console.log('Parsed notifications:', parsed);
        return parsed;
      } catch (parseError) {
        console.error('Error parsing notifications JSON:', parseError);
        return [];
      }
    } else {
      console.error('Notifications file does not exist');
      return [];
    }
  } catch (error) {
    console.error('Error reading notifications:', error);
    return [];
  }
}

// Function to update the bubble with notifications
function updateBubble() {
  console.log('Updating bubble...');
  
  // Clear existing content
  bubble.innerHTML = '';
  
  // Get notifications
  const notifications = readNotifications();
  console.log('Got notifications:', notifications);
  
  if (!notifications || notifications.length === 0) {
    console.log('No notifications found, showing fallback message');
    // Add a fallback message if no notifications
    const item = document.createElement('div');
    item.className = 'notification-item system-notification';
    item.textContent = 'No notifications yet';
    bubble.appendChild(item);
    return;
  }
  
  console.log('Processing', notifications.length, 'notifications');
  
  // Process each notification
  notifications.forEach((notification, index) => {
    console.log('Processing notification', index, ':', notification);
    
    const item = document.createElement('div');
    
    if (notification.type === 'email') {
      item.className = 'notification-item email-notification';
      item.textContent = `${notification.sender}: ${notification.subject}`;
    } else if (notification.type === 'system') {
      item.className = 'notification-item system-notification';
      item.textContent = notification.message;
    } else if (notification.type === 'task') {
      item.className = 'notification-item task-item';
      item.textContent = notification.message;
    } else {
      item.className = 'notification-item';
      item.textContent = JSON.stringify(notification);
    }
    
    bubble.appendChild(item);
  });
  
  // Add a small padding at the bottom to ensure the last item is fully visible
  const padding = document.createElement('div');
  padding.style.height = '10px';
  bubble.appendChild(padding);
  
  console.log('Bubble updated with', notifications.length, 'notifications');
}

// Watch for changes to the notifications file
const notificationsPath = path.join(__dirname, '../assets/notifications.json');
console.log('Setting up file watcher for:', notificationsPath);

fs.watch(notificationsPath, (eventType, filename) => {
  console.log('File event detected:', eventType, 'on file:', filename);
  if (eventType === 'change') {
    console.log('File changed, updating bubble');
    updateBubble();
  }
});

// Initial update
console.log('Performing initial bubble update');
updateBubble();

ipcRenderer.on('update-todo', (event, todo) => {
  // This is kept for backward compatibility
  updateBubble();
});

ipcRenderer.on('fade-in', () => {
  // Target the container
  document.querySelector('.bubble-container').style.opacity = '1';
});

ipcRenderer.on('pin-bubble', (event, isPinned) => {
  if (isPinned) {
    document.querySelector('.bubble-container').classList.add('pinned');
  } else {
    document.querySelector('.bubble-container').classList.remove('pinned');
  }
});

// Update the position-bubble handler to position the bubble next to the cat
ipcRenderer.on('position-bubble', (event, catX, catY) => {
  const container = document.querySelector('.bubble-container');
  const { width } = window.screen;
  const isOnLeft = catX < width / 2;
  
  // Position the bubble horizontally based on which side the cat is on
  if (isOnLeft) {
    // Position to the right of the cat
    container.style.left = (catX + 60) + 'px';
    container.style.right = 'auto';
  } else {
    // Position to the left of the cat
    container.style.right = (width - catX + 60) + 'px';
    container.style.left = 'auto';
  }
  
  // Position the BOTTOM of the bubble at the cat's head level
  // The cat is about 50px tall, so position about 15px from the top
  container.style.bottom = 'auto';
  container.style.top = (catY - 15) + 'px';
}); 