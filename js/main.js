import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { Vector2 } from './entities.js'; // ← CRITICAL: Import Vector2
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

    // SELECT PIECE (first click)
    canvas.addEventListener('mousedown', (e) => {
        if (game.winner) return;
        
        const rect = canvas.getBoundingClientRect();
        const clickPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        
        const piece = game.selectPiece(clickPos);
        
        if (piece) {
            selectedPiece = piece;
            canvas.style.cursor = 'grabbing';
            const movesLeft = game.turn === 'HUNTERS' ? ` (${5 - game.huntersMoved.size} moves left)` : '';
            statusDiv.textContent = `${piece.isTiger ? 'TIGER' : 'HUNTER'} selected${movesLeft}. Click within yellow ring to move.`;
        }
    });

    // DRAG PREVIEW (visual feedback)
    canvas.addEventListener('mousemove', (e) => {
        if (!selectedPiece) {
            const rect = canvas.getBoundingClientRect();
            const hoverPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
            const piece = game.selectPiece(hoverPos);
            canvas.style.cursor = piece ? 'pointer' : 'default';
            dragPreview = null;
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        dragPreview = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    });

    // MOVE PIECE (second click)
    canvas.addEventListener('mouseup', (e) => {
        if (!selectedPiece) return;
        
        const rect = canvas.getBoundingClientRect();
        const targetPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        
        game.movePiece(selectedPiece, targetPos);
        
        selectedPiece = null;
        dragPreview = null;
        canvas.style.cursor = 'pointer';
        updateUI();
    });

    resetBtn.addEventListener('click', () => {
        game.reset();
        selectedPiece = null;
        dragPreview = null;
        updateUI();
        statusDiv.textContent = "Game reset! Click the RED TIGER to start.";
    });

    function updateUI() {
        if (game.winner) {
            turnIndicator.textContent = `${game.winner} WINS!`;
            turnIndicator.style.color = '#e74c3c';
            statusDiv.innerHTML = `<span style="color: #27ae60; font-weight: bold;">Victory!</span>`;
        } else {
            turnIndicator.textContent = `${game.turn}'s Turn`;
            turnIndicator.style.color = game.turn === 'TIGER' ? '#e74c3c' : '#27ae60';
            
            if (game.turn === 'HUNTERS') {
                const remaining = 5 - game.huntersMoved.size;
                turnIndicator.textContent += ` (${remaining} moves left)`;
            }
        }
    }

    function gameLoop() {
        renderer.clear();
        renderer.drawZones();
        
        // Draw Roar effect if active
        if (game.roarActive && game.turn === 'TIGER') {
            renderer.drawRoarEffect(game.tiger.pos, game.hunters, game.center);
        }
        
        // Draw range indicator
        if (selectedPiece) {
            renderer.drawRangeIndicator(selectedPiece.pos, Systems.HAND_SPAN);
        }
        
        // Draw game pieces
        renderer.draw(game.getAllPieces(), {
            winner: game.winner,
            winningHunters: game.winningHunters,
            roarActive: game.roarActive,
            selectedPiece: selectedPiece,
            hunters: game.hunters,
            tiger: game.tiger
        });
        
        // Draw drag preview line
        if (selectedPiece && dragPreview) {
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

    // Start game
    updateUI();
    statusDiv.textContent = "Game ready! Click the RED TIGER to begin.";
    gameLoop();
});
