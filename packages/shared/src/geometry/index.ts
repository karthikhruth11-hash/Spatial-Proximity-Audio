export interface Point2D {
  x: number;
  y: number;
}

export interface Segment2D {
  p1: Point2D;
  p2: Point2D;
}

export interface Box2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle2D {
  center: Point2D;
  radius: number;
}

/**
 * Calculates Euclidean distance between two planar points:
 * d = sqrt((x2 - x1)^2 + (y2 - y1)^2)
 */
export function euclideanDistance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Calculates squared distance between two planar points.
 * Use for hot paths (e.g. comparing distance against threshold squared).
 */
export function distanceSquared(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Helper to check orientation of triplet (p, q, r).
 * 0 -> p, q and r are collinear
 * 1 -> Clockwise
 * 2 -> Counterclockwise
 */
function getOrientation(p: Point2D, q: Point2D, r: Point2D): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0; // collinear
  return val > 0 ? 1 : 2;
}

/**
 * Checks if point q lies on line segment 'pr' when p, q, r are collinear
 */
function onSegment(p: Point2D, q: Point2D, r: Point2D): boolean {
  return (
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y)
  );
}

/**
 * Robust segment-segment intersection using orientation / cross-product method,
 * handling collinear, parallel, and touching endpoint cases.
 */
export function segmentsIntersect(
  p1: Point2D,
  q1: Point2D,
  p2: Point2D,
  q2: Point2D,
): boolean {
  const o1 = getOrientation(p1, q1, p2);
  const o2 = getOrientation(p1, q1, q2);
  const o3 = getOrientation(p2, q2, p1);
  const o4 = getOrientation(p2, q2, q1);

  // General case: lines cross each other
  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  // Collinear and touching endpoint / overlapping cases
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

/**
 * Check if a point is within an axis-aligned bounding box.
 */
export function pointInBox(p: Point2D, box: Box2D): boolean {
  return (
    p.x >= box.x &&
    p.x <= box.x + box.width &&
    p.y >= box.y &&
    p.y <= box.y + box.height
  );
}

/**
 * Clamp point within office boundaries.
 */
export function clampPoint(p: Point2D, bounds: Box2D): Point2D {
  return {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, p.x)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, p.y)),
  };
}

/**
 * Check if a circle intersects an axis-aligned bounding box (AABB)
 */
export function circleIntersectsBox(circle: Circle2D, box: Box2D): boolean {
  // Find closest point on box to circle center
  const closestX = Math.max(box.x, Math.min(circle.center.x, box.x + box.width));
  const closestY = Math.max(box.y, Math.min(circle.center.y, box.y + box.height));

  const distanceSq = distanceSquared(circle.center, { x: closestX, y: closestY });
  return distanceSq <= circle.radius * circle.radius;
}

/**
 * Calculates squared distance from point p to line segment (p1, p2)
 */
export function distanceToSegmentSquared(
  p: Point2D,
  p1: Point2D,
  p2: Point2D,
): number {
  const l2 = distanceSquared(p1, p2);
  if (l2 === 0) return distanceSquared(p, p1);

  // Consider line extending the segment, parameterized as p1 + t (p2 - p1).
  // Projection factor t of point p onto the segment.
  const t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
  const clampedT = Math.max(0, Math.min(1, t));

  const projection = {
    x: p1.x + clampedT * (p2.x - p1.x),
    y: p1.y + clampedT * (p2.y - p1.y),
  };

  return distanceSquared(p, projection);
}

/**
 * Check if a circle intersects a line segment
 */
export function circleIntersectsSegment(
  circle: Circle2D,
  segment: Segment2D,
): boolean {
  const distSq = distanceToSegmentSquared(circle.center, segment.p1, segment.p2);
  return distSq <= circle.radius * circle.radius;
}

/**
 * Determine grid cell coordinates for a point given grid cell size.
 */
export function getGridCellCoords(
  p: Point2D,
  cellSize: number,
): { cellX: number; cellY: number } {
  return {
    cellX: Math.floor(p.x / cellSize),
    cellY: Math.floor(p.y / cellSize),
  };
}

/**
 * Convert cell coordinates into a hash key "cellX:cellY"
 */
export function getGridCellKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`;
}
