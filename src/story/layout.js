// The story realm's spatial plan (Part Two + Part Three), shared by builders, AI, triggers and the
// transitions. Local coordinates: x east, z south (+z toward the road), y up; the reception's front
// wall faces south onto the lot. Everything is offset by S in the world. The Backrooms are a long,
// low, windowless annex ("Building C") behind the reception. The hallway doglegs right after the
// wrecked chair, so no daylight ever reaches far inside, and the sun is switched off while you are
// in there. The looping corridor is a run of identical AUTHORIZED PERSONNEL ONLY doors: walk
// through the seam door and you are quietly moved one door back.
import * as THREE from 'three';

export const S = new THREE.Vector3(400, -400, -400);
export const FLOOR = 0.15; // sidewalk / interior floor height

export const SL = {
  lectern: new THREE.Vector3(3.4, FLOOR, -10.6),
  arrival: new THREE.Vector3(2.2, 0, -6.2), arrivalYaw: -0.22,
  emptySpot: new THREE.Vector3(-4.2, 0, -6.0), // where the car was
  moss: new THREE.Vector3(-6.4, 0, -4.4),
  pylon: new THREE.Vector3(-25, 0, 4),
  // reception box
  rx0: -16, rx1: 16, rz0: -34, rz1: -14, rH: 5.2, ceil: 3.1,
  door: [2, 4.4], window1: [-13, -2], window2: [8, 13],
  counter: new THREE.Vector3(-8, FLOOR, -21.5),
  hrDesk: new THREE.Vector3(5.2, FLOOR, -27.2),
  corridor: [8, 11],
  treeline: { x0: -110, x1: -52, z0: -80, z1: 40 },
  // backrooms rooms (cells of 1 m; see backrooms.js)
  tile: new THREE.Vector3(12.5, 0, -56.5), // the ceiling tile that falls
  branchZ: -66,
  office: { x0: 6, x1: 24, z0: -98, z1: -82 },
  loop: { x0: 24, x1: 92, z0: -92, z1: -89, doors: [33, 48, 63, 78], seam: 63, back: 15, loops: 2 },
  freedomDoorX: 92,
  exitDoorX: 88, worksDoorX: 84,
  desk: new THREE.Vector3(12, FLOOR, -92),
};
