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
        self.winner = null;
        this.winningHunters = null;
        this.moveHistory = [];
        this.animationQueue = [];
        this.processingAction = false;
    }
    
    getAllPieces() {
        return [this.tiger, ...this.hunters];
    }
    
    isAnimating() {
        return this.getAllPieces().some(p => p.isAnimating) || this.processingAction;
    }
    
    selectPiece(pos) {
        if (this.winner || this.isAnimating()) return null;
        
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
        if (this.winner || this.isAnimating()) return;
        
        const dist = piece.pos.distanceTo(targetPos);
        
        if (piece.isTiger) {
            if (dist > Systems.HAND_SPAN) return;
            
            const maxCenterDist = Systems.CLEARING_RADIUS - piece.radius;
            if (targetPos.distanceTo(this.center) > maxCenterDist) {
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
        
        this.processingAction = true;
        this.tiger.startAnimation(this.tiger.pos);
        
        setTimeout(() => {
            this.tiger.updateAnimation(this.tiger.animationEnd);
            
            // Check if Tiger landed ON a hunter (collision)
            const landedHunter = Systems.getLandedHunter(this.tiger.pos, this.hunters, this.tiger.radius);
            
            if (landedHunter) {
                console.log("=== TIGER LANDED ON HUNTER ===");
                this.processPounceChain(landedHunter);
            } else {
                // Check for Roar (hunters within HAND_SPAN)
                this.roarActive = Systems.getHuntersInPounceRange(this.tiger.pos, this.hunters, this.center, Systems.HAND_SPAN).length > 0;
                if (this.roarActive) console.log("ROAR!");
                
                this.turn = 'HUNTERS';
                this.huntersMoved.clear();
                this.processingAction = false;
            }
        }, this.tiger.animationDuration);
    }
    
    processPounceChain(initialHunter) {
        console.log("=== Starting Pounce Chain ===");
        console.log("Initial hunter at:", initialHunter.pos);
        
        // Pounce the landed hunter
        initialHunter.incapacitated = true;
        
        if (Systems.checkTigerVictory(this.hunters)) {
            this.winner = 'TIGER';
            this.processingAction = false;
            return;
        }
        
        // Check for additional hunters within HAND_SPAN
        this.performNextPounce(this.tiger.pos);
    }
    
    performNextPounce(fromPos) {
        console.log("--- Checking for next pounce from Tiger position:", fromPos);
        
        // Find hunters within HAND_SPAN (not collision distance!)
        const targets = Systems.getHuntersInPounceRange(fromPos, this.hunters, this.center, Systems.HAND_SPAN);
        
        console.log(`Found ${targets.length} hunters within ${Systems.HAND_SPAN}px`);
        targets.forEach((t, i) => {
            const dist = fromPos.distanceTo(t.pos);
            console.log(`  ${i}: Hunter at (${t.pos.x}, ${t.pos.y}) - distance: ${dist.toFixed(2)}px`);
        });
        
        if (!targets.length) {
            console.log("No more hunters in range. Ending turn.");
            this.turn = 'HUNTERS';
            this.huntersMoved.clear();
            this.processingAction = false;
            return;
        }
        
        const target = targets[0];
        console.log("Pouncing hunter at:", target.pos);
        target.incapacitated = true;
        
        // Animate Tiger to the target
        this.tiger.startAnimation(target.pos);
        
        setTimeout(() => {
            this.tiger.updateAnimation(this.tiger.animationEnd);
            
            if (Systems.checkTigerVictory(this.hunters)) {
                this.winner = 'TIGER';
                this.processingAction = false;
                return;
            }
            
            // Continue chain from new position
            this.performNextPounce(target.pos);
        }, this.tiger.animationDuration);
    }
    
    executeHunterTurn(hunter, targetPos) {
        hunter.startAnimation(targetPos);
        this.processingAction = true;
        
        setTimeout(() => {
            hunter.updateAnimation(hunter.animationEnd);
            hunter.hasMoved = true;
            hunter.moveOrder = this.huntersMoved.size + 1;
            this.huntersMoved.add(hunter);
            
            const rescued = this.hunters.find(h => 
                h !== hunter && h.incapacitated && h.pos.distanceTo(hunter.pos) <= h.radius + hunter.radius
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
                this.hunters.forEach(h => {
                    h.hasMoved = false;
                    h.moveOrder = null;
                });
                this.enforceCampingPenalty();
            }
            
            const victory = Systems.checkHunterVictory(this.tiger, this.hunters, this.center);
            if (victory.won) {
                this.winner = 'HUNTERS';
                this.winningHunters = victory.hunters;
            }
            
            this.processingAction = false;
        }, hunter.animationDuration);
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
    
    update(currentTime) {
        const pieces = this.getAllPieces();
        let anyAnimating = false;
        
        for (let piece of pieces) {
            const finished = piece.updateAnimation(currentTime);
            if (!finished) anyAnimating = true;
        }
        
        return anyAnimating;
    }
}
