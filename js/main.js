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

    const game = new Game(canvas, turnIndicator, statusDiv);
    const renderer = new Renderer(canvas);

    let selectedPiece = null;
    let dragPreview = null;
    let ghostPreview = null; // NEW: Ghost preview state
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
        const rect = canvas.getBoundingClientRect();
        const hoverPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        
        if (!selectedPiece) {
            const piece = game.selectPiece(hoverPos);
            canvas.style.cursor = piece && !game.isAnimating() ? 'pointer' : 'default';
            dragPreview = null;
            ghostPreview = null;
            return;
        }
        
        // Calculate ghost preview position
        dragPreview = hoverPos;
        
        // Only calculate ghost for Hunters (Tiger is AI-controlled)
        if (!selectedPiece.isTiger) {
            const dir = hoverPos.sub(selectedPiece.pos);
            const dist = dir.distanceTo(new Vector2(0, 0));
            let targetPos = selectedPiece.pos.clone();
            
            if (dist > 0) {
                // Clamp to HAND_SPAN distance
                const clampedDist = Math.min(dist, Systems.HAND_SPAN);
                const normalized = dir.mult(1 / dist).mult(clampedDist);
                targetPos = selectedPiece.pos.add(normalized);
                
                // Clamp to borderlands boundary
                const maxDist = Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH;
                const distanceFromCenter = targetPos.distanceTo(game.center);
                if (distanceFromCenter > maxDist) {
                    const angle = Math.atan2(targetPos.y - game.center.y, targetPos.x - game.center.x);
                    targetPos = new Vector2(
                        game.center.x + Math.cos(angle) * maxDist,
                        game.center.y + Math.sin(angle) * maxDist
                    );
                }
            }
            
            ghostPreview = { piece: selectedPiece, position: targetPos };
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!selectedPiece || game.isAnimating()) return;
        
        const rect = canvas.getBoundingClientRect();
        const targetPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        
        game.movePiece(selectedPiece, targetPos);
        
        selectedPiece = null;
        dragPreview = null;
        ghostPreview = null; // Clear ghost on release
        canvas.style.cursor = 'pointer';
        game.updateUI();
    });

    resetBtn.addEventListener('click', () => {
        if (game.isAnimating()) return;
        
        game.reset();
        selectedPiece = null;
        dragPreview = null;
        ghostPreview = null;
        game.updateUI();
        statusDiv.textContent = "Game reset! Tiger will move first.";
        
        if (game.tigerAIEnabled && game.turn === 'TIGER' && !game.winner) {
            setTimeout(() => {
                console.log("Initial AI trigger from reset");
                game.executeTigerAI();
            }, 500);
        }
    });

    function gameLoop() {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        const isAnimating = game.update(currentTime);
        if (isAnimating || game.aiThinking) {
            game.updateUI();
        }

        renderer.clear();
        renderer.drawZones();
        
        if (game.roarActive && game.turn === 'TIGER') {
            renderer.drawRoarEffect(game.tiger.pos, game.hunters, game.center);
        }
        
        // Draw ghost preview (before range indicator and pieces)
        if (ghostPreview && !game.isAnimating()) {
            renderer.drawGhostPreview(ghostPreview.piece, ghostPreview.position);
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

    // Initial setup
    game.updateUI();
    statusDiv.textContent = "Game ready! Tiger is automated. Control the Hunters.";
    console.log("Game initialized. AI Enabled:", game.tigerAIEnabled, "Starting turn:", game.turn);
    
    if (game.tigerAIEnabled && game.turn === 'TIGER' && !game.winner) {
        setTimeout(() => {
            console.log("Initial AI trigger");
            game.executeTigerAI();
        }, 500);
    }
    
    gameLoop();
});
