import { Game } from './game.js';
import { Renderer } from './renderer.js';
import * as Systems from './systems.js';

// Initialize after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const turnIndicator = document.getElementById('turn-indicator');
    const statusDiv = document.getElementById('status');
    const resetBtn = document.getElementById('reset-btn');

    if (!canvas) {
        console.error('Game canvas not found!');
        return;
    }

    const game = new Game(canvas);
    const renderer = new Renderer(canvas);

    let selectedPiece = null;
    let dragTarget = null;

    // Mouse event handlers
    canvas.addEventListener('mousedown', (e) => {
        if (game.winner) return;
        
        const rect = canvas.getBoundingClientRect();
        const mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            distanceTo(other) {
                return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
            }
        };
        
        selectedPiece = game.selectPiece(mousePos);
        if (selectedPiece) {
            canvas.style.cursor = 'grabbing';
            statusDiv.textContent = `${selectedPiece.isTiger ? 'Tiger' : 'Hunter'} selected. Click destination within yellow ring.`;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!selectedPiece) return;
        
        const rect = canvas.getBoundingClientRect();
        dragTarget = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!selectedPiece || !dragTarget) return;
        
        const rect = canvas.getBoundingClientRect();
        const targetPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            distanceTo(other) {
                return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
            }
        };
        
        game.movePiece(selectedPiece, targetPos);
        selectedPiece = null;
        dragTarget = null;
        canvas.style.cursor = 'pointer';
        
        updateUI();
    });

    resetBtn.addEventListener('click', () => {
        game.reset();
        selectedPiece = null;
        dragTarget = null;
        updateUI();
        statusDiv.textContent = "Game reset! Click the RED TIGER to start.";
    });

    function updateUI() {
        if (game.winner) {
            turnIndicator.textContent = `${game.winner} WINS!`;
            turnIndicator.style.color = '#e74c3c';
            statusDiv.innerHTML = `<span style="color: #27ae60; font-weight: bold;">${game.winner} claim victory!</span>`;
        } else {
            turnIndicator.textContent = `${game.turn}'s Turn`;
            turnIndicator.style.color = game.turn === 'TIGER' ? '#e74c3c' : '#27ae60';
            
            // Show move count for hunters
            if (game.turn === 'HUNTERS') {
                const remaining = 5 - game.huntersMoved.size;
                turnIndicator.textContent += ` (${remaining} moves left)`;
            }
        }
    }

    function gameLoop() {
        renderer.clear();
        renderer.drawZones();
        
        // Draw ROAR effect if Tiger threatens hunters
        if (game.roarActive && game.turn === 'TIGER') {
            renderer.drawRoarEffect(game.tiger.pos, game.hunters, game.center);
        }
        
        // Draw range indicator for selected piece
        if (selectedPiece) {
            renderer.drawRangeIndicator(selectedPiece.pos, Systems.HAND_SPAN);
        }
        
        // Draw all game pieces with game state
        renderer.draw(game.getAllPieces(), {
            winner: game.winner,
            winningHunters: game.winningHunters,
            roarActive: game.roarActive,
            selectedPiece: selectedPiece,
            hunters: game.hunters,
            tiger: game.tiger
        });
        
        // Draw drag preview line
        if (selectedPiece && dragTarget) {
            renderer.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            renderer.ctx.lineWidth = 2;
            renderer.ctx.setLineDash([5, 5]);
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(selectedPiece.pos.x, selectedPiece.pos.y);
            renderer.ctx.lineTo(dragTarget.x, dragTarget.y);
            renderer.ctx.stroke();
            renderer.ctx.setLineDash([]);
        }
        
        requestAnimationFrame(gameLoop);
    }

    // Start the game
    updateUI();
    statusDiv.textContent = "Game ready! Click the RED TIGER to start.";
    gameLoop();
});
