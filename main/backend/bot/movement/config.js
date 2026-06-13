export const WANDER_MIN_RADIUS = 6;
export const WANDER_MAX_RADIUS = 18;
export const WANDER_VERTICAL_RANGE = 4;
export const WANDER_INTERVAL_MIN_MS = 18000;
export const WANDER_INTERVAL_MAX_MS = 40000;
export const WANDER_IDLE_GRACE_MS = 25000;
export const WANDER_GOAL_TOLERANCE = 2;
export const WANDER_POI_CHANCE = 0.55;
export const WANDER_PAUSE_CHANCE = 0.25;
export const WANDER_PAUSE_MS = 3000;
export const WANDER_RETREAD_MEMORY = 5;
export const WANDER_RETREAD_MIN_DIST = 5;
export const WANDER_NIGHT_SLOWDOWN = 2.0;

export const HOME_DRIFT_MAX = 40;
export const HOME_RETURN_RADIUS = 8;

export const POI_SCAN_RADIUS = 20;
export const POI_MAX_CANDIDATES = 24;

export const FOLLOW_DISTANCE = 3;
export const FOLLOW_REPATH_MS = 700;
export const FOLLOW_LOST_TIMEOUT_MS = 12000;
export const FOLLOW_MAX_RANGE = 64;

export const TAIL_DISTANCE = 7;

export const COME_DISTANCE = 2;
export const ESCORT_DISTANCE = 4;
export const ESCORT_LEAD_AHEAD = 3;
export const ESCORT_WAIT_GAP = 8;
export const ESCORT_REPATH_MS = 900;

export const GUARD_RETURN_RADIUS = 4;
export const GUARD_CHECK_MS = 1500;

export const GOTO_TOLERANCE = 1;
export const GOTO_TIMEOUT_MS = 60000;

export const FLEE_DISTANCE = 16;
export const FLEE_SAMPLE_POINTS = 12;
export const FLEE_REPATH_MS = 800;
export const FLEE_DURATION_MS = 8000;

export const RANGED_KEEP_DISTANCE = 10;
export const MELEE_CLOSE_DISTANCE = 2;
export const CREEPER_DODGE_RANGE = 4;
export const RETREAT_SCAN_RADIUS = 16;

export const PERSONAL_SPACE = 1.5;
export const PERSONAL_SPACE_CHECK_MS = 1200;

export const STUCK_CHECK_MS = 2000;
export const STUCK_MIN_DELTA = 0.6;
export const STUCK_GRACE_TICKS = 4;
export const GOAL_START_GRACE_MS = 4000;

export const LOOK_AT_DISTANCE = 16;
export const ARRIVAL_POLL_MS = 400;

export const WAYPOINT_REACH = 2;
export const PATROL_REACH = 2;
export const PATROL_PAUSE_MS = 1500;
export const QUEUE_REACH = 2;

export const CLIMB_SCAN_RADIUS = 12;
export const CLIMB_MIN_GAIN = 3;
export const DESCEND_SCAN_RADIUS = 12;
export const DESCEND_MIN_DROP = 3;

export const LIGHT_SCAN_RADIUS = 24;
export const NIGHT_LIGHT_THRESHOLD = 7;

export const DOOR_SCAN_RADIUS = 12;
export const EDGE_DROP_DANGER = 4;

export const GESTURE_GAP_MS = 350;
export const MID_WALK_PAUSE_CHANCE = 0.12;
export const MID_WALK_PAUSE_MS = 1200;

export const SWIM_CHECK_MS = 300;
export const SWIM_OXYGEN_LOW = 8;
export const SWIM_SURFACE_PROBE = 2;

export const RIDE_SCAN_RADIUS = 12;
export const RIDE_MOUNT_REACH = 2;
export const RIDEABLE = new Set([
  "boat", "chest_boat", "minecart", "chest_minecart", "hopper_minecart",
  "horse", "donkey", "mule", "skeleton_horse", "zombie_horse",
  "pig", "strider", "camel", "llama", "trader_llama",
]);

export const SPEED = {
  SNEAK: "sneak",
  WALK: "walk",
  SPRINT: "sprint",
};

export const PRIORITY = {
  idle: 0,
  wander: 1,
  tail: 2,
  goto: 2,
  follow: 2,
  escort: 2,
  guard: 2,
  gather: 2,
  mirror: 2,
  patrol: 2,
  queue: 2,
  seeklight: 2,
  come: 3,
  flee: 4,
};

export const MODE = {
  IDLE: "idle",
  WANDER: "wander",
  GOTO: "goto",
  COME: "come",
  FOLLOW: "follow",
  TAIL: "tail",
  ESCORT: "escort",
  GUARD: "guard",
  GATHER: "gather",
  MIRROR: "mirror",
  FLEE: "flee",
  PATROL: "patrol",
  QUEUE: "queue",
  SEEKLIGHT: "seeklight",
};

export const MODE_STOP_DISTANCE = {
  [MODE.COME]: COME_DISTANCE,
  [MODE.FOLLOW]: FOLLOW_DISTANCE,
  [MODE.TAIL]: TAIL_DISTANCE,
  [MODE.ESCORT]: ESCORT_DISTANCE,
  [MODE.GOTO]: GOTO_TOLERANCE,
  [MODE.GATHER]: COME_DISTANCE,
  [MODE.PATROL]: PATROL_REACH,
  [MODE.QUEUE]: QUEUE_REACH,
};
