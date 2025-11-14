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
    constructor(pos, color, isTiger = false) {
        this.pos = pos;
        this.color = color;
        this.isTiger = isTiger;
        this.incapacitated = false;
        this.radius = 15;
    }
    
    draw(ctx) {
        const color = this.incapacitated ? '#333333' : this.color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (this.incapacitated) {
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.pos.x - 10, this.pos.y - 10);
            ctx.lineTo(this.pos.x + 10, this.pos.y + 10);
            ctx.stroke();
        }
    }
}