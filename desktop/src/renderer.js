const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { height } = ipcRenderer.sendSync('get-screen-metrics');

let isDragging = false;
let isPinned = false; // Track if bubble is pinned
let isClick = false;  // Track if we're handling a click vs. drag
let dragStartTime = 0;

let startPos = { x: 0, y: height - 45 };
let fallAnimationId = null;
let fallSpeed = 0;
const ACCELERATION = 0.5;

const cat = document.getElementById('cat');
const catStates = {
  IDLE: '../assets/ping-idle.png',
  IMPROVE: '../assets/ping-idle-improve.png',
  LIMP: '../assets/ping-raise.png',
  FALL: '../assets/ping-falling.png',
};

// Watch notifications.json for changes
const watcher = chokidar.watch(path.join(__dirname, '../assets/todo.txt'), {
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100
  }
});

watcher.on('change', (path) => {
  console.log(`todo.txt changed at ${new Date().toISOString()}`);
  updateTodo();
});

// Watch CSS files for changes
const cssWatcher = chokidar.watch(path.join(__dirname, 'styles/*.css'), {
  persistent: true
});

cssWatcher.on('change', (path) => {
  // Force reload CSS by removing and re-adding the link element
  const links = document.getElementsByTagName('link');
  for (const link of links) {
    if (link.rel === 'stylesheet') {
      const href = link.href;
      link.remove();
      const newLink = document.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = href + '?v=' + Date.now(); // Add cache-busting query param
      document.head.appendChild(newLink);
    }
  }
});

function updateTodo() {
  try {
    console.log('Reading todo.txt...');
    const todo = fs.readFileSync(path.join(__dirname, '../assets/todo.txt'), 'utf8');
    console.log(`todo.txt content length: ${todo.length}`);
    ipcRenderer.send('update-todo', todo);
  } catch (err) {
    console.error('Error reading todo.txt:', err);
    ipcRenderer.send('update-todo', 'No todo.txt found!');
  }
}

function updateCatDirection() {
  const [x] = ipcRenderer.sendSync('get-position');
  const { width } = ipcRenderer.sendSync('get-screen-metrics');
  const isOnLeft = x < width / 2;
  
  // Determine current state
  let currentState = cat.src.includes('improve') ? 'IMPROVE' : 
                    cat.src.includes('raise') ? 'LIMP' :
                    cat.src.includes('fall') ? 'FALL' : 'IDLE';
  
  // Set base image
  cat.src = catStates[currentState];
  
  // Apply flip class based on position
  if (currentState === 'FALL') {
    // Opposite flip logic just for falling
    if (!isOnLeft) {
      cat.classList.add('flip');
    } else {
      cat.classList.remove('flip');
    }
  } else {
    // Normal flip logic for all other states
    if (isOnLeft) {
      cat.classList.add('flip');
    } else {
      cat.classList.remove('flip');
    }
  }
}

// Show the bubble with todo list
function showBubble() {
  const [winX, winY] = ipcRenderer.sendSync('get-position');
  const { width } = ipcRenderer.sendSync('get-screen-metrics');
  const isOnLeft = winX < width / 2;
  
  updateTodo();
  
  // Calculate better position for the larger bubble
  const bubbleX = isOnLeft ? winX + 60 : winX - 330;
  const bubbleY = Math.max(10, winY - 450);
  
  ipcRenderer.send('show-bubble', bubbleX, bubbleY);
}

// Handle cat click - toggle pinned state
cat.addEventListener('click', (e) => {
  // Only handle clicks, not drags
  if (!isClick) return;
  
  // Toggle pinned state
  isPinned = !isPinned;
  
  if (isPinned) {
    // Show bubble and tell it to stay visible
    showBubble();
    ipcRenderer.send('pin-bubble', isPinned);
    
    // Change cat appearance to show it's pinned
    cat.src = catStates.IMPROVE;
    updateCatDirection();
  } else {
    // Unpin the bubble
    ipcRenderer.send('pin-bubble', isPinned);
    
    // Reset cat appearance
    cat.src = catStates.IDLE;
    updateCatDirection();
    
    // Hide bubble if mouse is not over cat
    if (!cat.matches(':hover')) {
      ipcRenderer.send('hide-bubble');
    }
  }
});

cat.addEventListener('mousedown', (e) => {
  // Reset flags
  isClick = true;
  dragStartTime = Date.now();
  
  // Set up for potential drag
  startPos = {
    x: e.clientX,
    y: e.clientY
  };
});

document.addEventListener('mousemove', (e) => {
  // If we've moved more than a few pixels, it's a drag not a click
  if (isClick && (Math.abs(e.clientX - startPos.x) > 5 || Math.abs(e.clientY - startPos.y) > 5)) {
    isClick = false;
    
    // Only start dragging if we've held down for at least a short time
    // This prevents accidental drags when clicking
    if (Date.now() - dragStartTime > 100) {
      isDragging = true;
      cat.src = catStates.LIMP;
      updateCatDirection();
    }
  }
  
  if (!isDragging) return;
  
  cat.src = catStates.LIMP;
  updateCatDirection();
  
  const { height } = ipcRenderer.sendSync('get-screen-metrics');
  const newY = Math.round(e.screenY - 25);
  
  // If dragged below taskbar, reset to starting position
  if (newY > height - 45) {
    ipcRenderer.send('set-position', Math.round(e.screenX - 25), height - 45);
  } else {
    ipcRenderer.send('set-position', Math.round(e.screenX - 25), newY);
  }
  
  // Update bubble position if pinned
  if (isPinned) {
    const [winX, winY] = ipcRenderer.sendSync('get-position');
    const { width } = ipcRenderer.sendSync('get-screen-metrics');
    const isOnLeft = winX < width / 2;
    
    ipcRenderer.send('update-bubble-position',
      isOnLeft ? winX + 60 : winX - 330,
      Math.max(10, winY - 450)
    );
  }
});

