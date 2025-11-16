import { Vector2 } from './entities.js';
import * as Systems from './systems.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.center = new Vector2(canvas.width / 2, canvas.height / 2);
        this.shadowColor = 'rgba(0, 0, 0, 0.25)'; // 25% black overlay
    }

    // === NEW: 2D Shadow Casting ===
    drawShadows(tigerPos, terrainArray) {
        if (!terrainArray || terrainArray.length === 0) return;

        // Build list of angles to cast rays at
        const angles = new Set();
        const rayCount = 120; // 3 degree increments for smooth shadows
        
        // Add angles to each terrain corner
        terrainArray.forEach(terrain => {
            if (!terrain) return;
            const corners = this.getTerrainCorners(terrain);
            corners.forEach(corner => {
                const angle = Math.atan2(corner.y - tigerPos.y, corner.x - tigerPos.x);
                angles.add(angle);
                // Add tiny offsets to handle edge cases
                angles.add(angle - 0.001);
                angles.add(angle + 0.001);
            });
        });
        
        // Fill in regular intervals for smoothness
        for (let i = 0; i < rayCount; i++) {
            angles.add((i / rayCount) * Math.PI * 2);
        }

        // Cast rays and find intersection points
        const intersectionPoints = [];
        
        angles.forEach(angle => {
            const rayEnd = new Vector2(
                tigerPos.x + Math.cos(angle) * 1000,
                tigerPos.y + Math.sin(angle) * 1000
            );
            
            let closestIntersect = null;
            let minDist = Infinity;
            
            // Check intersection with each terrain piece
            terrainArray.forEach(terrain => {
                if (!terrain) return;
                const intersect = this.rayIntersectsRectangle(tigerPos, rayEnd, terrain);
                if (intersect) {
                    const dist = Systems.distance(tigerPos, intersect);
                    if (dist < minDist) {
                        minDist = dist;
                        closestIntersect = intersect;
                    }
                }
            });
            
            // If no intersection, ray hits clearing boundary
            if (!closestIntersect) {
                // Clamp to clearing radius
                const clearingEdge = Systems.CLEARING_RADIUS;
                closestIntersect = new Vector2(
                    tigerPos.x + Math.cos(angle) * clearingEdge,
                    tigerPos.y + Math.sin(angle) * clearingEdge
                );
            }
            
            intersectionPoints.push({
                point: closestIntersect,
                angle: angle
            });
        });
        
        // Sort points by angle to create polygon
        intersectionPoints.sort((a, b) => a.angle - b.angle);
        
        // Draw shadow overlay with cut-out visibility polygon
        this.ctx.save();
        this.ctx.fillStyle = this.shadowColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Cut out the visible area
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.beginPath();
        this.ctx.moveTo(intersectionPoints[0].point.x, intersectionPoints[0].point.y);
        intersectionPoints.forEach(p => {
            this.ctx.lineTo(p.point.x, p.point.y);
        });
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.restore();
    }

    // Helper: Get 4 corners of a terrain rectangle
    getTerrainCorners(terrain) {
        const corners = [
            new Vector2(terrain.center.x - terrain.width / 2, terrain.center.y - terrain.height / 2),
            new Vector2(terrain.center.x + terrain.width / 2, terrain.center.y - terrain.height / 2),
            new Vector2(terrain.center.x + terrain.width / 2, terrain.center.y + terrain.height / 2),
            new Vector2(terrain.center.x - terrain.width / 2, terrain.center.y + terrain.height / 2)
        ];
        
        // Rotate corners
        const cos = Math.cos(terrain.angle);
        const sin = Math.sin(terrain.angle);
        return corners.map(c => new Vector2(
            terrain.center.x + (c.x - terrain.center.x) * cos - (c.y - terrain.center.y) * sin,
            terrain.center.y + (c.x - terrain.center.x) * sin + (c.y - terrain.center.y) * cos
        ));
    }

    // Helper: Ray-rectangle intersection
    rayIntersectsRectangle(rayStart, rayEnd, terrain) {
        const corners = this.getTerrainCorners(terrain);
        let closestIntersect = null;
        let minDist = Infinity;
        
        for (let i = 0; i < 4; i++) {
            const p1 = corners[i];
            const p2 = corners[(i + 1) % 4];
            const intersect = this.lineSegmentsIntersect(rayStart, rayEnd, p1, p2);
            
            if (intersect) {
                const dist = Systems.distance(rayStart, intersect);
                if (dist < minDist) {
                    minDist = dist;
                    closestIntersect = intersect;
                }
            }
        }
        
        return closestIntersect;
    }

    // Helper: Two line segments intersection
    lineSegmentsIntersect(p0, p1, p2, p3) {
        const A1 = p1.y - p0.y;
        const B1 = p0.x - p1.x;
        const C1 = A1 * p0.x + B1 * p0.y;
        
        const A2 = p3.y - p2.y;
        const B2 = p2.x - p3.x;
        const C2 = A2 * p2.x + B2 * p2.y;
        
        const det = A1 * B2 - A2 * B1;
        
        if (Math.abs(det) < 0.001) return null; // Parallel
        
        const x = (B2 * C1 - B1 * C2) / det;
        const y = (A1 * C2 - A2 * C1) / det;
        
        // Check if intersection is within both segments
        if (this.isPointOnSegment(x, y, p0, p1) && this.isPointOnSegment(x, y, p2, p3)) {
            return new Vector2(x, y);
        }
        
        return null;
    }

    isPointOnSegment(x, y, p1, p2) {
        return (x >= Math.min(p1.x, p2.x) - 0.001 && x <= Math.max(p1.x, p2.x) + 0.001 &&
                y >= Math.min(p1.y, p2.y) - 0.001 && y <= Math.max(p1.y, p2.y) + 0.001);
    }

    // === Existing methods (unchanged) ===
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

    // NEW: Updated to draw both terrain pieces
    drawTerrain(terrainArray) {
        if (!terrainArray || terrainArray.length === 0) return;
        
        terrainArray.forEach((terrain, index) => {
            if (!terrain) return;
            
            this.ctx.save();
            this.ctx.translate(terrain.center.x, terrain.center.y);
            this.ctx.rotate(terrain.angle);
            
            // Small terrain: lighter gray, Large terrain: darker
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

    // MODIFIED: Now calls drawShadows
    draw(pieces, gameState = {}) {
        this.clear();
        this.drawZones();
        
        // === DRAW SHADOWS FIRST (behind everything) ===
        if (gameState.terrain && gameState.terrain.length > 0 && gameState.tiger) {
            this.drawShadows(gameState.tiger.pos, gameState.terrain);
        }
        
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
        
        if ((gameState.turn === 'TIGER') && visibleInRange.length > 0) {
            this.drawPounceRange(gameState.tiger.pos, visibleInRange, this.center, tigerRange);
        }
        
        if (gameState.turn === 'HUNTERS' && !gameState.winner && gameState.gameInstance) {
            this.drawCampingWarnings(gameState.gameInstance);
        }
        
        if (gameState.winner === 'HUNTERS' && gameState.winningHunters) {
            this.drawVictoryTriangle(gameState.winningHunters);
        }
        
        // Draw terrain (on top of shadows, but below pieces)
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
        
        // Draw pieces last (on top)
        this.drawPieces(pieces, gameState);
        
        if (gameState.stats && gameState.gameInstance) {
            const diffName = Systems.DIFFICULTY_LEVELS[gameState.gameInstance.difficulty].name;
            const rangeName = Systems.TIGER_RANGE_MULTIPLIERS[gameState.gameInstance.tigerRangeMultiplier].name;
            this.drawStats(gameState.stats, diffName, rangeName);
        }
    }
}
