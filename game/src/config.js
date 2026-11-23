// Solmar Bay — tuning constants. One place for every number the game balances on.
export const CFG = {
  // City grid
  roadSpacing: 74,          // distance between road centerlines
  roadWidth: 14,
  roadLines: [-222, -148, -74, 0, 74, 148, 222],
  cityHalf: 262,            // playable ground half-size (buildings zone)
  sandStart: 266,           // beach sand begins here (east edge)
  waterStart: 330,          // ocean begins here
  worldBound: 336,          // hard clamp for the player
  // Player on foot
  walkSpeed: 7,
  sprintSpeed: 12,
  jumpSpeed: 8.5,
  playerRadius: 0.7,
  playerHealth: 100,
  // Driving
  carAccel: 26,
  carReverseAccel: 16,
  carMaxSpeed: 46,
  carMaxReverse: 14,
  carSteer: 1.9,
  carBrake: 34,
  carRadius: 1.6,
  // Combat
  pistolDamage: 34,
  pistolRange: 90,
  pistolMag: 12,
  pistolReloadMs: 900,
  enemyHealth: 100,
  copHealth: 100,
  // Wanted
  wantedDecayMs: 26000,
  maxWanted: 5,
  // Missions
  markerRadius: 7,
  // Traffic / pedestrians
  trafficCars: 11,
  pedestrians: 14,
  // Coins
  coins: 10,
};
