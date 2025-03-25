const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { height } = ipcRenderer.sendSync('get-screen-metrics');

let isDragging = false;

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

// Watch todo.txt for changes
const watcher = chokidar.watch(path.join(__dirname, '../assets/todo.txt'), {
  persistent: true
});

watcher.on('change', () => {
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
    const todo = fs.readFileSync(path.join(__dirname, '../assets/todo.txt'), 'utf8');
    ipcRenderer.send('update-todo', todo);
  } catch (err) {
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

cat.addEventListener('mousedown', (e) => {
  isDragging = true;
  const [winX, winY] = ipcRenderer.sendSync('get-position');
  startPos = {
    x: e.clientX,
    y: e.clientY
  };
  cat.src = catStates.LIMP;
  updateCatDirection();
});

document.addEventListener('mousemove', (e) => {
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
});

document.addEventListener('mouseup', () => {
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
          cat.src = catStates.IDLE;
          updateCatDirection();
        }, 50);
        fallAnimationId = null;
      } else {
        ipcRenderer.send('set-position', Math.round(currentX), Math.round(currentY));
        fallAnimationId = requestAnimationFrame(fallAnimation);
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
  
  cat.src = catStates.IMPROVE;
  updateCatDirection();
  
  const [winX, winY] = ipcRenderer.sendSync('get-position');
  const { width } = ipcRenderer.sendSync('get-screen-metrics');
  const isOnLeft = winX < width / 2;
  
  updateTodo();
  
  ipcRenderer.send('show-bubble',
    isOnLeft ? winX + 50 : winX - 200,
    winY - 60
  );
});

cat.addEventListener('mouseleave', () => {
  if (!isDragging && !fallAnimationId) {
    cat.src = catStates.IDLE;
    updateCatDirection();
  }
  ipcRenderer.send('hide-bubble');
});

document.addEventListener('keydown', (e) => {
  // Ctrl+R or F5 to reload
  if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
    e.preventDefault();
    ipcRenderer.send('reload-app');
  }
}); 