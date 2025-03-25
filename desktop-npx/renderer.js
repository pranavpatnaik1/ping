// DOM Elements
const cat = document.getElementById('cat');
const catContainer = document.getElementById('cat-container');
const todoBubble = document.getElementById('todo-bubble');
const todoContent = document.getElementById('todo-content');

// State variables
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let windowPosition = { x: 0, y: 0 };
let catState = 'idle';
let catDirection = 'left';
let screenMetrics = { width: window.innerWidth, height: window.innerHeight };
let targetY = 0;
let fallSpeed = 0;
let fallAcceleration = 0.5;
let fallAnimationId = null;

// Path to asset images (relative to HTML)
const images = {
  'idle-left': '../desktop/assets/ping-idle-left.png',
  'idle-right': '../desktop/assets/ping-idle.png',
  'improve-left': '../desktop/assets/ping-idle-improve-left.png',
  'improve-right': '../desktop/assets/ping-idle-improve.png',
  'limp-left': '../desktop/assets/ping-raise-left.png',
  'limp-right': '../desktop/assets/ping-raise.png',
  'fall-left': '../desktop/assets/ping-falling-left.png',
  'fall-right': '../desktop/assets/ping-falling.png'
};

// Preload all images with proper error handling
const imageCache = {};
function preloadImages() {
  return Promise.all(Object.entries(images).map(([key, src]) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageCache[key] = img;
        console.log(`Loaded image: ${key}`);
        resolve();
      };
      img.onerror = () => {
        console.error(`Failed to load image: ${src}`);
        // Try with fallback path
        img.src = `./assets/${path.basename(src)}`;
        resolve(); // Continue even if image fails
      };
      img.src = src;
    });
  }));
}

// Initialize
async function initialize() {
  console.log('Initializing...');

  try {
    // Preload images first
    await preloadImages();

    // Get screen metrics
    screenMetrics = await window.electronAPI.getScreenMetrics();
    console.log('Screen metrics:', screenMetrics);

    // Set initial position (bottom right)
    targetY = screenMetrics.height - 20; // Taskbar height
    windowPosition = { 
      x: screenMetrics.width - 100, 
      y: targetY 
    };

    // Set window to initial position
    window.electronAPI.setWindowPosition(windowPosition.x, windowPosition.y);

    console.log('Initialization complete');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

// Update cat image based on state and direction
function updateCatImage() {
  const imageKey = `${catState}-${catDirection}`;
  cat.src = images[imageKey];
}

// Start dragging
async function startDrag(e) {
  if (fallAnimationId) {
    cancelAnimationFrame(fallAnimationId);
    fallAnimationId = null;
  }
  
  isDragging = true;
  catState = 'limp';
  updateCatImage();
  
  // Get current window position
  const position = await window.electronAPI.getWindowPosition();
  windowPosition = { x: position.x, y: position.y };
  
  // Calculate the offset between mouse position and window position
  dragOffset = {
    x: e.screenX - windowPosition.x,
    y: e.screenY - windowPosition.y
  };
  
  // Hide todo bubble while dragging
  hideTodoBubble();
}

// Handle dragging
function onDrag(e) {
  if (!isDragging) return;

  // Calculate new position
  const newX = e.screenX - dragOffset.x;
  const newY = e.screenY - dragOffset.y;

  // Move window (position only, size remains constant)
  window.electronAPI.setWindowPosition(newX, newY);

  // Update direction based on position
  const isOnLeft = newX < (screenMetrics.width / 2);
  if ((isOnLeft && catDirection !== 'left') || (!isOnLeft && catDirection !== 'right')) {
    catDirection = isOnLeft ? 'left' : 'right';
    updateCatImage();
  }
}

// Stop dragging and start falling
function stopDrag() {
  if (!isDragging) return;
  
  isDragging = false;
  catState = 'fall';
  updateCatImage();
  
  // Start falling animation
  startFallAnimation();
}

// Falling animation
function startFallAnimation() {
  fallSpeed = 0;

  // Switch to the falling sprite
  const isOnLeft = windowPosition.x < (screenMetrics.width / 2);
  catState = 'fall';
  catDirection = isOnLeft ? 'left' : 'right';
  updateCatImage();

  function animate() {
    // Get the current window position
    window.electronAPI.getWindowPosition().then(position => {
      const currentY = position.y;

      // If the cat is above the targetY, move it down
      if (currentY < targetY) {
        // Apply gravity
        fallSpeed += fallAcceleration;
        const newY = currentY + fallSpeed;

        // Check if we've reached or passed the targetY
        if (newY >= targetY) {
          // Snap to targetY and switch back to idle sprite
          window.electronAPI.setWindowPosition(position.x, targetY);
          windowPosition.y = targetY;

          catState = 'idle';
          updateCatImage();
          fallAnimationId = null;
        } else {
          // Continue falling
          window.electronAPI.setWindowPosition(position.x, newY);
          windowPosition.y = newY;
          fallAnimationId = requestAnimationFrame(animate);
        }
      } else {
        // If already at or below targetY, switch to idle sprite
        catState = 'idle';
        updateCatImage();
        fallAnimationId = null;
      }
    }).catch(err => {
      console.error('Error in fall animation:', err);
      fallAnimationId = null;
    });
  }

  // Start the animation
  fallAnimationId = requestAnimationFrame(animate);
}

// Show todo bubble on hover
function showTodoBubble() {
  if (isDragging || fallAnimationId) return;
  
  catState = 'improve';
  updateCatImage();
  
  // Position bubble based on cat direction
  window.electronAPI.getWindowPosition().then(position => {
    const isOnLeft = position.x < (screenMetrics.width / 2);
    
    if (isOnLeft) {
      todoBubble.style.left = '55px';
    } else {
      todoBubble.style.left = '-210px';
    }
    
    todoBubble.style.top = '-70px';
    todoBubble.style.opacity = '1';
    todoBubble.style.display = 'block';
  });
}

// Hide todo bubble
function hideTodoBubble() {
  if (!fallAnimationId && !isDragging) {
    catState = 'idle';
    updateCatImage();
  }
  
  todoBubble.style.display = 'none';
}

// Event listeners
cat.addEventListener('mousedown', (e) => {
  startDrag(e);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', () => {
    document.removeEventListener('mousemove', onDrag);
    stopDrag();
  }, { once: true });
});

cat.addEventListener('mouseenter', showTodoBubble);
cat.addEventListener('mouseleave', hideTodoBubble);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
console.log('Renderer script loaded');