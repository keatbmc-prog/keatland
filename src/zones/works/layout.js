// The Catecholamine Works: Keatland Neurochemical Industries' factory floor, behind the locked
// steel door in the Backrooms. Its own realm far out in the shared scene. All positions below
// are LOCAL to WORKS (x east, z south, y up, floor at 0). The hall is 64 x 88 m and 28 m tall.
import * as THREE from 'three';

export const WORKS = new THREE.Vector3(-500, -300, -600);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const WL = {
  hx: 32, hz: 44, roof: 28,                     // half-extents and roof height
  catwalkY: 9,                                   // the ring catwalk around the hall
  // the way in: a steel door high in the north wall, a landing, then a spiral stair to the floor
  door: V(20, 14, -44), landing: { x0: 14, x1: 26, z0: -44, z1: -40.5, y: 14 },
  stair: { c: V(20, 0, -35.5), r: 3.4, y0: 14, turns: 2.5, aTop: -Math.PI * 0.5 },
  stairFoot: V(21.6, 0, -31.2),              // where you step off the stair (and E to leave)
  arrival: V(23, 0, -28.6), arrivalYaw: 2.5,
  // the drain, the plates around it, and the Jettison Hold beneath
  drain: V(0, 0, 2), plateR: 7.2, holdDepth: 130,
  // the bolted-down vat everyone hauls the chain from
  pullVat: V(9.5, 0, 4.0), pullVatR: 2.3, pullVatH: 2.3,
  // the bottling line: conveyor along x at z=26, machines at both ends, the dopamine pipe above
  conveyor: { x0: -16, x1: 16, z: 26, y: 1.05 },
  bottler: V(-12.5, 0, 22.2), bottlerTop: 1.65,  // the machine housing Moss is washed onto
  dopaPipeY: 2.75,
  // the NOREPINEPHRINE pipe: valve wheel and gauge, east of the line
  norPipe: V(17.5, 0, 19.5),
  // the giant doors the tide comes through (west wall)
  bigDoors: { x: -32, z0: -8, z1: 8, h: 16 },
  // FREEDOMLAND, lit over a door on the east wall
  freedom: V(32, 0, -8),
  // the Cathartic Jettison Protocol panel, on a bulkhead pier facing the drain
  cjp: V(-8.6, 0, 6.2), cjpYaw: -2.3,
  // monitor bank + clock over the bottling machinery, facing north
  monitors: V(0, 10.8, 31.4),
  // the gantry the worker shouts from
  gantry: V(-6, 9, -41.2),
  // vats (x, z, radius, height)
  vats: [[-21, -26, 4.2, 13], [-21, -10, 4.2, 13], [-22, 10, 4.6, 15], [21, -14, 4.2, 12], [22, 2, 3.8, 11], [-21, 26, 3.6, 10]],
  // glass reaction columns along the walls
  columns: [[-28, -36], [-28, 18], [28, -30], [28, 12], [28, 34], [-28, 36], [-12, -38], [6, -38]],
  // high grimy windows in the south wall that let the light in
  windowsZ: 44, windows: [-22, -11, 0, 11, 22],
  // where things stand
  spots: {
    keatenTour: V(4, 0, 14), daleValve: V(17.5, 0, 18.4), mossStand: V(10, 0, 12),
    keatenRail: V(-9.5, 0, 22.8), daleWaist: V(4, 0, 18),
    chair: V(0, 0, 13.2),
  },
};
