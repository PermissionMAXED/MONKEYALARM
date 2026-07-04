// Entry point: mounts the UI layer and boots the game engine.

import { UIManager } from './ui/UIManager.js';
import { Game } from './core/Game.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

new UIManager(uiRoot);
new Game(canvas).start();
