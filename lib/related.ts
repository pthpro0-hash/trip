import type { Spot } from "./types";

export function getRelatedSpots(spots: Spot[], current: Spot, count: number): Spot[] {
  return spots.filter((s) => s.region === current.region && s.id !== current.id).slice(0, count);
}
