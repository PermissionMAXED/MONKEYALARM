export const DIFFICULTY_CONFIG = {
  easy: {
    speedMult: 0.8, fleeRadius: 7, fleeRadiusSq: 49,
    jukeIntervalMin: 1.5, jukeIntervalMax: 3.0, jukeDuration: 0.25, jukeAngle: 0.8,
    hopInterval: 2.5, stuckMinDist: 0.2, hideQuality: 0.3, reactionSkipTicks: 2
  },
  medium: {
    speedMult: 1.0, fleeRadius: 9, fleeRadiusSq: 81,
    jukeIntervalMin: 0.9, jukeIntervalMax: 1.8, jukeDuration: 0.35, jukeAngle: 1.1,
    hopInterval: 1.5, stuckMinDist: 0.3, hideQuality: 0.6, reactionSkipTicks: 0
  },
  hard: {
    speedMult: 1.2, fleeRadius: 11, fleeRadiusSq: 121,
    jukeIntervalMin: 0.6, jukeIntervalMax: 1.2, jukeDuration: 0.45, jukeAngle: 1.4,
    hopInterval: 0.9, stuckMinDist: 0.4, hideQuality: 0.9, reactionSkipTicks: 0
  }
};

export const AI_NAMES = ['Coco','Momo','Kiki','Bongo','Nana','Chichi','Gizmo','Bubbles'];
