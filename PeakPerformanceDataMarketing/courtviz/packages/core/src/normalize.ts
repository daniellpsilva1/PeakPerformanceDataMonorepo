/**
 * Coordinate normalization utilities.
 *
 * Ported from DataViz/tennisviz/court.py:normalize_to_half_court and
 * normalize_shots_df with identical semantics.
 *
 * All shots are normalized so bounces land on the near half-court:
 * - If hitY > NET_Y (far end): keep bounce coords as-is
 * - If hitY <= NET_Y (near end): mirror (x' = -x, y' = COURT_LENGTH - y)
 */

import { COURT_LENGTH, NET_Y } from "./geometry";

/**
 * Whether hitY is within valid court bounds (SwingVision sometimes exports negative values).
 */
export function isValidHitY(hitY: number | null | undefined): boolean {
  return hitY != null && hitY >= 0 && hitY <= COURT_LENGTH;
}

/**
 * Whether a shot has coordinates suitable for spatial visualization layers.
 */
export function hasValidSpatialCoords(shot: {
  bounceX: number | null;
  bounceY: number | null;
  hitX?: number | null;
  hitY: number | null;
}): boolean {
  if (shot.bounceX == null || shot.bounceY == null) return false;
  if (!isValidHitY(shot.hitY)) return false;
  return true;
}

/**
 * Resolve hitY for normalization — invalid values default to far end.
 */
function resolveHitY(hitY: number | null | undefined): number {
  if (isValidHitY(hitY)) return hitY!;
  return COURT_LENGTH;
}

/**
 * Normalize bounce coordinates so all land on the near half-court.
 *
 * @param x - bounce_x values
 * @param y - bounce_y values
 * @param hitY - hit_y values for each shot. If null, assumes all from far end.
 * @returns [normalizedX, normalizedY] arrays
 */
export function normalizeToHalfCourt(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  hitY?: ArrayLike<number> | null,
): [number[], number[]] {
  const n = x.length;
  const xNorm = new Array<number>(n);
  const yNorm = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const hY = hitY ? resolveHitY(hitY[i]!) : COURT_LENGTH;
    const isNear = hY <= NET_Y;

    if (isNear) {
      xNorm[i] = -x[i]!;
      yNorm[i] = COURT_LENGTH - y[i]!;
    } else {
      xNorm[i] = x[i]!;
      yNorm[i] = y[i]!;
    }
  }

  return [xNorm, yNorm];
}

/**
 * Normalize a single shot's coordinates to the near half-court.
 */
export function normalizeShot(
  bounceX: number,
  bounceY: number,
  hitY: number,
): [number, number] {
  const isNear = resolveHitY(hitY) <= NET_Y;
  if (isNear) {
    return [-bounceX, COURT_LENGTH - bounceY];
  }
  return [bounceX, bounceY];
}

/**
 * Normalize hit coordinates to the near half-court.
 * Same mirroring logic as bounce normalization.
 */
export function normalizeHit(
  hitX: number,
  hitY: number,
): [number, number] {
  const isNear = resolveHitY(hitY) <= NET_Y;
  if (isNear) {
    return [-hitX, COURT_LENGTH - hitY];
  }
  return [hitX, hitY];
}

/**
 * Determine which end a player was at for a given shot.
 * @returns true if the player was at the far end (hitY > NET_Y)
 */
export function isFarEnd(hitY: number): boolean {
  return resolveHitY(hitY) > NET_Y;
}

/**
 * Interface for a row that has normalized coordinate columns.
 */
export interface NormalizedShot {
  bounceXNorm: number;
  bounceYNorm: number;
  hitXNorm: number;
  hitYNorm: number;
  isFar: boolean;
}

/**
 * Normalize a shot record, adding normalized coordinate fields.
 * Mirrors the Python normalize_shots_df function.
 */
export function normalizeShotRecord<T extends {
  bounceX: number | null;
  bounceY: number | null;
  hitX: number | null;
  hitY: number | null;
}>(shot: T): T & NormalizedShot {
  const hitY = resolveHitY(shot.hitY);
  const far = hitY > NET_Y;

  if (far) {
    return {
      ...shot,
      bounceXNorm: shot.bounceX ?? 0,
      bounceYNorm: shot.bounceY ?? 0,
      hitXNorm: shot.hitX ?? 0,
      hitYNorm: shot.hitY ?? 0,
      isFar: true,
    };
  }

  return {
    ...shot,
    bounceXNorm: shot.bounceX != null ? -shot.bounceX : 0,
    bounceYNorm: shot.bounceY != null ? COURT_LENGTH - shot.bounceY : 0,
    hitXNorm: shot.hitX != null ? -shot.hitX : 0,
    hitYNorm: shot.hitY != null ? COURT_LENGTH - shot.hitY : 0,
    isFar: false,
  };
}
