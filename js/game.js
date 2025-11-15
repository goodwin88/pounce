import { Piece, Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Game {
    constructor(canvas, turnIndicator, statusDiv) {
        this.canvas = canvas;
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
        this.turnIndicator = turnIndicator;
        this.statusDiv = statusDiv;
        this.reset();
        this.tigerAIEnabled = true;
        
        this.stats = {
            totalMoves: 0,
            pounceChains: [],
            campingRemovals: 0,
            triangleForms: 0
        };
    }
    
    reset() {
        this.tiger = new Piece(this.center.clone(), '#e74c3c', true);
        
        this.hunters = [];
        const angleStep = (Math.PI * 2) / 5;
        
        const randomOffset = Math.random() * Math.PI * 2;
        
        const hunterProfiles = [
            { diameter: 25, borderlandsTolerance: 4, canMoveAfterRescue: false, canMoveAfterBeingRescued: false, hunterType: 'standard' },
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
            
            const hunter = new Piece(pos, '#27ae60', false, shuffledProfiles[i]);
            this.hunters.push(hunter);
            
            totalHunterDiameter += shuffledProfiles[i].diameter;
        }
        
        const tigerDiameter = totalHunterDiameter;
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
        this.aiThinking