document.addEventListener('mouseup', (e) => {
  // If it was a click, don't trigger the fall animation
  if (isClick) {
    isClick = false;
    return;
  }
  
  if (!isDragging) return;
  isDragging = false;
  
  const { height } = ipcRenderer.sendSync('get-screen-metrics');
  const [winX, winY] = ipcRenderer.sendSync('get-position');
  
  cat.src = catStates.FALL;
  updateCatDirection();
  
  // Start fall animation
  fallSpeed = 0;
  const targetY = height - 45;
  let currentX = Math.round(winX);
  let currentY = Math.round(winY);
  
  function fallAnimation() {
    if (currentY < targetY) {
      fallSpeed += ACCELERATION;
      currentY += Math.round(fallSpeed);
      
      if (currentY >= targetY) {
        currentY = targetY;
        ipcRenderer.send('set-position', Math.round(currentX), Math.round(currentY));
        setTimeout(() => {
          // Use IMPROVE if pinned, otherwise IDLE
          cat.src = isPinned ? catStates.IMPROVE : catStates.IDLE;
          updateCatDirection();
        }, 50);
        fallAnimationId = null;
        
        // Update bubble position if pinned
        if (isPinned) {
          const { width } = ipcRenderer.sendSync('get-screen-metrics');
          const isOnLeft = currentX < width / 2;
          
          ipcRenderer.send('update-bubble-position',
            isOnLeft ? currentX + 60 : currentX - 330,
            Math.max(10, currentY - 450)
          );
        }
      } else {
        ipcRenderer.send('set-position', Math.round(currentX), Math.round(currentY));
        fallAnimationId = requestAnimationFrame(fallAnimation);
        
        // Update bubble position during fall if pinned
        if (isPinned) {
          const { width } = ipcRenderer.sendSync('get-screen-metrics');
          const isOnLeft = currentX < width / 2;
          
          ipcRenderer.send('update-bubble-position',
            isOnLeft ? currentX + 60 : currentX - 330,
            Math.max(10, currentY - 450)
          );
        }
      }
    }
  }
  
  if (fallAnimationId) {
    cancelAnimationFrame(fallAnimationId);
  }
  fallAnimation();
});

cat.addEventListener('mouseenter', () => {
  if (isDragging) return;
  
  // Only change appearance if not already pinned
  if (!isPinned) {
    cat.src = catStates.IMPROVE;
    updateCatDirection();
  }
  
  // Show bubble if not already visible
  showBubble();
  
  // Set a flag to track that we're hovering over the cat
  cat.dataset.hovering = 'true';
});

let isMouseOverBubble = false;

// Listen for bubble mouse events from main process
ipcRenderer.on('bubble-mouse-enter', () => {
  isMouseOverBubble = true;
});

ipcRenderer.on('bubble-mouse-leave', () => {
  isMouseOverBubble = false;
  
  // Hide bubble if not pinned and not hovering over cat
  if (!isPinned && cat.dataset.hovering !== 'true') {
    setTimeout(() => {
      // Double-check we're still not hovering before hiding
      if (!isPinned && !isMouseOverBubble && cat.dataset.hovering !== 'true') {
        ipcRenderer.send('hide-bubble');
      }
    }, 100);
  }
});

// Update the cat mouseleave handler
cat.addEventListener('mouseleave', (e) => {
  // Remove the hovering flag
  cat.dataset.hovering = 'false';
  
  if (!isDragging && !fallAnimationId) {
    // Only change appearance if not pinned
    if (!isPinned) {
      cat.src = catStates.IDLE;
      updateCatDirection();
    }
  }
  
  // Only hide bubble if not pinned and not over bubble
  if (!isPinned && !isMouseOverBubble) {
    // Small delay to prevent flickering
    setTimeout(() => {
      // Double-check we're still not hovering before hiding
      if (!isPinned && !isMouseOverBubble && cat.dataset.hovering !== 'true') {
        ipcRenderer.send('hide-bubble');
      }
    }, 100);
  }
});

document.addEventListener('keydown', (e) => {
  // Ctrl+R or F5 to reload
  if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
    e.preventDefault();
    ipcRenderer.send('reload-app');
  }
  
  // Escape key to unpin bubble
  if (e.key === 'Escape' && isPinned) {
    isPinned = false;
    ipcRenderer.send('pin-bubble', false);
    cat.src = catStates.IDLE;
    updateCatDirection();
    
    // Hide bubble if mouse is not over cat
    if (!cat.matches(':hover')) {
      ipcRenderer.send('hide-bubble');
    }
  }
}); 