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

// NEW: Check collision for landing
export function getLandedHunter(tigerPos, hunters, tigerRadius) {
    return hunters.find(h => 
        !h.incapacitated && !h.isRemoved && 
        distance(tigerPos, h.pos) <= tigerRadius + h.radius
    );
}

// NEW: Get hunters within HAND_SPAN (pounce range)
export function getHuntersInPounceRange(fromPos, hunters, center, range) {
    return hunters
        .filter(h => {
            if (h.incapacitated || h.isRemoved) return false;
            if (!isInClearing(h.pos, center)) return false;
            
            const dist = distance(fromPos, h.pos);
            return dist <= range;
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
    const activeInClearing = hunters.filter(h => 
        !h.incapacitated && !h.isRemoved && isInClearing(h.pos, center)
    );
    
    if (activeInClearing.length < 3) return { won: false };
    
    for (let i = 0; i < activeInClearing.length - 2; i++) {
        for (let j = i + 1; j < activeInClearing.length - 1; j++) {
            for (let k = j + 1; k < activeInClearing.length; k++) {
                const combo = [activeInClearing[i], activeInClearing[j], activeInClearing[k]];
                const vertices = combo.map(h => h.pos);
                
                const allInRange = combo.every(h => distance(tiger.pos, h.pos) <= HAND_SPAN);
                if (!allInRange) continue;
                
                if (isPointInTriangle(tiger.pos, vertices)) {
                    return { won: true, hunters: combo };
                }
            }
        }
    }
    
    return { won: false };
}

export function checkTigerVictory(hunters) {
    return hunters.every(h => h.incapacitated || h.isRemoved);
}
