import { useEffect } from 'react';
import '../styles/bubble.css';

const Bubble = ({ text, show, position }) => {
  return (
    <div 
      className={`bubble ${show ? 'visible' : ''}`}
      style={{
        position: 'absolute',
        left: position.x + 50,  // Offset from cat
        top: position.y - 60,   // Above cat
        opacity: show ? 1 : 0
      }}
    >
      {text}
    </div>
  );
};

export default Bubble; 