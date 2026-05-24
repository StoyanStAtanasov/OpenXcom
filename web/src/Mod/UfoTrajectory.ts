import { ALTITUDE_STRING } from "../Savegame/Ufo.ts";

export type TrajectoryWaypoint = {
  zone: number;
  altitude: number;
  speed: number;
};

export type UfoTrajectoryDefinition = {
  id: string;
  groundTimer?: number;
  waypoints: TrajectoryWaypoint[];
};

function stripComment(line: string): string {
  let quoted = false;
  let quote = "";
  for (let i = 0; i < line.length; ++i) {
    const ch = line[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || line[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    }
    if (ch === "#" && !quoted) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseNumberList(value: string): number[] {
  const match = /^\[\s*(.*)\s*\]$/.exec(value.trim());
  if (!match) {
    return [];
  }
  const values: number[] = [];
  for (const part of match[1].split(",")) {
    const number = Number(part.trim());
    if (!Number.isFinite(number)) {
      return [];
    }
    values.push(number);
  }
  return values;
}

export class UfoTrajectory {
  static RETALIATION_ASSAULT_RUN = "__RETALIATION_ASSAULT_RUN";

  private _groundTimer = 5;
  private _waypoints: TrajectoryWaypoint[] = [];

  constructor(private _id: string) {}

  getID(): string {
    return this._id;
  }

  load(node: UfoTrajectoryDefinition): void {
    this._id = node.id || this._id;
    this._groundTimer = node.groundTimer ?? this._groundTimer;
    this._waypoints = node.waypoints.map(waypoint => ({ ...waypoint }));
  }

  getWaypointCount(): number {
    return this._waypoints.length;
  }

  getZone(wp: number): number {
    return this._waypoints[wp].zone;
  }

  getAltitude(wp: number): string {
    return ALTITUDE_STRING[this._waypoints[wp].altitude] || "";
  }

  applySpeedPercentage(wp: number, baseSpeed: number): number {
    return Math.trunc(baseSpeed * this._waypoints[wp].speed / 100);
  }

  groundTimer(): number {
    return this._groundTimer;
  }
}

export function parseUfoTrajectoriesRul(source: string): UfoTrajectoryDefinition[] {
  const definitions: UfoTrajectoryDefinition[] = [];
  let current: UfoTrajectoryDefinition | null = null;
  let inWaypoints = false;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("ufoTrajectories:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const start = /^-\s+id:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && start) {
      current = { id: unquote(start[1]), waypoints: [] };
      definitions.push(current);
      inWaypoints = false;
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      inWaypoints = prop[1] === "waypoints";
      if (prop[1] === "groundTimer") {
        const n = Number(prop[2]);
        if (Number.isFinite(n)) {
          current.groundTimer = n;
        }
      }
      continue;
    }

    if (inWaypoints && indent === 6) {
      const waypointStart = /^-\s+(\[.*\])$/.exec(trimmed);
      if (waypointStart) {
        const values = parseNumberList(waypointStart[1]);
        if (values.length === 3) {
          current.waypoints.push({ zone: values[0], altitude: values[1], speed: values[2] });
        }
      }
    }
  }

  return definitions;
}
