import { Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
    }
    
    clear() {
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawZones() {
        this.ctx.strokeStyle = '#f39c12';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(this.center.x, this.center.y, Systems.CLEARING_RADIUS, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.center.x, this.center.y, 
                     Systems.CLEARING_RADIUS + Systems.BORDERLANDS_WIDTH, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#f39c12';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText('Clearing', 10, 30);
        
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillText('Borderlands', 10, 55);
    }
    
    drawRangeIndicator(pos, range) {
        this.ctx.strokeStyle = 'rgba(241, 196, 15, 0.6)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, range, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#f39c12';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(`Move: ${Math.round(range)}px`, 10, 80);
    }
    
    drawPounceRange(tigerPos, visibleHunters, center, range) {
        this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([2, 4]);
        this.ctx.beginPath();
        this.ctx.arc(tigerPos.x, tigerPos.y, range, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Pounce: ${Math.round(range)}px`, 10, 100);
    }
    
    drawRoarEffect(tigerPos, threatenedHunters, range) {
        if (!threatenedHunters || threatenedHunters.length === 0) return;
        
        const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
        this.ctx.strokeStyle = `rgba(231, 76, 60, ${pulse})`;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(tigerPos.x, tigerPos.y, range, 0, Math.PI * 2);
        this.ctx.stroke();
        
        threatenedHunters.forEach(h => {
            this.ctx.strokeStyle = `rgba(231, 76, 60, ${pulse})`;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(h.pos.x, h.pos.y, h.radius + 5, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        this.ctx.fillStyle = `rgba(231, 76, 60, ${pulse})`;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ROAR!', tigerPos.x, tigerPos.y - 40);
        this.ctx.textAlign = 'left';
    }
    
    drawVictoryTriangle(hunters) {
        if (!hunters || hunters.length !== 3) return;
        
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.5;
        this.ctx.fillStyle = `rgba(46, 204, 113, ${pulse})`;
        this.ctx.beginPath();
        this.ctx.moveTo(hunters[0].pos.x, hunters[0].pos.y);
        hunters.forEach(h => this.ctx.lineTo(h.pos.x, h.pos.y));
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.strokeStyle = `rgba(39, 174, 96, ${pulse + 0.3})`;
        this.ctx.lineWidth = 4;
        this.ctx.stroke();
        
        hunters.forEach(h => {
            if (Systems.distance(h.pos, this.center) <= Systems.HAND_SPAN) {
                this.ctx.strokeStyle = '#2ecc71';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(h.pos.x, h.pos.y, h.radius + 8, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        });
        
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TRIANGLE COMPLETE!', this.canvas.width / 2, 100);
        this.ctx.textAlign = 'left';
    }
    
    drawCampingWarnings(gameInstance) {
        gameInstance.hunters.forEach(hunter => {
            const warningLevel = gameInstance.getCampingWarning(hunter);
            if (warningLevel === 0) return;
            
            const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;
            const color = warningLevel === 2 ? '#e67e22' : '#f39c12';
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([4, 4]);
            this.ctx.beginPath();
            this.ctx.arc(hunter.pos.x, hunter.pos.y, hunter.radius + 10, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            if (hunter.isVeteran()) {
                this.ctx.fillStyle = '#3498db';
                this.ctx.font = 'bold 10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('VETERAN', hunter.pos.x, hunter.pos.y - hunter.radius - 15);
            } else {
                this.ctx.fillStyle = color;
                this.ctx.font = 'bold 10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    warningLevel === 2 ? 'REMOVE NEXT TURN!' : 'Camp Warning',
                    hunter.pos.x,
                    hunter.pos.y - hunter.radius - 15
                );
            }
            this.ctx.textAlign = 'left';
        });
    }
    
    drawGhostPreview(piece, ghostPos) {
        if (!piece || !ghostPos) return;
        
        this.ctx.save();
        this.ctx.globalAlpha = 0.35;
        
        this.ctx.fillStyle = piece.color;
        this.ctx.beginPath();
        this.ctx.arc(ghostPos.x, ghostPos.y, piece.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath();
        this.ctx.arc(ghostPos.x, ghostPos.y, piece.radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('preview', ghostPos.x, ghostPos.y - piece.radius - 10);
        this.ctx.textAlign = 'left';
        
        this.ctx.restore();
    }
    
    drawPieces(pieces, gameState) {
        pieces.forEach(p => {
            if (!p.isTiger && p.hasMoved && !gameState.winner) {
                this.ctx.save();
                this.ctx.globalAlpha = 0.5;
            }
            
            p.draw(this.ctx);
            
            if (!p.isTiger && p.hasMoved && !p.incapacitated && !p.isRemoved) {
                this.ctx.fillStyle = '#2ecc71';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('✓', p.pos.x, p.pos.y);
                this.ctx.textAlign = 'left';
            }
            
            if (!p.isTiger && p.hasMoved && !gameState.winner) {
                this.ctx.restore();
            }
        });
    }
    
    // UPDATED: Draw array of terrain pieces
    drawTerrain(terrainArray) {
        if (!terrainArray || terrainArray.length === 0) return;
        
        terrainArray.forEach((terrain, index) => {
            if (!terrain) return;
            
            this.ctx.save();
            this.ctx.translate(terrain.center.x, terrain.center.y);
            this.ctx.rotate(terrain.angle);
            
            // Different shade for small vs large
            const fillColor = index === 0 ? '#666666' : '#444444';
            const strokeColor = index === 0 ? '#333333' : '#111111';
            
            this.ctx.fillStyle = fillColor;
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(-terrain.width / 2, -terrain.height / 2, terrain.width, terrain.height);
            this.ctx.strokeRect(-terrain.width / 2, -terrain.height / 2, terrain.width, terrain.height);
            this.ctx.restore();
        });
    }
    
    drawStats(stats, difficultyName, rangeName) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(this.canvas.width - 200, 10, 190, 120);
        
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'right';
        let y = 30;
        this.ctx.fillText(`Size: ${difficultyName}`, this.canvas.width - 20, y);
        y += 15;
        this.ctx.fillText(`Reach: ${rangeName}`, this.canvas.width - 20, y);
        y += 15;
        this.ctx.fillText(`Total Moves: ${stats.totalMoves}`, this.canvas.width - 20, y);
        y += 15;
        this.ctx.fillText(`Pounce Chains: ${stats.pounceChains.length}`, this.canvas.width - 20, y);
        y += 15;
        this.ctx.fillText(`Camping Removals: ${stats.campingRemovals}`, this.canvas.width - 20, y);
        y += 15;
        this.ctx.fillText(`Avg Chain Length: ${stats.pounceChains.length > 0 
            ? (stats.pounceChains.reduce((a, c) => a + c.huntersPounced, 0) / stats.pounceChains.length).toFixed(1)
            : 0}`, this.canvas.width - 20, y);
        this.ctx.textAlign = 'left';
    }
    
    draw(pieces, gameState = {}) {
        this.clear();
        this.drawZones();
        
        const tigerRange = gameState.tiger?.getTigerRange?.() || Systems.HAND_SPAN;
        
        // Get visible hunters for this turn
        const visibleInRange = Systems.getHuntersInPounceRangeWithLOS(
            gameState.tiger?.pos || this.center,
            gameState.hunters || [],
            this.center,
            tigerRange,
            gameState.terrain || []
        );
        
        if (gameState.roarActive && gameState.turn === 'TIGER') {
            this.drawRoarEffect(gameState.tiger.pos, visibleInRange, tigerRange);
        }
        
        // Draw pounce range only if there are visible targets
        // if ((gameState.selectedPiece?.isTiger || gameState.roarActive || gameState.turn === 'TIGER') && visibleInRange.length > 0) {
        if ((gameState.turn === 'TIGER') && visibleInRange.length > 0) {
            this.drawPounceRange(gameState.tiger.pos, visibleInRange, this.center, tigerRange);
        }
        
        if (gameState.turn === 'HUNTERS' && !gameState.winner && gameState.gameInstance) {
            this.drawCampingWarnings(gameState.gameInstance);
        }
        
        if (gameState.winner === 'HUNTERS' && gameState.winningHunters) {
            this.drawVictoryTriangle(gameState.winningHunters);
        }
        
        // Draw both terrain pieces
        if (gameState.terrain && gameState.terrain.length > 0) {
            this.drawTerrain(gameState.terrain);
        }
        
        if (gameState.selectedPiece) {
            const range = gameState.selectedPiece.getMoveRange();
            this.drawRangeIndicator(gameState.selectedPiece.pos, range);
        }
        
        if (gameState.ghostPreview && !gameState.isAnimating) {
            this.drawGhostPreview(gameState.ghostPreview.piece, gameState.ghostPreview.position);
        }
        
        this.drawPieces(pieces, gameState);
        
        if (gameState.stats && gameState.gameInstance) {
            const diffName = Systems.DIFFICULTY_LEVELS[gameState.gameInstance.difficulty].name;
            const rangeName = Systems.TIGER_RANGE_MULTIPLIERS[gameState.gameInstance.tigerRangeMultiplier].name;
            this.drawStats(gameState.stats, diffName, rangeName);
        }
    }
}
