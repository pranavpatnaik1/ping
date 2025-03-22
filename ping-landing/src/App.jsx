import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [position, setPosition] = useState({ x: 40, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const tabRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;

    const tabWidth = tabRef.current?.offsetWidth || 0;
    const windowWidth = window.innerWidth;
    const catPosition = position.x < windowWidth/2 ? windowWidth * 0.6 : windowWidth * 0.05;
    
    let finalX;
    if (position.x < windowWidth/2) {
      // Moving from left side, create barrier at cat's position
      finalX = Math.min(newX, catPosition - tabWidth); // 20px buffer
    } else {
      // Moving from right side, create barrier at cat's position
      finalX = Math.max(newX, catPosition + 200); // 500px is cat width, 20px buffer
    }

    // Keep tab within window bounds
    finalX = Math.max(0, Math.min(finalX, windowWidth - tabWidth));
    const finalY = Math.max(0, Math.min(newY, window.innerHeight - (tabRef.current?.offsetHeight || 0)));
    
    setPosition({
      x: finalX,
      y: finalY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Modify App.jsx to show the cat under the mobile message
  if (isMobile) {
    return (
      <div className="mobile-container">
        <div className="mobile-content">
          <div className="mobile-message">
            <div className="mobile-title">ping.</div>
            <div className='mobile-subtitle'>
              <p>ping is best experienced on desktop.</p>
              <p>please visit us on your PC!</p>
            </div>
          </div>
          <div className="mobile-cat-container">
            <img src="/ping-cat.png" alt="Ping Cat" className="mobile-cat" />
          </div>
        </div>
      </div>
    );
  }

  // Return desktop view if not mobile
  return (
    <div className='main'>
      <div className='background'></div>
      <div 
        ref={tabRef}
        className='tab fade-in'
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 1000
        }}
      >
        <div 
          className='tab-top'
          onMouseDown={handleMouseDown}
        >
          <div className='tab-symbols'>
            <img src="tab-minus-symbol.png" alt="" />
            <img src="tab-square-symbol.png" alt="" />
            <img src="tab-x-symbol.png" alt="" />
          </div>
        </div>
        <div className='tab-content'>
          <div className='title'>ping.</div>
          <div className='subtitle'>
            your <u><span className='all-in-one'>all-in-one</span></u> desktop companion
          </div>
          <div className='start-btn'>stay in the loop.</div>
        </div>
      </div>

      {showContent && (
        <div 
          className='content fade-in-delayed'
          style={{
            position: 'absolute',
            left: position.x < window.innerWidth/2 ? '60%' : '5%',
            transition: 'left 0.3s ease'
          }}
        >
          <img src="/ping-cat.png" alt="" className='ping-cat' />
        </div>
      )}

      <div className='taskbar'></div>
    </div>
  )
}

export default App
