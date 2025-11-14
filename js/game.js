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
        this.animationQueue = []; // Queue for sequential animations
        this.processingAction = false; // Prevent input during animations
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
            
            // Clamp Tiger to Clearing boundary
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
        // Start Tiger movement animation
        this.tiger.startAnimation(targetPos);
        this.processingAction = true;
        
        // After animation, check for pounce
        setTimeout(() => {
            this.tiger.updateAnimation(this.tiger.animationEnd);
            
            // Find hunters landed on (edge-to-edge collision)
            const landedHunter = this.hunters.find(h => 
                !h.incapacitated && !h.isRemoved && 
                this.tiger.pos.distanceTo(h.pos) <= this.tiger.radius + h.radius
            );
            
            if (landedHunter) {
                this.processPounceChain();
            } else {
                this.roarActive = Systems.getPounceTargets(this.tiger.pos, this.hunters, this.center, this.tiger.radius).length > 0;
                if (this.roarActive) console.log("ROAR!");
                
                this.turn = 'HUNTERS';
                this.huntersMoved.clear();
                this.processingAction = false;
            }
        }, this.tiger.animationDuration);
    }
    
    processPounceChain() {
        let currentPos = this.tiger.pos;
        let chainCount = 0;
        
        const processNextPounce = () => {
            const targets = Systems.getPounceTargets(currentPos, this.hunters, this.center, this.tiger.radius);
            
            if (!targets.length) {
                console.log(`Chain pounce ended. Total pounced: ${chainCount}`);
                this.turn = 'HUNTERS';
                this.huntersMoved.clear();
                this.processingAction = false;
                return;
            }
            
            const target = targets[0];
            target.incapacitated = true;
            chainCount++;
            currentPos = target.pos;
            
            // Animate Tiger to the pounced hunter
            this.tiger.startAnimation(target.pos);
            
            setTimeout(() => {
                this.tiger.updateAnimation(this.tiger.animationEnd);
                
                if (Systems.checkTigerVictory(this.hunters)) {
                    this.winner = 'TIGER';
                    this.processingAction = false;
                    return;
                }
                
                processNextPounce();
            }, this.tiger.animationDuration);
        };
        
        processNextPounce();
    }
    
    executeHunterTurn(hunter, targetPos) {
        hunter.startAnimation(targetPos);
        this.processingAction = true;
        
        setTimeout(() => {
            hunter.updateAnimation(hunter.animationEnd);
            hunter.hasMoved = true;
            hunter.moveOrder = this.huntersMoved.size + 1;
            this.huntersMoved.add(hunter);
            
            // Rescue check
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
        // Update all animations
        const pieces = this.getAllPieces();
        let anyAnimating = false;
        
        for (let piece of pieces) {
            if (piece.isAnimating) {
                const finished = piece.updateAnimation(currentTime);
                if (!finished) anyAnimating = true;
            }
        }
        
        return anyAnimating;
    }
}
