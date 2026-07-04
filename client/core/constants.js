// Shared gameplay constants for MONKEYALARM!

export const ROLES = {
  POLICE: 'police',
  MONKEY: 'monkey'
};

export const PHASES = {
  LOBBY: 'lobby',
  HIDING: 'hiding',
  SEEKING: 'seeking',
  ROUND_END: 'round_end'
};

// Game modes. Each entry describes how a round plays out.
// Availability: `solo: true` = offline only, `multiplayerOnly: true` = online only, neither = both.
export const MODES = {
  CLASSIC: {
    id: 'CLASSIC',
    name: 'Classic Hunt',
    description: 'Police must catch every monkey before the timer runs out. Monkeys win by surviving.',
    hideSeconds: 20,
    seekSeconds: 150,
    infection: false
  },
  INFECTION: {
    id: 'INFECTION',
    name: 'Banana Infection',
    description: 'One police to start. Every caught monkey joins the force. Last monkey standing wins.',
    hideSeconds: 15,
    seekSeconds: 180,
    infection: true,
    multiplayerOnly: true
  },
  TIME_ATTACK: {
    id: 'TIME_ATTACK',
    name: 'Time Attack',
    description: 'Solo/co-op vs AI monkeys. Catch all monkeys as fast as possible for a high score.',
    hideSeconds: 8,
    seekSeconds: 240,
    infection: false,
    solo: true
  },
  FREE_ROAM: {
    id: 'FREE_ROAM',
    name: 'Free Roam',
    description: 'Explore any map at your own pace. Great for learning the layouts.',
    hideSeconds: 0,
    seekSeconds: 0,
    infection: false,
    solo: true,
    freeRoam: true
  }
};

// Maps available in the game. `module` is a dynamic import factory so map code
// is only loaded when selected. Every map module must export a class extending
// MapBase (see MapBase.js for the required interface).
export const MAPS = {
  JUNGLE_TEMPLE: {
    id: 'JUNGLE_TEMPLE',
    name: 'Jungle Temple',
    theme: 'Overgrown ruins swallowed by the rainforest.',
    load: () => import('../maps/JungleTempleMap.js')
  },
  CITY_ZOO: {
    id: 'CITY_ZOO',
    name: 'City Zoo',
    theme: 'The zoo the monkeys just escaped from.',
    load: () => import('../maps/CityZooMap.js')
  },
  BANANA_FACTORY: {
    id: 'BANANA_FACTORY',
    name: 'Banana Factory',
    theme: 'A noisy industrial plant full of conveyor belts and crates.',
    load: () => import('../maps/BananaFactoryMap.js')
  },
  TREETOP_VILLAGE: {
    id: 'TREETOP_VILLAGE',
    name: 'Treetop Village',
    theme: 'Wooden platforms and rope bridges high in the canopy.',
    load: () => import('../maps/TreetopVillageMap.js')
  },
  MONKEY_BREAK: {
    id: 'MONKEY_BREAK',
    name: 'MonkeyBreak (Prison)',
    theme: 'A maximum-security primate penitentiary. The monkeys have broken out of their cells.',
    load: () => import('../maps/MonkeyBreakMap.js')
  },
  BANANA_BAY: {
    id: 'BANANA_BAY',
    name: 'Banana Bay Docks',
    theme: 'A sunset cargo harbor: containers, cranes and a moored freighter.',
    load: () => import('../maps/BananaBayMap.js')
  },
  SPACE_CENTER: {
    id: 'SPACE_CENTER',
    name: 'Banana Space Center',
    theme: 'A night launch site: rocket gantry, hangar and mission control.',
    load: () => import('../maps/SpaceCenterMap.js')
  }
};

export const PLAYER = {
  EYE_HEIGHT: 1.7,
  HEIGHT: 1.8, // collision box height
  STEP_HEIGHT: 0.45, // max ledge auto-stepped while grounded
  RADIUS: 0.35,
  WALK_SPEED: 5.2,
  SPRINT_SPEED: 8.4,
  MONKEY_WALK_SPEED: 5.4,
  MONKEY_SPRINT_SPEED: 7.6, // must stay below SPRINT_SPEED so police can close a chase
  JUMP_SPEED: 6.2,
  GRAVITY: 20.0,
  CATCH_RANGE: 3.6,
  CATCH_FOV_DOT: 0.25 // must be roughly facing the monkey to catch
};

export const CATCH_RANGE = PLAYER.CATCH_RANGE;

export const SCORING = {
  CATCH: 100,             // police points per catch
  SURVIVE: 150,           // monkey points for surviving the round
  LAST_MONKEY: 300,       // bonus for sole survivor in Infection
  TIME_BONUS_PER_SEC: 10  // Time Attack bonus per remaining second
};

export const NET = { PORT: 3010, SEND_HZ: 15 };

export const AI = {
  MONKEY_COUNT: 6,
  NAMES: ['Coco', 'Momo', 'Kiki', 'Bongo', 'Nana', 'Chichi', 'Gizmo', 'Bubbles']
};
