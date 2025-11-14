import { Vector2 } from './entities.js';

export const HAND_SPAN = 150;
export const CLEARING_RADIUS = 300;
export const BORDERLANDS_WIDTH = HAND_SPAN;

export function distance(p1, p2) {
    return p1.distanceTo(p2);
}

export function isInClearing(pos, center) {
    return distance(pos, center) <= CLEARING_RADIUS;
}

export function isInBorderlands(pos, center) {
    const dist = distance(pos, center);
    return dist > CLEARING_RADIUS && dist <= CLEARING_RADIUS + BORDERLANDS_WIDTH;
}

export function getPounceTargets(fromPos, hunters, center, tigerRadius = 30) {
    return hunters
        .filter(h => {
            // Skip incapacitated/removed hunters
            if (h.incapacitated || h.isRemoved) return false;
            
            // Must be in Clearing to be pounced
            if (!isInClearing(h.pos, center)) return false;
            
            // Edge-to-edge collision detection
            const centerDistance = distance(fromPos, h.pos);
            const edgeDistance = centerDistance - tigerRadius - h.radius;
            
            // If edges overlap or touch, it's a valid pounce
            return edgeDistance <= 0;
        })
        .sort((a, b) => distance(fromPos, a.pos) - distance(fromPos, b.pos));
}

export function isPointInTriangle(point, vertices) {
    const [A, B, C] = vertices;
    
    const denominator = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    const a = ((B.y - C.y) * (point.x - C.x) + (C.x - B.x) * (point.y - C.y)) / denominator;
    const b = ((C.y - A.y) * (point.x - C.x) + (A.x - C.x) * (point.y - C.y)) / denominator;
    const c = 1 - a - b;
    
    return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
}

export function checkHunterVictory(tiger, hunters, center) {
    // Only active hunters in Clearing can form triangle
    const activeInClearing = hunters.filter(h => 
        !h.incapacitated && !h.isRemoved && isInClearing(h.pos, center)
    );
    
    if (activeInClearing.length < 3) return { won: false };
    
    // Check all possible 3-hunter combinations
    for (let i = 0; i < activeInClearing.length - 2; i++) {
        for (let j = i + 1; j < activeInClearing.length - 1; j++) {
            for (let k = j + 1; k < activeInClearing.length; k++) {
                const combo = [activeInClearing[i], activeInClearing[j], activeInClearing[k]];
                const vertices = combo.map(h => h.pos);
                
                // Tiger must be within HAND_SPAN of all three
                const allInRange = combo.every(h => distance(tiger.pos, h.pos) <= HAND_SPAN);
                if (!allInRange) continue;
                
                // Tiger must be inside triangle formed by hunters
                if (isPointInTriangle(tiger.pos, vertices)) {
                    return { won: true, hunters: combo };
                }
            }
        }
    }
    
    return { won: false };
}

export function checkTigerVictory(hunters) {
    // Tiger wins if ALL hunters are either incapacitated or removed
    return hunters.every(h => h.incapacitated || h.isRemoved);
}
