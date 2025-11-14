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
        this.moveHistory = []; // NEW: Track hunter positions per turn
    }
    
    // ... [rest of existing methods until executeHunterTurn] ...
    
    executeHunterTurn(hunter, targetPos) {
        // Move hunter
        hunter.pos = targetPos.clone();
        hunter.hasMoved = true;
        this.huntersMoved.add(hunter);
        
        // Rescue check
        const rescued = this.hunters.find(h => 
            h !== hunter && h.incapacitated && h.pos.distanceTo(targetPos) < 10
        );
        if (rescued) {
            rescued.incapacitated = false;
            rescued.borderlandsTurns = 0; // Reset camping counter on rescue
            console.log("Hunter rescued!");
        }
        
        // Check if all hunters have moved
        if (this.huntersMoved.size === this.hunters.filter(h => !h.incapacitated).length) {
            this.turn = 'TIGER';
            const movedPositions = this.hunters.map(h => ({
                hunter: h,
                pos: h.pos.clone(),
                inBorderlands: Systems.isInBorderlands(h.pos, this.center)
            }));
            this.moveHistory.push(movedPositions);
            
            // Keep only last 2 turns of history
            if (this.moveHistory.length > 2) this.moveHistory.shift();
            
            this.huntersMoved.clear();
            this.hunters.forEach(h => h.hasMoved = false);
            this.enforceCampingPenalty();
        }
        
        // Check for Hunter victory
        const victory = Systems.checkHunterVictory(this.tiger, this.hunters, this.center);
        if (victory.won) {
            this.winner = 'HUNTERS';
            this.winningHunters = victory.hunters;
        }
    }
    
    enforceCampingPenalty() {
        if (this.moveHistory.length < 2) return;
        
        const anyInClearing = this.hunters.some(h => 
            !h.incapacitated && Systems.isInClearing(h.pos, this.center)
        );
        
        if (!anyInClearing) return;
        
        // Check each hunter's position across last 2 turns
        const [turn1, turn2] = this.moveHistory.slice(-2);
        
        for (let hunter of this.hunters) {
            if (hunter.incapacitated) continue;
            
            const posInTurn1 = turn1.find(p => p.hunter === hunter);
            const posInTurn2 = turn2.find(p => p.hunter === hunter);
            
            if (posInTurn1?.inBorderlands && posInTurn2?.inBorderlands) {
                console.log(`Hunter removed for camping!`);
                hunter.incapacitated = true;
                hunter.isRemoved = true; // Mark as removed vs incapacitated
            }
        }
    }
}
