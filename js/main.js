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
    const statsDiv = document.getElementById('stats-display');

    if (!canvas) {
        console.error('CRITICAL ERROR: Canvas element not found!');
        return;
    }

    const game = new Game(canvas, turnIndicator, statusDiv);
    const renderer = new Renderer(canvas);

    let selectedPiece = null;
    let dragPreview = null;
    let ghostPreview = null;
    let lastTime = performance.now();
    
    // NEW: Keyboard navigation state
    let keyboardSelectedHunterIndex = -1;

    // NEW: Touch support
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

    // NEW: Keyboard support (Tab to cycle, Arrow keys to move ghost)
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
                const clampedDist = Math.min(dist, Systems.HAND_SPAN);
                const normalized = dist > 0 ? newPos.sub(selectedPiece.pos).mult(1 / dist).mult(clampedDist) : new Vector2(0, 0);
                const targetPos = selectedPiece.pos.add(normalized);
                
                // Clamp to borderlands
                const maxDist = Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH;
                if (targetPos.distanceTo(game.center) > maxDist) {
                    const angle = Math.atan2(targetPos.y - game.center.y, targetPos.x - game.center.x);
                    targetPos.x = game.center.x + Math.cos(angle) * maxDist;
                    targetPos.y = game.center.y + Math.sin(angle) * maxDist;
                }
                
                ghostPreview = { piece: selectedPiece, position: targetPos };
            }
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (game.winner || game.isAnimating()) return;
        
        const rect = canvas.getBoundingClientRect();
        const clickPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        
        const piece = game.selectPiece(clickPos);
        
        if (piece) {
            selectedPiece = piece;
            keyboardSelectedHunterIndex = -1; // Reset keyboard selection
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
        
        dragPreview = hoverPos;
        
        if (!selectedPiece.isTiger) {
            const dir = hoverPos.sub(selectedPiece.pos);
            const dist = dir.distanceTo(new Vector2(0, 0));
            
            const clampedDist = Math.min(dist, Systems.HAND_SPAN);
            const normalized = dist > 0 ? dir.mult(1 / dist).mult(clampedDist) : new Vector2(0, 0);
            const targetPos = selectedPiece.pos.add(normalized);
            
            const maxDist = Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH;
            const distanceFromCenter = targetPos.distanceTo(game.center);
            let finalPos = targetPos;
            if (distanceFromCenter > maxDist) {
                const angle = Math.atan2(targetPos.y - game.center.y, targetPos.x - game.center.x);
                finalPos = new Vector2(
                    game.center.x + Math.cos(angle) * maxDist,
                    game.center.y + Math.sin(angle) * maxDist
                );
            }
            
            ghostPreview = { piece: selectedPiece, position: finalPos };
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!selectedPiece || game.isAnimating()) return;
        
        const rect = canvas.getBoundingClientRect();
        const rawTargetPos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
        
        let targetPos = rawTargetPos;
        if (!selectedPiece.isTiger) {
            const dir = rawTargetPos.sub(selectedPiece.pos);
            const dist = dir.distanceTo(new Vector2(0, 0));
            
            const clampedDist = Math.min(dist, Systems.HAND_SPAN);
            const normalized = dist > 0 ? dir.mult(1 / dist).mult(clampedDist) : new Vector2(0, 0);
            targetPos = selectedPiece.pos.add(normalized);
            
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
        
        game.movePiece(selectedPiece, targetPos);
        
        selectedPiece = null;
        dragPreview = null;
        ghostPreview = null;
        keyboardSelectedHunterIndex = -1;
        canvas.style.cursor = 'pointer';
        game.updateUI();
    });

    resetBtn.addEventListener('click', () => {
        if (game.isAnimating()) return;
        
        game.reset();
        selectedPiece = null;
        dragPreview = null;
        ghostPreview = null;
        keyboardSelectedHunterIndex = -1;
        game.updateUI();
        statusDiv.textContent = "Game reset! Tiger will move first.";
        
        if (game.tigerAIEnabled && game.turn === 'TIGER' && !game.winner) {
            setTimeout(() => {
                console.log("Initial AI trigger from reset");
                game.executeTigerAI();
            }, 500);
        }
    });

    // NEW: Save game
    saveBtn.addEventListener('click', () => {
        const state = game.getState();
        localStorage.setItem('pounceSaveGame', state);
        statusDiv.textContent = "Game saved!";
        setTimeout(() => game.updateUI(), 2000);
    });

    // NEW: Load game
    loadBtn.addEventListener('click', () => {
        const state = localStorage.getItem('pounceSaveGame');
        if (state) {
            if (game.loadState(state)) {
                statusDiv.textContent = "Game loaded!";
                selectedPiece = null;
                dragPreview = null;
                ghostPreview = null;
                keyboardSelectedHunterIndex = -1;
                setTimeout(() => game.updateUI(), 2000);
            } else {
                statusDiv.textContent = "Failed to load game!";
            }
        } else {
            statusDiv.textContent = "No saved game found!";
        }
    });

    function updateStatsDisplay() {
        if (!statsDiv) return;
        
        const s = game.stats;
        const avgChain = s.pounceChains.length > 0 
            ? (s.pounceChains.reduce((a, c) => a + c.huntersPounced, 0) / s.pounceChains.length).toFixed(1)
            : 0;
            
        statsDiv.innerHTML = `
            <strong>Statistics:</strong><br>
            Total Moves: ${s.totalMoves}<br>
            Pounce Chains: ${s.pounceChains.length}<br>
            Avg Chain: ${avgChain}<br>
            Camping Removals: ${s.campingRemovals}<br>
            Triangles Formed: ${s.triangleForms}
        `;
    }

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
            turn: game.turn,
            stats: game.stats
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
        
        updateStatsDisplay();
        requestAnimationFrame(gameLoop);
    }

    // Initial setup
    game.updateUI();
    statusDiv.textContent = "Game ready! Tiger is automated. Control the Hunters. (Tab to cycle, Arrows to move)";
    console.log("Game initialized. AI Enabled:", game.tigerAIEnabled, "Starting turn:", game.turn);
    
    if (game.tigerAIEnabled && game.turn === 'TIGER' && !game.winner) {
        setTimeout(() => {
            console.log("Initial AI trigger");
            game.executeTigerAI();
        }, 500);
    }
    
    gameLoop();
});
