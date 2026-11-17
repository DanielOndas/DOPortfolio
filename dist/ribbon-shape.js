'use strict';

// Both views use the same surface. u travels around the loop and v around its section.
function ribbonPoint(u, v) {
  const radius = 1.35 + .37 * Math.cos(v);
  return {x: radius * Math.cos(u), y: radius * Math.sin(u), z: .37 * Math.sin(v) + .36 * Math.sin(3 * u)};
}
