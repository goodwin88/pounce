import { isInClearing, isInBorderlands, CLEARING_RADIUS, BORDERLANDS_WIDTH, HAND_SPAN } from './systems.js';

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
        this.ctx.arc(this.center.x, this.center.y, CLEARING_RADIUS, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Borderlands outer boundary
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.center.x, this.center.y, CLEARING_RADIUS + BORDERLANDS_WIDTH, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Labels
        this.ctx.fillStyle = '#f39c12';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Clearing', 10, 30);
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillText('Borderlands', 10, 55);
    }
    
    drawRangeIndicator(pos, range) {
        this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, range, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    draw(pieces) {
        this.clear();
        this.drawZones();
        
        pieces.forEach(p => p.draw(this.ctx));
    }
}