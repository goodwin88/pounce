import { Piece, Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
        this.reset();
    }
    
    reset() {
        this.tiger = new Piece(this.center.clone(), '#e74c3c', true);
        
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
        this.winningHunters = null;
        this.moveHistory = [];
    }
    
    getAllPieces() {
        return [this.tiger, ...this.hunters];
    }
    
    selectPiece(pos) {
        if (this.winner) return null;
        
        const tigerDist = this.tiger.pos.distanceTo(pos);
        if (this.turn === 'TIGER' && tigerDist <= this.tiger.radius) {
            return this.tiger;
        } else if (this.turn === 'HUNTERS') {
            for (let hunter of this.hunters) {
                if (!hunter.incapacitated && !hunter.isRemoved &&
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
            if (dist > Systems.HAND_SPAN) return;
            
            // Check if Tiger's edge would leave Clearing
            const maxCenterDist = Systems.CLEARING_RADIUS - piece.radius;
            if (targetPos.distanceTo(this.center) > maxCenterDist) {
                // Clamp to boundary
                const angle = Math.atan2(targetPos.y - this.center.y, targetPos.x - this.center.x);
                targetPos = new Vector2(
                    this.center.x + Math.cos(angle) * maxCenterDist,
                    this.center.y + Math.sin(angle) * maxCenterDist
                );
            }
            
            this.executeTigerTurn(targetPos);
            
        } else {
            if (dist > Systems.HAND_SPAN) return;
            
            const maxDist = Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH;
            if (targetPos.distanceTo(this.center) > maxDist) return;
            
            this.executeHunterTurn(piece, targetPos);
        }
    }
    
    executeTigerTurn(targetPos) {
    // Clamp Tiger's center to stay within Clearing minus its radius
    const maxDistanceFromCenter = Systems.CLEARING_RADIUS - this.tiger.radius;
    const distanceFromCenter = targetPos.distanceTo(this.center);
    
    if (distanceFromCenter > maxDistanceFromCenter) {
        const angle = Math.atan2(targetPos.y - this.center.y, targetPos.x - this.center.x);
        this.tiger.pos = new Vector2(
            this.center.x + Math.cos(angle) * maxDistanceFromCenter,
            this.center.y + Math.sin(angle) * maxDistanceFromCenter
        );
    } else {
        this.tiger.pos = targetPos.clone();
    }
    
    // Find hunters landed on (edge-to-edge collision)
    const landedHunter = this.hunters.find(h => 
        !h.incapacitated && !h.isRemoved && 
        this.tiger.pos.distanceTo(h.pos) <= this.tiger.radius + h.radius
    );
    
    if (landedHunter) {
        // Chain pounce sequence - Tiger moves to each hunter's position
        let currentPos = this.tiger.pos;
        let chainCount = 0;
        
        while (true) {
            // PASS TIGER RADIUS HERE
            const targets = Systems.getPounceTargets(currentPos, this.hunters, this.center, this.tiger.radius);
            
            if (!targets.length) {
                console.log(`Chain pounce ended. Total pounced: ${chainCount}`);
                break;
            }
            
            const target = targets[0];
            target.incapacitated = true;
            chainCount++;
            
            console.log(`Pounce #${chainCount}: Hunter at (${target.pos.x}, ${target.pos.y})`);
            
            // Tiger moves to the pounced hunter's position
            currentPos = target.pos;
            this.tiger.pos = target.pos.clone(); // UPDATE TIGER POSITION
            
            // Check for Tiger victory
            if (Systems.checkTigerVictory(this.hunters)) {
                this.winner = 'TIGER';
                console.log("TIGER VICTORY!");
                return;
            }
        }
    } else {
        // Check for Roar (threatens hunters next turn)
        this.roarActive = Systems.getPounceTargets(this.tiger.pos, this.hunters, this.center, this.tiger.radius).length > 0;
        if (this.roarActive) {
            console.log("ROAR! - Hunters threatened");
        }
    }
    
    this.turn = 'HUNTERS';
    this.huntersMoved.clear();
}
    
    executeHunterTurn(hunter, targetPos) {
        hunter.pos = targetPos.clone();
        hunter.hasMoved = true;
        this.huntersMoved.add(hunter);
        
        const rescued = this.hunters.find(h => 
            h !== hunter && h.incapacitated && h.pos.distanceTo(targetPos) <= h.radius + 5
        );
        
        if (rescued) {
            rescued.incapacitated = false;
            rescued.borderlandsTurns = 0;
            console.log("Hunter rescued!");
        }
        
        const activeHunters = this.hunters.filter(h => !h.incapacitated && !h.isRemoved);
        if (this.huntersMoved.size === activeHunters.length) {
            this.recordTurnPositions();
            this.turn = 'TIGER';
            this.huntersMoved.clear();
            this.hunters.forEach(h => h.hasMoved = false);
            this.enforceCampingPenalty();
        }
        
        const victory = Systems.checkHunterVictory(this.tiger, this.hunters, this.center);
        if (victory.won) {
            this.winner = 'HUNTERS';
            this.winningHunters = victory.hunters;
        }
    }
    
    recordTurnPositions() {
        const positions = this.hunters.map(h => ({
            hunter: h,
            pos: h.pos.clone(),
            inBorderlands: Systems.isInBorderlands(h.pos, this.center)
        }));
        this.moveHistory.push(positions);
        if (this.moveHistory.length > 2) this.moveHistory.shift();
    }
    
    enforceCampingPenalty() {
        if (this.moveHistory.length < 2) return;
        
        const anyInClearing = this.hunters.some(h => 
            !h.incapacitated && !h.isRemoved && Systems.isInClearing(h.pos, this.center)
        );
        if (!anyInClearing) return;
        
        const [turn1, turn2] = this.moveHistory.slice(-2);
        
        for (let hunter of this.hunters) {
            if (hunter.incapacitated || hunter.isRemoved) continue;
            
            const posInTurn1 = turn1.find(p => p.hunter === hunter);
            const posInTurn2 = turn2.find(p => p.hunter === hunter);
            
            if (posInTurn1?.inBorderlands && posInTurn2?.inBorderlands) {
                console.log(`Hunter removed for camping!`);
                hunter.isRemoved = true;
            }
        }
    }
}
