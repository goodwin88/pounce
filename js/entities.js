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
    
    // Helper for boundary clamping
    normalize() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y);
        if (len === 0) return new Vector2(0, 0);
        return new Vector2(this.x / len, this.y / len);
    }
    
    mult(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }
    
    add(other) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }
    
    sub(other) {
        return new Vector2(this.x - other.x, this.y - other.y);
    }
}

export class Piece {
    constructor(pos, color, isTiger = false) {
        this.pos = pos;
        this.color = color;
        this.isTiger = isTiger;
        this.incapacitated = false;
        this.isRemoved = false;
        // Tiger is now TWICE the diameter: 60px (30px radius)
        // Hunters remain at 30px diameter (15px radius)
        this.radius = isTiger ? 30 : 15;
        this.borderlandsTurns = 0;
        this.hasMoved = false;
        this.isSelected = false;
        this.isVictoryPiece = false;
    }
    
    draw(ctx) {
        // Visual override for removed hunters
        if (this.isRemoved) {
            ctx.globalAlpha = 0.15;
        }
        
        // Tiger gets a glowing aura
        if (this.isTiger && !this.incapacitated) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 25;
        } else {
            ctx.shadowBlur = 0;
        }
        
        const color = this.incapacitated ? '#333333' : this.color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
        
        // Removal mark (faded circle)
        if (this.isRemoved) {
            ctx.strokeStyle = '#95a5a6';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        } 
        // Incapacitated mark (red X)
        else if (this.incapacitated) {
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
