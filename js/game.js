import { Piece, Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
        this.reset();
    }
    
    reset() {
        // Tiger always center of Clearing
        this.tiger = new Piece(this.center.clone(), '#e74c3c', true);
        
        // Hunters in Borderlands
        this.hunters = [];
        const angleStep = (Math.PI * 2) / 5;
        for (let i = 0; i < 5; i++) {
            const angle = i * angleStep;
            const dist = Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH / 2;
            const pos = new Vector2(
                this.center.x + Math.cos(angle) * dist,
                this.center.y + Math.sin(angle) * dist
            );
            this.hunters.push(new Piece(pos, '#27ae60'));
        }
        
        this.turn = 'TIGER';
        this.huntersMoved = new Set();
        this.selectedPiece = null;
        this.roarActive = false;
        this.winner = null;
    }
    
    getAllPieces() {
        return [this.tiger, ...this.hunters];
    }
    
    selectPiece(pos) {
        if (this.winner) return null;
        
        if (this.turn === 'TIGER' && this.tiger.pos.distanceTo(pos) <= this.tiger.radius) {
            return this.tiger;
        } else if (this.turn === 'HUNTERS') {
            for (let hunter of this.hunters) {
                if (!hunter.incapacitated && 
                    hunter.pos.distanceTo(pos) <= hunter.radius &&
                    !this.huntersMoved.has(hunter)) {
                    return hunter;
                }
            }
        }
        return null;
    }
    
    movePiece(piece, targetPos) {
        if (this.winner) return;
        
        const dist = piece.pos.distanceTo(targetPos);
        
        if (piece.isTiger) {
            // Tiger can always move up to hand span
            if (dist > Systems.HAND_SPAN) return;
            
            // Cannot leave Clearing
            if (!Systems.isInClearing(targetPos, this.center)) return;
            
            // Execute turn
            this.executeTigerTurn(targetPos);
            
        } else {
            // Hunter movement
            if (dist > Systems.HAND_SPAN) return;
            
            // Cannot leave play area
            if (targetPos.distanceTo(this.center) > Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH) return;
            
            this.executeHunterTurn(piece, targetPos);
        }
    }
    
    executeTigerTurn(targetPos) {
        this.tiger.pos = targetPos.clone();
        
        // Check if landed on a hunter
        const landedHunter = this.hunters.find(h => 
            h.pos.distanceTo(targetPos) < 5 && !h.incapacitated
        );
        
        if (landedHunter) {
            // Chain pounce sequence
            let currentPos = this.tiger.pos;
            while (true) {
                const targets = Systems.getPounceTargets(currentPos, this.hunters, this.center);
                if (!targets.length) break;
                
                const target = targets[0];
                target.incapacitated = true;
                currentPos = target.pos;
                
                // Check for Tiger victory
                if (Systems.checkTigerVictory(this.hunters)) {
                    this.winner = 'TIGER';
                    return;
                }
            }
        } else {
            // Check for Roar
            this.roarActive = Systems.getPounceTargets(this.tiger.pos, this.hunters, this.center).length > 0;
            if (this.roarActive) {
                console.log("ROAR!");
            }
        }
        
        this.turn = 'HUNTERS';
        this.huntersMoved.clear();
    }
    
    executeHunterTurn(hunter, targetPos) {
        // Move hunter
        hunter.pos = targetPos.clone();
        this.huntersMoved.add(hunter);
        
        // Check for rescue
        const rescued = this.hunters.find(h => 
            h !== hunter && h.incapacitated && h.pos.distanceTo(targetPos) < 5
        );
        if (rescued) {
            rescued.incapacitated = false;
            console.log("Hunter rescued!");
        }
        
        // Check if all hunters have moved
        if (this.huntersMoved.size === this.hunters.length) {
            this.turn = 'TIGER';
            this.huntersMoved.clear();
            this.enforceCampingPenalty();
        }
        
        // Check for Hunter victory
        const victory = Systems.checkHunterVictory(this.tiger, this.hunters, this.center);
        if (victory.won) {
            this.winner = 'HUNTERS';
        }
    }
    
    enforceCampingPenalty() {
        const anyInClearing = this.hunters.some(h => 
            !h.incapacitated && Systems.isInClearing(h.pos, this.center)
        );
        
        if (!anyInClearing) return;
        
        for (let hunter of this.hunters) {
            if (!hunter.incapacitated && !Systems.isInClearing(h.pos, this.center)) {
                // If ends two turns in Borderlands...
                // (Simplified: remove if in Borderlands while active hunter in Clearing)
                hunter.incapacitated = true; // Temp: use incapacitated as "removed"
            }
        }
    }
}