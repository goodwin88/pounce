import { Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
    }
    
    clear() {
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawZones() {
        // Clearing
        this.ctx.strokeStyle = '#f39c12';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(this.center.x, this.center.y, Systems.CLEARING_RADIUS, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Borderlands boundary
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.center.x, this.center.y, 
                     Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Zone labels
        this.ctx.fillStyle = '#f39c12';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText('Clearing', 10, 30);
        
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillText('Borderlands', 10, 55);
    }
    
    drawRangeIndicator(pos, range) {
        // Draw the movement range ring
        this.ctx.strokeStyle = 'rgba(241, 196, 15, 0.6)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, range, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Range label
        this.ctx.fillStyle = '#f39c12';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`Move: ${range}px`, 10, 80);
    }
    
    drawPounceRange(tigerPos, hunters, center) {
        // Visual pounce range (red dashed circle)
        this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([2, 4]);
        this.ctx.beginPath();
        this.ctx.arc(tigerPos.x, tigerPos.y, Systems.HAND_SPAN, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Label
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('Pounce: 150px', 10, 100);
    }
    
    drawRoarEffect(tigerPos, hunters, center) {
        const threatened = hunters.filter(h => 
            !h.incapacitated && !h.isRemoved && 
            Systems.distance(tigerPos, h.pos) <= Systems.HAND_SPAN &&
            Systems.isInClearing(h.pos, center)
        );
        
        if (!threatened.length) return;
        
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        this.ctx.strokeStyle = `rgba(231, 76, 60, ${pulse})`;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(tigerPos.x, tigerPos.y, Systems.HAND_SPAN, 0, Math.PI * 2);
        this.ctx.stroke();
        
        threatened.forEach(h => {
            this.ctx.strokeStyle = `rgba(231, 76, 60, ${pulse})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(h.pos.x, h.pos.y, h.radius + 5, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        this.ctx.fillStyle = `rgba(231, 76, 60, ${pulse})`;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ROAR!', tigerPos.x, tigerPos.y - 40);
        this.ctx.textAlign = 'left';
    }
    
    drawVictoryTriangle(hunters) {
        if (!hunters || hunters.length !== 3) return;
        
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.5;
        this.ctx.fillStyle = `rgba(46, 204, 113, ${pulse})`;
        this.ctx.beginPath();
        this.ctx.moveTo(hunters[0].pos.x, hunters[0].pos.y);
        hunters.forEach(h => this.ctx.lineTo(h.pos.x, h.pos.y));
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.strokeStyle = `rgba(39, 174, 96, ${pulse + 0.3})`;
        this.ctx.lineWidth = 4;
        this.ctx.stroke();
    }
    
    // NEW: Draw ghost preview
    drawGhostPreview(piece, ghostPos) {
        if (!piece || !ghostPos) return;
        
        this.ctx.save();
        this.ctx.globalAlpha = 0.35; // Ghostly transparency
        
        // Draw the ghost piece
        this.ctx.fillStyle = piece.color;
        this.ctx.beginPath();
        this.ctx.arc(ghostPos.x, ghostPos.y, piece.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw dashed white outline
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath();
        this.ctx.arc(ghostPos.x, ghostPos.y, piece.radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Add "preview" label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('preview', ghostPos.x, ghostPos.y - piece.radius - 10);
        this.ctx.textAlign = 'left';
        
        this.ctx.restore();
    }
    
    draw(pieces, gameState = {}) {
        this.clear();
        this.drawZones();
        
        // Draw pounce range during Tiger turn
        if ((gameState.selectedPiece?.isTiger || gameState.roarActive || gameState.turn === 'TIGER')) {
            this.drawPounceRange(gameState.tiger.pos, gameState.hunters, this.center);
        }
        
        if (gameState.winner === 'HUNTERS' && gameState.winningHunters) {
            this.drawVictoryTriangle(gameState.winningHunters);
        }
        
        if (gameState.roarActive && gameState.turn === 'TIGER') {
            this.drawRoarEffect(gameState.tiger.pos, gameState.hunters, this.center);
        }
        
        if (gameState.selectedPiece) {
            this.drawRangeIndicator(gameState.selectedPiece.pos, Systems.HAND_SPAN);
        }
        
        // Draw ghost preview BEFORE regular pieces
        if (gameState.ghostPreview && !gameState.isAnimating) {
            this.drawGhostPreview(gameState.ghostPreview.piece, gameState.ghostPreview.position);
        }
        
        pieces.forEach(p => p.draw(this.ctx));
    }
}
