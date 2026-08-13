import { useState } from 'react';
import { HomePage } from './pages/HomePage.jsx';
import { RulesPage } from './pages/RulesPage.jsx';
import { GamePage } from './pages/GamePage.jsx';

/**
 * Three screens, no router: home (choose online/offline), the illustrated rules,
 * and the game itself. `key` on GamePage forces a fresh game whenever the player
 * returns to it.
 */
export default function App() {
  const [view, setView] = useState('home');
  const [gameKey, setGameKey] = useState(0);

  const startGame = () => {
    setGameKey((key) => key + 1);
    setView('game');
  };

  if (view === 'home') {
    return <HomePage onPlayOffline={startGame} onOpenRules={() => setView('rules')} />;
  }

  if (view === 'rules') {
    return <RulesPage onBack={() => setView('home')} onPlay={startGame} />;
  }

  return <GamePage key={gameKey} onExit={() => setView('home')} />;
}
