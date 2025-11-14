import * as Systems from './systems.js';

export class Renderer {
    // ... existing constructor and methods ...
    
    drawRoarEffect(tigerPos, hunters, center) {
        const threatened = hunters.filter(h => 
            !h.incapacitated && !h.isRemoved && 
            Systems.distance(tigerPos, h.pos) <= Systems.HAND_SPAN &&
            Systems.isInClearing(h.pos, center)
        );
        
        if (!threatened.length) return;
        
        // Pulsing red warning ring
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        this.ctx.strokeStyle = `rgba(231, 76, 60, ${pulse})`;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(tigerPos.x, tigerPos.y, Systems.HAND_SPAN, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Flash threatened hunters
        threatened.forEach(h => {
            this.ctx.strokeStyle = `rgba(231, 76, 60, ${pulse})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(h.pos.x, h.pos.y, h.radius + 5, 0, Math.PI * 2);
            this.ctx.stroke();
        });
    }
}
