import { Vector2 } from './entities.js';

export const HAND_SPAN = 150;
export const CLEARING_RADIUS = 300;
export const BORDERLANDS_WIDTH = HAND_SPAN;

export const DIFFICULTY_LEVELS = {
    1: { name: 'Massive', pct: 100 },
    2: { name: 'Large', pct: 80 },
    3: { name: 'Normal', pct: 60 },
    4: { name: 'Small', pct: 40 },
    5: { name: 'Tiny', pct: 20 }
};

export const TIGER_RANGE_MULTIPLIERS = {
    0.5: { name: 'Sluggish' },
    0.7: { name: 'Compact' },
    1.0: { name: 'Standard' },
    1.3: { name: 'Long' },
    1.5: { name: 'Extended' }
};

export const HUNTER_SPECIALS = {
    scout: { moveMultiplier: 1.5, symbol: 'S' },
    veteran: { moveMultiplier: 1.0, symbol: 'V', immuneToCamping: true },
    medic: { moveMultiplier: 1.0, symbol: 'M', rescueRange: 50 },
    standard: { moveMultiplier: 1.0, symbol: '' }
};

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

export function getLandedHunter(tigerPos, hunters, tigerRadius) {
    return hunters.find(h => 
        !h.incapacitated && !h.isRemoved && 
        distance(tigerPos, h.pos) <= tigerRadius + h.radius
    );
}

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

export function getEquidistantHunters(fromPos, hunters, center, range) {
    const sorted = getHuntersInPounceRange(fromPos, hunters, center, range);
    if (sorted.length < 2) return [];
    const firstDist = distance(fromPos, sorted[0].pos);
    return sorted.filter(h => Math.abs(distance(fromPos, h.pos) - firstDist) < 1);
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
                if (combo.every(h => distance(tiger.pos, h.pos) <= HAND_SPAN) && 
                    isPointInTriangle(tiger.pos, vertices)) {
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
