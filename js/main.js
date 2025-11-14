import { Game } from './game.js';
import { Renderer } from './renderer.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);
const renderer = new Renderer(canvas);
const turnIndicator = document.getElementById('turn-indicator');
const resetBtn = document.getElementById('reset-btn');

let selectedPiece = null;
let dragTarget = null;

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mousePos = new Vector2(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
    
    selectedPiece = game.selectPiece(mousePos);
    if (selectedPiece) {
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!selectedPiece) return;
    
    const rect = canvas.getBoundingClientRect();
    dragTarget = new Vector2(
        e.clientX - rect.left,
        e.clientY - rect.top
    );
});

canvas.addEventListener('mouseup', (e) => {
    if (!selectedPiece || !dragTarget) return;
    
    game.movePiece(selectedPiece, dragTarget);
    selectedPiece = null;
    dragTarget = null;
    canvas.style.cursor = 'pointer';
    
    updateUI();
});

resetBtn.addEventListener('click', () => {
    game.reset();
    updateUI();
});

function updateUI() {
    if (game.winner) {
        turnIndicator.textContent = `${game.winner} WINS!`;
        turnIndicator.style.color = '#e74c3c';
    } else {
        turnIndicator.textContent = `${game.turn}'s Turn`;
        turnIndicator.style.color = game.turn === 'TIGER' ? '#e74c3c' : '#27ae60';
    }
}

function gameLoop() {
    renderer.clear();
    renderer.drawZones();
    
    // Draw Roar effect if active
    if (game.roarActive && game.turn === 'TIGER') {
        renderer.drawRoarEffect(game.tiger.pos, game.hunters, game.center);
    }
    
    // Draw range indicator if piece selected
    if (selectedPiece) {
        renderer.drawRangeIndicator(selectedPiece.pos, Systems.HAND_SPAN);
    }
    
    renderer.draw(game.getAllPieces());
    
    // Draw drag preview
    if (selectedPiece && dragTarget) {
        renderer.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
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

gameLoop();
updateUI();
