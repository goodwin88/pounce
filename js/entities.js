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
    
    lerp(other, t) {
        return new Vector2(
            this.x + (other.x - this.x) * t,
            this.y + (other.y - this.y) * t
        );
    }
}

export class Piece {
    constructor(pos, color, isTiger = false, stats = {}) {
        this.pos = pos;
        this.originalPos = pos.clone();
        this.color = color;
        this.isTiger = isTiger;
        this.incapacitated = false;
        this.isRemoved = false;
        
        this.radius = isTiger ? 30 : (stats.diameter ? stats.diameter / 2 : 15);
        this.borderlandsTolerance = stats.borderlandsTolerance !== undefined ? stats.borderlandsTolerance : 3;
        this.canMoveAfterRescue = stats.canMoveAfterRescue || false;
        this.canMoveAfterBeingRescued = stats.canMoveAfterBeingRescued || false;
        this.hunterType = stats.hunterType || 'standard';
        
        this.borderlandsTurns = 0;
        this.hasMoved = false;
        this.isSelected = false;
        this.isVictoryPiece = false;
        this.moveOrder = null;
        
        this.isAnimating = false;
        this.animationStart = null;
        this.animationEnd = null;
        this.animationStartPos = null;
        this.animationEndPos = null;
        this.animationDuration = 300;
    }
    
    startAnimation(targetPos) {
        this.isAnimating = true;
        this.animationStart = performance.now();
        this.animationEnd = this.animationStart + this.animationDuration;
        this.animationStartPos = this.pos.clone();
        this.animationEndPos = targetPos.clone();
    }
    
    updateAnimation(currentTime) {
        if (!this.isAnimating) return false;
        
        if (currentTime >= this.animationEnd) {
            this.pos = this.animationEndPos.clone();
            this.isAnimating = false;
            return true;
        }
        
        const progress = (currentTime - this.animationStart) / this.animationDuration;
        this.pos = this.animationStartPos.lerp(this.animationEndPos, progress);
        return false;
    }
    
    getDrawPosition() {
        return this.pos;
    }
    
    draw(ctx) {
        const drawPos = this.getDrawPosition();
        
        if (this.isRemoved) {
            ctx.globalAlpha = 0.15;
        }
        
        if (this.isTiger && !this.incapacitated) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 25;
        } else {
            ctx.shadowBlur = 0;
        }
        
        if (this.isVictoryPiece) {
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(drawPos.x, drawPos.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        if (this.isSelected) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(drawPos.x, drawPos.y, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        const color = this.incapacitated ? '#333333' : this.color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(drawPos.x, drawPos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
        
        if (this.isRemoved) {
            ctx.strokeStyle = '#95a5a6';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(drawPos.x, drawPos.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        } else if (this.incapacitated) {
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(drawPos.x - 10, drawPos.y - 10);
            ctx.lineTo(drawPos.x + 10, drawPos.y + 10);
            ctx.moveTo(drawPos.x - 10, drawPos.y + 10);
            ctx.lineTo(drawPos.x + 10, drawPos.y - 10);
            ctx.stroke();
        }
        
        // NEW: Draw centered, bold hunter type letters (only for exceptional types)
        if (!this.isTiger && !this.incapacitated && !this.isRemoved && this.hunterType !== 'standard') {
            const letter = this.hunterType === 'scout' ? 'S' : 
                          this.hunterType === 'veteran' ? 'V' : 
                          this.hunterType === 'medic' ? 'M' : '';
            
            if (letter) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = `bold ${this.radius}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(letter, drawPos.x, drawPos.y);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
            }
        }
        
        if (this.hasMoved && !this.incapacitated && !this.isRemoved && this.moveOrder) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.moveOrder, drawPos.x, drawPos.y);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }
    }
}
