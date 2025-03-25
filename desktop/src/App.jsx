import { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import Cat from './components/Cat';
import Bubble from './components/Bubble';

function App() {
  const [todo, setTodo] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Watch todo.txt for changes
    const watcher = chokidar.watch('../assets/todo.txt', {
      persistent: true
    });

    watcher.on('change', () => {
      updateTodo();
    });

    return () => watcher.close();
  }, []);

  const updateTodo = () => {
    try {
      const todo = fs.readFileSync(path.join(__dirname, '../assets/todo.txt'), 'utf8');
      setTodo(todo);
    } catch (err) {
      setTodo('No todo.txt found!');
    }
  };

  const handleCatHover = (position) => {
    setBubblePosition(position);
    setShowBubble(true);
    updateTodo();
  };

  return (
    <>
      <Cat 
        onHover={handleCatHover}
        onLeave={() => setShowBubble(false)}
      />
      <Bubble 
        text={todo}
        show={showBubble}
        position={bubblePosition}
      />
    </>
  );
}

export default App; 