import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { Vector2 } from './entities.js';
import * as Systems from './systems.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const turnIndicator = document.getElementById('turn-indicator');
    const statusDiv = document.getElementById('status');
    const resetBtn = document.getElementById('reset-btn');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const difficultySelect = document.getElementById('difficulty');
    const tigerRangeSelect = document.getElementById('tigerRange');
    const statsDiv = document.getElementById('stats-display');

    if (!canvas) {
        console.error('CRITICAL ERROR: Canvas element not found!');
        return;
    }

    const game = new Game(
        canvas, 
        turnIndicator, 
        statusDiv, 
        parseInt(difficultySelect.value), 
        parseFloat(tigerRangeSelect.value)
    );
    const renderer = new Renderer(canvas);

    let selectedPiece = null;
    let dragPreview = null;
    let ghostPreview = null;
    let lastTime = performance.now();
    let keyboardSelectedHunterIndex = -1;

    // Randomize on load
    const initialRandDiff = 1 + Math.floor(Math.random() * 5);
    const initialRandRange = [0.5, 0.7, 1.0, 1.3, 1.5][Math.floor(Math.random() * 5)];
    game.difficulty = initialRandDiff;
    game.tigerRangeMultiplier = initialRandRange;
    difficultySelect.value = initialRandDiff;
    tigerRangeSelect.value = initialRandRange;
    statusDiv.textContent = `New Game! Size: ${Systems.DIFFICULTY_LEVELS[initialRandDiff].name}, Range: ${Systems.TIGER_RANGE_MULTIPLIERS[initialRandRange].name}`;

    difficultySelect.addEventListener('change', (e) => {
        if (game.isAnimating()) return;
        const newDifficulty = parseInt(e.target.value);
        game.difficulty = newDifficulty;
        game.reset();
        statusDiv.textContent = `Difficulty set to ${Systems.DIFFICULTY_LEVELS[newDifficulty].name}`;
        game.updateUI();
    });

    tigerRangeSelect.addEventListener('change', (e) => {
        if (game.isAnimating()) return;
        const newRange = parseFloat(e.target.value);
        game.tigerRangeMultiplier = newRange;
        game.reset();
        const rangeInfo = Systems.TIGER_RANGE_MULTIPLIERS[newRange];
        statusDiv.textContent = `Tiger range set to ${rangeInfo.name} (${newRange}×)`;
        game.updateUI();
    });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    });

    document.addEventListener('keydown', (e) => {
        if (game.winner || game.isAnimating()) return;
        
        if (e.key === 'Tab' && game.turn === 'HUNTERS') {
            e.preventDefault();
            const availableHunters = game.hunters.filter(h => 
                !h.incapacitated && !h.isRemoved && !h.hasMoved
            );
            
            if (availableHunters.length === 0) return;
            
            keyboardSelectedHunterIndex = (keyboardSelectedHunterIndex + 1) % availableHunters.length;
            selectedPiece = availableHunters[keyboardSelectedHunterIndex];
            canvas.style.cursor = 'grabbing';
            const movesLeft = ` (${5 - game.huntersMoved.size} moves left)`;
            statusDiv.textContent = `HUNTER ${game.hunters.indexOf(selectedPiece)} selected${movesLeft}. Use arrow keys to move.`;
        }
        
        if (selectedPiece && !selectedPiece.isTiger) {
            const step = 10;
            let dx = 0, dy = 0;
            
            switch(e.key) {
                case 'ArrowUp': dy = -step; break;
                case 'ArrowDown': dy = step; break;
                case 'ArrowLeft': dx = -step; break;
                case 'ArrowRight': dx = step; break;
                case 'Enter': 
                    if (ghostPreview) {
                        game.movePiece(selectedPiece, ghostPreview.position);
                        selectedPiece = null;
                        ghostPreview = null;
                        keyboardSelectedHunterIndex = -1;
                    }
                    return;
            }
            
            if (dx !== 0 || dy !== 0) {
                e.preventDefault();
                const newPos = selectedPiece.pos.add(new Vector2(dx, dy));
                const dist = selectedPiece.pos.distanceTo(newPos);
                const moveRange = selectedPiece.getMoveRange();
                const clampedDist = Math.min(dist,
