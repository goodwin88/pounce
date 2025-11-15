import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { Vector2 } from './entities.js';
import * as Systems from './systems.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const turnIndicator = document.getElementById('turn-indicator');
    const statusDiv = document.getElementById('status');
    const resetBtn = document.getElementById('reset-btn');

    if (!canvas) {
        console.error('CRITICAL ERROR: Canvas element not found!');
        return;
    }

    const game = new Game(canvas);
    const renderer = new Renderer(canvas);

    let selectedPiece = null;
    let dragPreview = null;
    let lastTime = performance.now();

    canvas.addEventListener('mousedown', (e) => {
        if (game.winner || game.isAnimating()) return;
        
        const rect = canvas.getBoundingClientRect();
        const clickPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        
        const piece = game.selectPiece(clickPos);
        
        if (piece) {
            selectedPiece = piece;
            canvas.style.cursor = 'grabbing';
            const movesLeft = game.turn === 'HUNTERS' ? ` (${5 - game.huntersMoved.size} moves left)` : '';
            statusDiv.textContent = `${piece.isTiger ? 'TIGER' : 'HUNTER'} selected${movesLeft}. Click within yellow ring.`;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!selectedPiece) {
            const rect = canvas.getBoundingClientRect();
            const hoverPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
            const piece = game.selectPiece(hoverPos);
            canvas.style.cursor = piece && !game.isAnimating() ? 'pointer' : 'default';
            dragPreview = null;
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        dragPreview = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!selectedPiece || game.isAnimating()) return;
        
        const rect = canvas.getBoundingClientRect();
        const targetPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        
        game.movePiece(selectedPiece, targetPos);
        
        selectedPiece = null;
        dragPreview = null;
        canvas.style.cursor = 'pointer';
        game.updateUI();
    });

    resetBtn.addEventListener('click', () => {
        if (game.isAnimating()) return;
        
        game.reset();
        selectedPiece = null;
        dragPreview = null;
        game.updateUI();
        statusDiv.textContent = "Game reset! Click the RED TIGER to start.";
    });

    function gameLoop() {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        const isAnimating = game.update(currentTime);
        if (isAnimating) {
            game.updateUI();
        }

        renderer.clear();
        renderer.drawZones();
        
        if (game.roarActive && game.turn === 'TIGER') {
            renderer.drawRoarEffect(game.tiger.pos, game.hunters, game.center);
        }
        
        if (selectedPiece && !game.isAnimating()) {
            renderer.drawRangeIndicator(selectedPiece.pos, Systems.HAND_SPAN);
        }
        
        renderer.draw(game.getAllPieces(), {
            winner: game.winner,
            winningHunters: game.winningHunters,
            roarActive: game.roarActive,
            selectedPiece: selectedPiece,
            hunters: game.hunters,
            tiger: game.tiger,
            turn: game.turn
        });
        
        if (selectedPiece && dragPreview && !game.isAnimating()) {
            renderer.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            renderer.ctx.lineWidth = 2;
            renderer.ctx.setLineDash([5, 5]);
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(selectedPiece.pos.x, selectedPiece.pos.y);
            renderer.ctx.lineTo(dragPreview.x, dragPreview.y);
            renderer.ctx.stroke();
            renderer.ctx.setLineDash([]);
        }
        
        requestAnimationFrame(gameLoop);
    }

    // Initial UI setup
    game.updateUI();
    statusDiv.textContent = "Game ready! Tiger is automated. Control the Hunters.";
    gameLoop();
});
