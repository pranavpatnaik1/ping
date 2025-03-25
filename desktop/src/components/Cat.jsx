import { useState, useEffect, useRef } from 'react';
import { ipcRenderer } from 'electron';
import '../styles/cat.css';

const ACCELERATION = 0.5;

const Cat = ({ onHover, onLeave }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [sprite, setSprite] = useState('idle');
  const [isFlipped, setIsFlipped] = useState(false);
  const catRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const fallAnimation = useRef(null);
  const [fallData, setFallData] = useState({ speed: 0, currentY: 0 });

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setSprite('raise');
    const [winX, winY] = ipcRenderer.sendSync('get-position');
    startPos.current = {
      x: e.clientX,
      y: e.clientY
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const { height } = ipcRenderer.sendSync('get-screen-metrics');
    const newY = Math.round(e.screenY - 25);

    if (newY > height - 45) {
      ipcRenderer.send('set-position', Math.round(e.screenX - 25), height - 45);
    } else {
      ipcRenderer.send('set-position', Math.round(e.screenX - 25), newY);
    }
    updateDirection();
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    startFalling();
  };

  const startFalling = () => {
    setSprite('falling');
    const [winX, winY] = ipcRenderer.sendSync('get-position');
    const { height } = ipcRenderer.sendSync('get-screen-metrics');
    const targetY = height - 45;

    setFallData({
      speed: 0,
      currentY: winY
    });

    const animate = () => {
      setFallData(prev => {
        const newSpeed = prev.speed + ACCELERATION;
        const newY = prev.currentY + Math.round(newSpeed);

        if (newY >= targetY) {
          ipcRenderer.send('set-position', winX, targetY);
          setTimeout(() => {
            setSprite('idle');
            updateDirection();
          }, 50);
          return prev; // Don't update state, we're done
        }

        ipcRenderer.send('set-position', winX, newY);
        fallAnimation.current = requestAnimationFrame(animate);
        return { speed: newSpeed, currentY: newY };
      });
    };

    if (fallAnimation.current) {
      cancelAnimationFrame(fallAnimation.current);
    }
    fallAnimation.current = requestAnimationFrame(animate);
  };

  const updateDirection = () => {
    const [x] = ipcRenderer.sendSync('get-position');
    const { width } = ipcRenderer.sendSync('get-screen-metrics');
    setIsFlipped(x < width / 2);
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (fallAnimation.current) {
        cancelAnimationFrame(fallAnimation.current);
      }
    };
  }, []);

  return (
    <img 
      ref={catRef}
      className={`cat ${isFlipped ? 'flip' : ''}`}
      src={`../assets/ping-${sprite}.png`}
      draggable={false}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => {
        if (!isDragging) {
          setSprite('improve');
          const [winX, winY] = ipcRenderer.sendSync('get-position');
          onHover({ x: winX, y: winY });
        }
      }}
      onMouseLeave={() => {
        if (!isDragging && !fallAnimation.current) {
          setSprite('idle');
          onLeave();
        }
      }}
    />
  );
};

export default Cat; 