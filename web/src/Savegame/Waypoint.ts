import { Target } from "./Target.ts";

/**
 * Represents a fixed waypoint on the world.
 */
export class Waypoint extends Target {
  getType(): string {
    return "STR_WAY_POINT";
  }

  getMarker(): number {
    return 6;
  }
}
