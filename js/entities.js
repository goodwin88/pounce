export class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    
    distanceTo(other) {
        return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
    }
    
    clone() {
        return new Vector2(this.x, this.y);
    }
}

export class Piece {
    // ... existing constructor ...
    constructor(pos, color, isTiger = false) {
        this.pos = pos;
        this.color = color;
        this.isTiger = isTiger;
        this.incapacitated = false;
        this.isRemoved = false; // NEW: Permanently removed by camping
        this.radius = 15;
        this.borderlandsTurns = 0;
    }
    
    draw(ctx) {
        // NEW: Draw removed hunters as faded out
        if (this.isRemoved) {
            ctx.globalAlpha = 0.15;
        }
        
        const color = this.incapacitated ? '#333333' : this.color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (this.isRemoved) {
            // Draw removal mark (different from incapacitated)
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#95a5a6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        } else if (this.incapacitated) {
            // Draw X for incapacitated
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.pos.x - 10, this.pos.y - 10);
            ctx.lineTo(this.pos.x + 10, this.pos.y + 10);
            ctx.moveTo(this.pos.x - 10, this.pos.y + 10);
            ctx.lineTo(this.pos.x + 10, this.pos.y - 10);
            ctx.stroke();
        }
    }
}
