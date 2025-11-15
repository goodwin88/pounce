import { Piece, Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Game {
    constructor(canvas, turnIndicator, statusDiv, difficulty = 3) {
        this.canvas = canvas;
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
        this.turnIndicator = turnIndicator;
        this.statusDiv = statusDiv;
        this.difficulty = difficulty;
        this.tigerAIEnabled = true;
        this.equidistantChoice = null; // NEW: For equidistant pouncing
        
        this.stats = {
            totalMoves: 0,
            pounceChains: [],
            campingRemovals: 0,
            triangleForms: 0
        };
        
        this.reset();
    }
    
    reset() {
        this.tiger = new Piece(this.center.clone(), '#e74c3c', true);
        
        this.hunters = [];
        const angleStep = (Math.PI * 2) / 5;
        const randomOffset = Math.random() * Math.PI * 2;
        
        const hunterProfiles = [
            { diameter: 25, borderlandsTolerance: 3, canMoveAfterRescue: false, canMoveAfterBeingRescued: false, hunterType: 'standard' },
            { diameter: 20, borderlandsTolerance: 2, canMoveAfterRescue: true, canMoveAfterBeingRescued: true, hunterType: 'scout' },
            { diameter: 30, borderlandsTolerance: 5, canMoveAfterRescue: false, canMoveAfterBeingRescued: false, hunterType: 'veteran' },
            { diameter: 18, borderlandsTolerance: 3, canMoveAfterRescue: true, canMoveAfterBeingRescued: false, hunterType: 'medic' },
            { diameter: 22, borderlandsTolerance: 3, canMoveAfterRescue: false, canMoveAfterBeingRescued: true, hunterType: 'standard' }
        ];
        
        const shuffledProfiles = hunterProfiles.sort(() => Math.random() - 0.5);
        
        let totalHunterDiameter = 0;
        
        for (let i = 0; i < 5; i++) {
            const angle = randomOffset + i * angleStep;
            const dist = Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH / 2;
            const pos = new Vector2(
                this.center.x + Math.cos(angle) * dist,
                this.center.y + Math.sin(angle) * dist
            );
            
            const hunter = new Piece(pos, '#27ae60', false, {
                ...shuffledProfiles[i],
                hunterSpecials: Systems.HUNTER_SPECIALS
            });
            this.hunters.push(hunter);
            
            totalHunterDiameter += shuffledProfiles[i].diameter;
        }
        
        // NEW: Apply difficulty scaling
        const tigerDiameter = totalHunterDiameter * (this.difficulty / 5);
        this.tiger.radius = tigerDiameter / 2;
        
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
        this.equidistantChoice = null;
        
        this.stats = {
            totalMoves: 0,
            pounceChains: [],
            campingRemovals: 0,
            triangleForms: 0
        };
        
        this.updateUI();
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
        } else if (this.equidistantChoice) {
            this.turnIndicator.textContent = 'Tiger: Choose Target!';
        } else {
            const diffName = Systems.DIFFICULTY_LEVELS[this.difficulty].name;
            const turnText = `${this.turn === 'TIGER' ? 'Tiger' : 'Hunters'}'s Turn`;
            const totalMovable = this.hunters.filter(h => !h.incapacitated && !h.isRemoved).length;
            const movesLeft = this.turn === 'HUNTERS' 
                ? ` (${this.hunters.filter(h => !h.hasMoved && !h.incapacitated && !h.isRemoved).length} of ${totalMovable} Hunters available)` 
                : '';
            this.turnIndicator.textContent = `${turnText}${movesLeft} - ${diffName}`;
        }
    }
    
    getState() {
        return JSON.stringify({
            tiger: { pos: this.tiger.pos, incapacitated: this.tiger.incapacitated },
            hunters: this.hunters.map(h => ({
                pos: h.pos,
                incapacitated: h.incapacitated,
                isRemoved: h.isRemoved,
                borderlandsTurns: h.borderlandsTurns,
                hasMoved: h.hasMoved,
                stats: {
                    diameter: h.radius * 2,
                    borderlandsTolerance: h.borderlandsTolerance,
                    canMoveAfterRescue: h.canMoveAfterRescue,
                    canMoveAfterBeingRescued: h.canMoveAfterBeingRescued,
                    hunterType: h.hunterType
                }
            })),
            turn: this.turn,
            moveHistory: this.moveHistory,
            stats: this.stats,
            difficulty: this.difficulty
        });
    }
    
    loadState(stateString) {
        try {
            const state = JSON.parse(stateString);
            
            this.tiger.pos = new Vector2(state.tiger.pos.x, state.tiger.pos.y);
            this.tiger.incapacitated = state.tiger.incapacitated;
            
            state.hunters.forEach((h, i) => {
                if (this.hunters[i]) {
                    this.hunters[i].pos = new Vector2(h.pos.x, h.pos.y);
                    this.hunters[i].incapacitated = h.incapacitated;
                    this.hunters[i].isRemoved = h.isRemoved;
                    this.hunters[i].borderlandsTurns = h.borderlandsTurns || 0;
                    this.hunters[i].hasMoved = h.hasMoved || false;
                    
                    if (h.stats) {
                        this.hunters[i].radius = h.stats.diameter ? h.stats.diameter / 2 : 15;
                        this.hunters[i].borderlandsTolerance = h.stats.borderlandsTolerance || 3;
                        this.hunters[i].canMoveAfterRescue = h.stats.canMoveAfterRescue || false;
                        this.hunters[i].canMoveAfterBeingRescued = h.stats.canMoveAfterBeingRescued || false;
                        this.hunters[i].hunterType = h.stats.hunterType || 'standard';
                    }
                }
            });
            
            this.turn = state.turn;
            this.moveHistory = state.moveHistory || [];
            this.stats = state.stats || this.stats;
            this.difficulty = state.difficulty || 3;
            this.huntersMoved.clear();
            
            this.updateUI();
            return true;
        } catch (e) {
            console.error("Failed to load game state:", e);
            return false;
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
        if (!(targetPos instanceof Vector2) || isNaN(targetPos.x) || isNaN(targetPos.y)) {
            console.error("Invalid target position:", targetPos);
            return;
        }
        
        if (this.processingAction) {
            console.log("Move blocked: already processing");
            return;
        }
        
        if (this.winner || this.isAnimating()) {
            console.log("movePiece blocked: winner or animating");
            return;
        }
        
        let dist = piece.pos.distanceTo(targetPos);
        const moveRange = piece.getMoveRange(); // NEW: Use specialized range
        
        if (piece.isTiger) {
            // NEW: Strict clamping to exact move range
            if (dist > moveRange + 0.01) {
                const dir = targetPos.sub(piece.pos);
                targetPos = piece.pos.add(dir.normalize().mult(moveRange));
                dist = moveRange;
            }
            
            const maxCenterDist = Systems.CLEARING_RADIUS - piece.radius;
            if (targetPos.distanceTo(this.center) > maxCenterDist) {
                const angle = Math.atan2(targetPos.y - this.center.y, targetPos.x - this.center.x);
                targetPos = new Vector2(
                    this.center.x + Math.cos(angle) * maxCenterDist,
                    this.center.y + Math.sin(angle) * maxCenterDist
                );
            }
            
            this.stats.totalMoves++;
            this.executeTigerTurn(targetPos);
            
        } else {
            // NEW: Check hunter-specific move range
            if (dist > moveRange + 0.01) {
                const dir = targetPos.sub(piece.pos);
                targetPos = piece.pos.add(dir.normalize().mult(moveRange));
                dist = moveRange;
            }
            
            const maxDist = Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH;
            if (targetPos.distanceTo(this.center) > maxDist) return;
            
            this.stats.totalMoves++;
            this.executeHunterTurn(piece, targetPos);
        }
    }
    
    executeTigerTurn(targetPos) {
        console.log("=== TIGER TURN START ===");
        
        // NEW: Strict enforcement of max move distance
        const actualMoveDist = this.tiger.pos.distanceTo(targetPos);
        if (actualMoveDist > this.tiger.getMoveRange() + 0.01) {
            console.warn("Tiger move clamped to max range");
            const dir = targetPos.sub(this.tiger.pos);
            targetPos = this.tiger.pos.add(dir.normalize().mult(this.tiger.getMoveRange()));
        }
        
        this.tiger.pos = targetPos.clone();
        this.processingAction = true;
        this.tiger.startAnimation(this.tiger.pos);
        
        setTimeout(() => {
            this.tiger.updateAnimation(this.tiger.animationEnd);
            
            // NEW: Check for equidistant hunters
            const equidistant = Systems.getEquidistantHunters(this.tiger.pos, this.hunters, Systems.HAND_SPAN);
            if (equidistant.length > 1 && this.tigerAIEnabled) {
                this.processEquidistantChoice(equidistant);
                return;
            }
            
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
                this.updateUI();
            }
        }, this.tiger.animationDuration);
    }
    
    // NEW: Handle equidistant hunter selection
    processEquidistantChoice(hunters) {
        console.log("Multiple equidistant hunters found:", hunters.length);
        this.equidistantChoice = hunters;
        this.statusDiv.textContent = "Tiger AI: Multiple targets at same distance! Click to choose.";
        this.updateUI();
        
        // In AI mode, randomly choose one
        const chosen = hunters[Math.floor(Math.random() * hunters.length)];
        console.log("AI randomly chose hunter:", this.hunters.indexOf(chosen));
        
        setTimeout(() => {
            this.equidistantChoice = null;
            this.processPounceChain(chosen);
        }, 1500);
    }
    
    processPounceChain(initialHunter) {
        console.log("=== Starting Pounce Chain ===");
        initialHunter.incapacitated = true;
        this.stats.pounceChains.push({ huntersPounced: 1 });
        
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
        this.stats.pounceChains[this.stats.pounceChains.length - 1].huntersPounced++;
        
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
        
        // NEW: Enforce hunter-specific move range
        const moveRange = hunter.getMoveRange();
        const actualDist = hunter.pos.distanceTo(targetPos);
        if (actualDist > moveRange + 0.01) {
            const dir = targetPos.sub(hunter.pos);
            targetPos = hunter.pos.add(dir.normalize().mult(moveRange));
        }
        
        hunter.startAnimation(targetPos);
        this.processingAction = true;
        
        setTimeout(() => {
            hunter.updateAnimation(hunter.animationEnd);
            
            // NEW: Use specialized rescue range
            const rescueRange = hunter.getRescueRange();
            const rescueThreshold = rescueRange > 0 ? rescueRange : hunter.radius + (this.hunters[0]?.radius || 15);
            
            const rescued = this.hunters.find(h => 
                h !== hunter && h.incapacitated && h.pos.distanceTo(hunter.pos) <= rescueThreshold
            );
            
            if (!rescued || !hunter.canMoveAfterRescue) {
                hunter.hasMoved = true;
                hunter.moveOrder = this.huntersMoved.size + 1;
                this.huntersMoved.add(hunter);
            }
            console.log(`Hunter moved. huntersMoved.size: ${this.huntersMoved.size}`);
            
            if (rescued) {
                console.log("RESCUE occurred!");
                rescued.incapacitated = false;
                rescued.borderlandsTurns = 0;
                
                if (!rescued.canMoveAfterBeingRescued) {
                    rescued.hasMoved = true;
                    this.huntersMoved.add(rescued);
                }
                console.log(`Rescued hunter added. huntersMoved.size: ${this.huntersMoved.size}`);
            }
            
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
                this.stats.triangleForms++;
                this.updateUI();
            }
            
            this.processingAction = false;
        }, hunter.animationDuration);
    }
    
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
            let finalPos = targetPos.clone();
            let currentDistFromCenter = targetPos.distanceTo(this.center);
            if (currentDistFromCenter > maxCenterDist) {
                const clampAngle = Math.atan2(targetPos.y - this.center.y, targetPos.x - this.center.x);
                finalPos = new Vector2(
                    this.center.x + Math.cos(clampAngle) * maxCenterDist,
                    this.center.y + Math.sin(clampAngle) * maxCenterDist
                );
            }
            
            const dir = finalPos.sub(this.tiger.pos);
            const clampedDist = Math.min(dir.distanceTo(new Vector2(0, 0)), Systems.HAND_SPAN);
            const normalized = clampedDist > 0 ? dir.mult(1 / dir.distanceTo(new Vector2(0, 0))) : new Vector2(0, 0);
            finalPos = this.tiger.pos.add(normalized.mult(clampedDist));
            
            const chainScore = this.simulatePounceChain(finalPos);
            const centerBonus = (Systems.CLEARING_RADIUS - finalPos.distanceTo(this.center)) * 0.01;
            const randomBonus = Math.random() * 0.1;
            const finalScore = chainScore + centerBonus + randomBonus;
            
            possibleTargets.push({ pos: finalPos, score: finalScore });
        }
        
        possibleTargets.sort((a, b) => b.score - a.score);
        console.log("Tiger AI evaluated", possibleTargets.length, "moves. Best score:", possibleTargets[0]?.score || 0);
        
        return possibleTargets[0]?.pos || null;
    }
    
    simulatePounceChain(targetPos) {
        const tempTiger = new Piece(this.tiger.pos.clone(), this.tiger.color, true);
        const tempHunters = this.hunters.map(h => {
            const temp = new Piece(h.pos.clone(), h.color, false, {
                diameter: h.radius * 2,
                borderlandsTolerance: h.borderlandsTolerance,
                canMoveAfterRescue: h.canMoveAfterRescue,
                canMoveAfterBeingRescued: h.canMoveAfterBeingRescued,
                hunterType: h.hunterType,
                hunterSpecials: h.hunterSpecials
            });
            temp.incapacitated = h.incapacitated;
            temp.isRemoved = h.isRemoved;
            return temp;
        });
        
        tempTiger.pos = targetPos.clone();
        const landedHunter = Systems.getLandedHunter(tempTiger.pos, tempHunters, tempTiger.radius);
        
        if (!landedHunter) return 0;
        
        let chainCount = 1;
        let currentPos = landedHunter.pos;
        landedHunter.incapacitated = true;
        
        while (true) {
            const targets = Systems.getHuntersInPounceRange(currentPos, tempHunters, this.center, Systems.HAND_SPAN);
            const available = targets.filter(h => !h.incapacitated && !h.isRemoved);
            if (!available.length) break;
            
            const nextTarget = available[0];
            nextTarget.incapacitated = true;
            chainCount++;
            currentPos = nextTarget.pos;
        }
        
        return chainCount;
    }
    
    recordTurnPositions() {
        const positions = this.hunters.map(h => ({
            hunter: h,
            pos: h.pos.clone(),
            inBorderlands: Systems.isInBorderlands(h.pos, this.center)
        }));
        this.moveHistory.push(positions);
        if (this.moveHistory.length > 3) this.moveHistory.shift();
    }
    
    enforceCampingPenalty() {
        if (this.moveHistory.length < 3) return;
        
        const anyInClearing = this.hunters.some(h => 
            !h.incapacitated && !h.isRemoved && Systems.isInClearing(h.pos, this.center)
        );
        if (!anyInClearing) return;
        
        const [turn1, turn2, turn3] = this.moveHistory.slice(-3);
        
        for (let hunter of this.hunters) {
            // NEW: Skip veteran hunters
            if (hunter.incapacitated || hunter.isRemoved || hunter.isVeteran()) continue;
            
            const posInTurn1 = turn1.find(p => p.hunter === hunter);
            const posInTurn2 = turn2.find(p => p.hunter === hunter);
            const posInTurn3 = turn3.find(p => p.hunter === hunter);
            
            const tolerance = hunter.borderlandsTolerance;
            const turnsInBorderlands = [posInTurn1, posInTurn2, posInTurn3].filter(p => p?.inBorderlands).length;
            
            if (turnsInBorderlands >= tolerance) {
                console.log(`Hunter ${this.hunters.indexOf(hunter)} removed for camping ${tolerance} turns!`);
                hunter.isRemoved = true;
                this.stats.campingRemovals++;
            }
        }
    }
    
    getCampingWarning(hunter) {
        if (this.moveHistory.length < 2 || hunter.incapacitated || hunter.isRemoved || hunter.isVeteran()) return 0;
        
        const anyInClearing = this.hunters.some(h => 
            !h.incapacitated && !h.isRemoved && Systems.isInClearing(h.pos, this.center)
        );
        if (!anyInClearing) return 0;
        
        const [turn1, turn2] = this.moveHistory.slice(-2);
        const inTurn1 = turn1.find(p => p.hunter === hunter)?.inBorderlands;
        const inTurn2 = turn2.find(p => p.hunter === hunter)?.inBorderlands;
        
        const tolerance = hunter.borderlandsTolerance;
        const turnsInBorderlands = [inTurn1, inTurn2].filter(Boolean).length;
        
        if (turnsInBorderlands >= tolerance - 1) return 2;
        if (turnsInBorderlands >= tolerance - 2 && tolerance > 2) return 1;
        
        return 0;
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
