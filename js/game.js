import { Piece, Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Game {
    constructor(canvas, turnIndicator, statusDiv) {
        this.canvas = canvas;
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
        this.turnIndicator = turnIndicator;
        this.statusDiv = statusDiv;
        this.reset();
        this.tigerAIEnabled = true; // Set to false for 2-player mode
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
        this.animationQueue = [];
        this.processingAction = false;
        this.aiThinking = false;
    }
    
    getAllPieces() {
        return [this.tiger, ...this.hunters];
    }
    
    isAnimating() {
        return this.getAllPieces().some(p => p.isAnimating) || this.processingAction || this.aiThinking;
    }
    
    updateUI() {
        if (!this.turnIndicator) return;
        
        if (this.winner) {
            this.turnIndicator.textContent = `${this.winner} WINS!`;
            if (this.statusDiv) {
                this.statusDiv.textContent = this.winner === 'TIGER' 
                    ? 'All Hunters have been pounced!' 
                    : 'The Tiger is trapped in the triangle!';
            }
        } else if (this.aiThinking) {
            this.turnIndicator.textContent = 'Tiger Thinking...';
        } else {
            this.turnIndicator.textContent = `${this.turn === 'TIGER' ? 'Tiger' : 'Hunters'}'s Turn`;
        }
    }
    
    selectPiece(pos) {
        if (this.winner || this.isAnimating()) return null;
        
        const tigerDist = this.tiger.pos.distanceTo(pos);
        if (this.turn === 'TIGER' && tigerDist <= this.tiger.radius && !this.tigerAIEnabled) {
            return this.tiger;
        } else if (this.turn === 'HUNTERS') {
            for (let hunter of this.hunters) {
                if (!hunter.incapacitated && !hunter.isRemoved &&
                    hunter.pos.distanceTo(pos) <= hunter.radius &&
                    !this.huntersMoved.has(hunter) &&
                    !hunter.hasMoved) {
                    return hunter;
                }
            }
        }
        return null;
    }
    
    movePiece(piece, targetPos) {
        console.log(`movePiece called for ${piece.isTiger ? 'TIGER' : 'HUNTER'}, isAnimating: ${this.isAnimating()}`);
        if (this.winner || this.isAnimating()) {
            console.log("movePiece blocked: winner or animating");
            return;
        }
        
        const dist = piece.pos.distanceTo(targetPos);
        
        if (piece.isTiger) {
            if (dist > Systems.HAND_SPAN) {
                console.log("Tiger move blocked: distance too far");
                return;
            }
            
            const maxCenterDist = Systems.CLEARING_RADIUS - piece.radius;
            if (targetPos.distanceTo(this.center) > maxCenterDist) {
                const angle = Math.atan2(targetPos.y - this.center.y, targetPos.x - this.center.x);
                targetPos = new Vector2(
                    this.center.x + Math.cos(angle) * maxCenterDist,
                    this.center.y + Math.sin(angle) * maxCenterDist
                );
            }
            
            console.log("Executing Tiger turn");
            this.executeTigerTurn(targetPos);
            
        } else {
            if (dist > Systems.HAND_SPAN) return;
            
            const maxDist = Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH;
            if (targetPos.distanceTo(this.center) > maxDist) return;
            
            this.executeHunterTurn(piece, targetPos);
        }
    }
    
    executeTigerTurn(targetPos) {
        console.log("=== TIGER TURN START ===");
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
            
            const landedHunter = Systems.getLandedHunter(this.tiger.pos, this.hunters, this.tiger.radius);
            
            if (landedHunter) {
                console.log("=== TIGER LANDED ON HUNTER ===");
                this.processPounceChain(landedHunter);
            } else {
                console.log("Tiger landed on empty space, checking for ROAR");
                this.roarActive = Systems.getHuntersInPounceRange(this.tiger.pos, this.hunters, this.center, Systems.HAND_SPAN).length > 0;
                if (this.roarActive) console.log("ROAR!");
                
                console.log("Tiger turn ending, switching to Hunters");
                this.turn = 'HUNTERS';
                this.huntersMoved.clear();
                this.processingAction = false;
            }
        }, this.tiger.animationDuration);
    }
    
    processPounceChain(initialHunter) {
        console.log("=== Starting Pounce Chain ===");
        initialHunter.incapacitated = true;
        
        if (Systems.checkTigerVictory(this.hunters)) {
            console.log("TIGER VICTORY!");
            this.winner = 'TIGER';
            this.processingAction = false;
            this.updateUI();
            return;
        }
        
        this.performNextPounce(this.tiger.pos);
    }
    
    performNextPounce(fromPos) {
        console.log("--- Checking for next pounce ---");
        const targets = Systems.getHuntersInPounceRange(fromPos, this.hunters, this.center, Systems.HAND_SPAN);
        
        if (!targets.length) {
            console.log("No more targets. Pounce chain ended.");
            this.turn = 'HUNTERS';
            this.huntersMoved.clear();
            this.processingAction = false;
            this.updateUI();
            return;
        }
        
        const target = targets[0];
        console.log("Pouncing hunter at:", target.pos);
        target.incapacitated = true;
        
        this.tiger.startAnimation(target.pos);
        
        setTimeout(() => {
            this.tiger.updateAnimation(this.tiger.animationEnd);
            
            if (Systems.checkTigerVictory(this.hunters)) {
                console.log("TIGER VICTORY during chain!");
                this.winner = 'TIGER';
                this.processingAction = false;
                this.updateUI();
                return;
            }
            
            this.performNextPounce(target.pos);
        }, this.tiger.animationDuration);
    }
    
    executeHunterTurn(hunter, targetPos) {
        console.log(`=== HUNTER TURN: ${this.hunters.indexOf(hunter)} moving to ${targetPos.x},${targetPos.y} ===`);
        hunter.startAnimation(targetPos);
        this.processingAction = true;
        
        setTimeout(() => {
            hunter.updateAnimation(hunter.animationEnd);
            hunter.hasMoved = true;
            hunter.moveOrder = this.huntersMoved.size + 1;
            this.huntersMoved.add(hunter);
            console.log(`Hunter moved. huntersMoved.size: ${this.huntersMoved.size}`);
            
            const rescued = this.hunters.find(h => 
                h !== hunter && h.incapacitated && h.pos.distanceTo(hunter.pos) <= h.radius + hunter.radius
            );
            
            if (rescued) {
                console.log("RESCUE occurred!");
                rescued.incapacitated = false;
                rescued.borderlandsTurns = 0;
                rescued.hasMoved = true;
                this.huntersMoved.add(rescued);
                console.log(`Rescued hunter added. huntersMoved.size: ${this.huntersMoved.size}`);
            }
            
            // CRITICAL FIX: Recalculate after rescue
            const totalMovable = this.hunters.filter(h => !h.incapacitated && !h.isRemoved).length;
            console.log(`Total movable hunters: ${totalMovable}, huntersMoved.size: ${this.huntersMoved.size}`);
            
            if (this.huntersMoved.size === totalMovable) {
                console.log("=== HUNTER TURN ENDING ===");
                this.recordTurnPositions();
                this.turn = 'TIGER';
                this.huntersMoved.clear();
                this.hunters.forEach(h => {
                    h.hasMoved = false;
                    h.moveOrder = null;
                });
                this.enforceCampingPenalty();
                this.updateUI();
                
                // CRITICAL: Trigger AI after Hunter turn ends
                if (this.tigerAIEnabled && !this.winner) {
                    console.log("Scheduling Tiger AI in 500ms...");
                    setTimeout(() => {
                        console.log("Tiger AI timeout firing!");
                        this.executeTigerAI();
                    }, 500);
                }
            } else {
                if (rescued) {
                    this.updateUI();
                }
            }
            
            const victory = Systems.checkHunterVictory(this.tiger, this.hunters, this.center);
            if (victory.won) {
                this.winner = 'HUNTERS';
                this.winningHunters = victory.hunters;
                this.updateUI();
            }
            
            this.processingAction = false;
        }, hunter.animationDuration);
    }
    
    // Tiger AI
    executeTigerAI() {
        console.log("executeTigerAI called!");
        if (this.winner || this.turn !== 'TIGER' || !this.tigerAIEnabled) {
            console.log(`executeTigerAI blocked: winner=${this.winner}, turn=${this.turn}, aiEnabled=${this.tigerAIEnabled}`);
            return;
        }
        
        console.log("=== TIGER AI THINKING ===");
        this.aiThinking = true;
        this.updateUI();
        
        setTimeout(() => {
            const bestMove = this.calculateBestTigerMove();
            this.aiThinking = false; // CRITICAL: Stop thinking before moving
            
            if (bestMove) {
                console.log("Tiger AI moving to:", bestMove);
                this.movePiece(this.tiger, bestMove);
                this.updateUI();
            } else {
                console.log("Tiger AI: No valid move found?!");
                this.turn = 'HUNTERS';
                this.huntersMoved.clear();
                this.updateUI();
            }
        }, 800);
    }
    
    calculateBestTigerMove() {
        const possibleTargets = [];
        
        const samples = 12;
        for (let angle = 0; angle < Math.PI * 2; angle += (Math.PI * 2) / samples) {
            const targetPos = new Vector2(
                this.tiger.pos.x + Math.cos(angle) * Systems.HAND_SPAN,
                this.tiger.pos.y + Math.sin(angle) * Systems.HAND_SPAN
            );
            
            const maxCenterDist = Systems.CLEARING_RADIUS - this.tiger.radius;
            if (targetPos.distanceTo(this.center) > maxCenterDist) {
                const clampAngle = Math.atan2(targetPos.y - this.center.y, targetPos.x - this.center.x);
                targetPos.x = this.center.x + Math.cos(clampAngle) * maxCenterDist;
                targetPos.y = this.center.y + Math.sin(clampAngle) * maxCenterDist;
            }
            
            const chainScore = this.simulatePounceChain(targetPos);
            possibleTargets.push({ pos: targetPos, score: chainScore });
        }
        
        possibleTargets.sort((a, b) => b.score - a.score);
        console.log("Tiger AI evaluated", possibleTargets.length, "moves. Best score:", possibleTargets[0]?.score || 0);
        
        return possibleTargets[0]?.pos || null;
    }
    
    simulatePounceChain(targetPos) {
        const originalTigerPos = this.tiger.pos.clone();
        const savedHunters = this.hunters.map(h => ({
            pos: h.pos.clone(),
            incapacitated: h.incapacitated
        }));
        
        this.tiger.pos = targetPos.clone();
        const landedHunter = Systems.getLandedHunter(this.tiger.pos, this.hunters, this.tiger.radius);
        
        if (!landedHunter) {
            this.tiger.pos = originalTigerPos;
            savedHunters.forEach((h, i) => {
                this.hunters[i].pos = h.pos;
                this.hunters[i].incapacitated = h.incapacitated;
            });
            return 0;
        }
        
        let chainCount = 1;
        let currentPos = landedHunter.pos;
        landedHunter.incapacitated = true;
        
        while (true) {
            const targets = Systems.getHuntersInPounceRange(currentPos, this.hunters, this.center, Systems.HAND_SPAN);
            const available = targets.filter(h => !h.incapacitated);
            if (!available.length) break;
            
            const nextTarget = available[0];
            nextTarget.incapacitated = true;
            chainCount++;
            currentPos = nextTarget.pos;
        }
        
        this.tiger.pos = originalTigerPos;
        savedHunters.forEach((h, i) => {
            this.hunters[i].pos = h.pos;
            this.hunters[i].incapacitated = h.incapacitated;
        });
        
        return chainCount;
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
