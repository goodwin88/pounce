import { Piece, Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
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
            
            const landedHunter = Systems.getLandedHunter(this.tiger.pos, this.hunters, this.tiger.radius);
            
            if (landedHunter) {
                console.log("=== TIGER LANDED ON HUNTER ===");
                this.processPounceChain(landedHunter);
            } else {
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
        initialHunter.incapacitated = true;
        
        if (Systems.checkTigerVictory(this.hunters)) {
            this.winner = 'TIGER';
            this.processingAction = false;
            return;
        }
        
        this.performNextPounce(this.tiger.pos);
    }
    
    performNextPounce(fromPos) {
        const targets = Systems.getHuntersInPounceRange(fromPos, this.hunters, this.center, Systems.HAND_SPAN);
        
        if (!targets.length) {
            console.log("Pounce chain ended.");
            this.turn = 'HUNTERS';
            this.huntersMoved.clear();
            this.processingAction = false;
            return;
        }
        
        const target = targets[0];
        console.log("Pouncing hunter at:", target.pos);
        target.incapacitated = true;
        
        this.tiger.startAnimation(target.pos);
        
        setTimeout(() => {
            this.tiger.updateAnimation(this.tiger.animationEnd);
            
            if (Systems.checkTigerVictory(this.hunters)) {
                this.winner = 'TIGER';
                this.processingAction = false;
                return;
            }
            
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
                rescued.hasMoved = true;
                this.huntersMoved.add(rescued);
                console.log("Hunter rescued! Cannot move this turn.");
            }
            
            // CRITICAL FIX: Recalculate total movable hunters after rescue
            const totalMovable = this.hunters.filter(h => !h.incapacitated && !h.isRemoved).length;
            if (this.huntersMoved.size === totalMovable) {
                this.recordTurnPositions();
                this.turn = 'TIGER';
                this.huntersMoved.clear();
                this.hunters.forEach(h => {
                    h.hasMoved = false;
                    h.moveOrder = null;
                });
                this.enforceCampingPenalty();
                
                // Trigger AI after Hunter turn ends
                if (this.tigerAIEnabled && !this.winner) {
                    setTimeout(() => this.executeTigerAI(), 500);
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
            }
            
            this.processingAction = false;
        }, hunter.animationDuration);
    }
    
    // Tiger AI
    executeTigerAI() {
        if (this.winner || this.turn !== 'TIGER' || !this.tigerAIEnabled) return;
        
        console.log("=== TIGER AI THINKING ===");
        this.aiThinking = true;
        this.updateUI();
        
        setTimeout(() => {
            const bestMove = this.calculateBestTigerMove();
            this.aiThinking = false;
            
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
    
    updateUI() {
        const statusDiv = document.getElementById('status');
        const turnIndicator = document.getElementById('turn-indicator');
        
        if (this.winner) {
            turnIndicator.textContent = `${this.winner} WINS!`;
            turnIndicator.style.color = '#e74c3c';
            statusDiv.innerHTML = `<span style="color: #27ae60; font-weight: bold;">Victory!</span>`;
        } else {
            turnIndicator.textContent = `${this.turn}'s Turn`;
            turnIndicator.style.color = this.turn === 'TIGER' ? '#e74c3c' : '#27ae60';
            
            if (this.turn === 'HUNTERS') {
                const remaining = 5 - this.huntersMoved.size;
                turnIndicator.textContent += ` (${remaining} moves left)`;
            }
            
            if (this.aiThinking) {
                turnIndicator.textContent = 'TIGER is thinking...';
            }
            
            if (this.tigerAIEnabled && this.turn === 'TIGER' && !this.aiThinking && !this.winner) {
                statusDiv.textContent = "Tiger is automated. Control the Hunters.";
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
