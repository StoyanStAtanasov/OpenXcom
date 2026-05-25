import { Options } from "../Engine/Options.ts";
import { Target, type CoordinateTarget, type TargetLike, type TargetSaveNode, nautical, targetsAreSame } from "./Target.ts";

type MovingTargetLike = CoordinateTarget & {
  getDestination?: () => CoordinateTarget | null;
  getSpeedRadian?: () => number;
};

type FollowerTarget = CoordinateTarget & {
  getFollowers(): MovingTarget[];
};

function sign(value: number): number {
  return (0 < value ? 1 : 0) - (value < 0 ? 1 : 0);
}

function hasFollowers(target: CoordinateTarget | null): target is FollowerTarget {
  return typeof (target as TargetLike | null)?.getFollowers === "function";
}

export type MovingTargetSaveNode = TargetSaveNode & {
  dest?: TargetSaveNode;
  speedLon?: number;
  speedLat?: number;
  speedRadian?: number;
  speed?: number;
};

/**
 * Base class for moving targets on the globe with a certain speed and destination.
 */
export abstract class MovingTarget extends Target {
  protected _dest: TargetLike | null = null;
  protected _speedLon = 0.0;
  protected _speedLat = 0.0;
  protected _speedRadian = 0.0;
  protected _meetPointLon = 0.0;
  protected _meetPointLat = 0.0;
  protected _speed = 0;
  protected _meetCalculated = false;

  getDestination(): TargetLike | null {
    return this._dest;
  }

  override load(node: MovingTargetSaveNode | null | undefined): void {
    super.load(node);
    if (!node) {
      return;
    }
    this._speedLon = typeof node.speedLon === "number" ? node.speedLon : this._speedLon;
    this._speedLat = typeof node.speedLat === "number" ? node.speedLat : this._speedLat;
    this._speedRadian = typeof node.speedRadian === "number" ? node.speedRadian : this._speedRadian;
    this._speed = typeof node.speed === "number" ? node.speed : this._speed;
  }

  override save(): MovingTargetSaveNode {
    const node: MovingTargetSaveNode = {
      ...super.save(),
      speedLon: this._speedLon,
      speedLat: this._speedLat,
      speedRadian: this._speedRadian,
      speed: this._speed
    };
    if (this._dest) {
      if (typeof this._dest.saveId === "function") {
        node.dest = this._dest.saveId();
      } else {
        node.dest = {
          lon: this._dest.getLongitude(),
          lat: this._dest.getLatitude(),
          type: this._dest.getType?.(),
          id: this._dest.getId?.() ?? 0
        };
      }
    }
    return node;
  }

  setDestination(dest: TargetLike | null): void {
    this._meetCalculated = false;
    if (hasFollowers(this._dest)) {
      const followers = this._dest.getFollowers();
      const index = followers.indexOf(this);
      if (index !== -1) {
        followers.splice(index, 1);
      }
    }
    this._dest = dest;
    if (hasFollowers(this._dest)) {
      this._dest.getFollowers().push(this);
    }
    for (const follower of this.getFollowers()) {
      follower.resetMeetPoint();
    }
    this.calculateSpeed();
  }

  getSpeed(): number {
    return this._speed;
  }

  getSpeedRadian(): number {
    return this._speedRadian;
  }

  static calculateRadianSpeed(speed: number): number {
    return nautical(speed) / 720.0;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
    this._speedRadian = MovingTarget.calculateRadianSpeed(this._speed);
    for (const follower of this.getFollowers()) {
      follower.resetMeetPoint();
    }
    this.calculateSpeed();
  }

  reachedDestination(): boolean {
    if (this._dest === null) {
      return false;
    }
    return targetsAreSame(this._dest.getLongitude(), this._lon) && targetsAreSame(this._dest.getLatitude(), this._lat);
  }

  move(): void {
    this.calculateSpeed();
    if (this._dest === null) {
      return;
    }
    if (this.getDistance(this._meetPointLon, this._meetPointLat) > this._speedRadian) {
      this.setLongitude(this._lon + this._speedLon);
      this.setLatitude(this._lat + this._speedLat);
    } else if (this.getDistance(this._dest) > this._speedRadian) {
      this.setLongitude(this._meetPointLon);
      this.setLatitude(this._meetPointLat);
      this.resetMeetPoint();
    } else {
      this.setLongitude(this._dest.getLongitude());
      this.setLatitude(this._dest.getLatitude());
      this.resetMeetPoint();
    }
  }

  calculateMeetPoint(): void {
    const meetingPoint = (Options as typeof Options & { meetingPoint?: boolean }).meetingPoint ?? false;
    if (!meetingPoint) {
      this._meetCalculated = false;
    }
    if (this._meetCalculated) {
      return;
    }

    if (this._dest !== null) {
      this._meetPointLat = this._dest.getLatitude();
      this._meetPointLon = this._dest.getLongitude();
    } else {
      this._meetPointLat = this._lat;
      this._meetPointLon = this._lon;
    }

    if (this._dest === null || !meetingPoint || this.reachedDestination()) {
      return;
    }

    const movingTarget = this._dest as MovingTargetLike;
    const targetDestination = movingTarget.getDestination?.() ?? null;
    const targetSpeedRadian = movingTarget.getSpeedRadian?.() ?? 0.0;
    if (targetDestination === null || targetsAreSame(targetSpeedRadian, 0.0)) {
      return;
    }

    const speedRatio = this._speedRadian / targetSpeedRadian;
    let nx = Math.cos(this._dest.getLatitude()) * Math.sin(this._dest.getLongitude()) * Math.sin(targetDestination.getLatitude())
      - Math.sin(this._dest.getLatitude()) * Math.cos(targetDestination.getLatitude()) * Math.sin(targetDestination.getLongitude());
    let ny = Math.sin(this._dest.getLatitude()) * Math.cos(targetDestination.getLatitude()) * Math.cos(targetDestination.getLongitude())
      - Math.cos(this._dest.getLatitude()) * Math.cos(this._dest.getLongitude()) * Math.sin(targetDestination.getLatitude());
    let nz = Math.cos(this._dest.getLatitude()) * Math.cos(targetDestination.getLatitude()) * Math.sin(targetDestination.getLongitude() - this._dest.getLongitude());

    const normalizer = this._speedRadian / Math.sqrt(nx * nx + ny * ny + nz * nz);
    nx *= normalizer;
    ny *= normalizer;
    nz *= normalizer;

    for (let path = 0, distance = 1; path < Math.PI && distance - path * speedRatio > 0 && path * speedRatio < 1; path += this._speedRadian) {
      this._meetPointLat += nx * Math.sin(this._meetPointLon) - ny * Math.cos(this._meetPointLon);
      if (Math.abs(this._meetPointLat) < Math.PI / 2) {
        this._meetPointLon += nz - (nx * Math.cos(this._meetPointLon) + ny * Math.sin(this._meetPointLon)) * Math.tan(this._meetPointLat);
      } else {
        this._meetPointLon += Math.PI;
      }
      distance = Math.acos(Math.max(-1, Math.min(1, Math.cos(this._lat) * Math.cos(this._meetPointLat) * Math.cos(this._meetPointLon - this._lon) + Math.sin(this._lat) * Math.sin(this._meetPointLat))));
    }

    const lonSign = sign(this._meetPointLon);
    const latSign = sign(this._meetPointLat);
    while (Math.abs(this._meetPointLon) > Math.PI) {
      this._meetPointLon -= lonSign * 2 * Math.PI;
    }
    while (Math.abs(this._meetPointLat) > Math.PI) {
      this._meetPointLat -= latSign * 2 * Math.PI;
    }
    if (Math.abs(this._meetPointLat) > Math.PI / 2) {
      this._meetPointLat = latSign * Math.abs(2 * Math.PI - Math.abs(this._meetPointLat));
      this._meetPointLon -= lonSign * Math.PI;
    }

    this._meetCalculated = true;
  }

  getMeetLatitude(): number {
    return this._meetPointLat;
  }

  getMeetLongitude(): number {
    return this._meetPointLon;
  }

  resetMeetPoint(): void {
    this._meetCalculated = false;
  }

  isMeetCalculated(): boolean {
    return this._meetCalculated;
  }

  protected calculateSpeed(): void {
    this.calculateMeetPoint();
    if (this._dest !== null) {
      const dLon = Math.sin(this._meetPointLon - this._lon) * Math.cos(this._meetPointLat);
      const dLat = Math.cos(this._lat) * Math.sin(this._meetPointLat) - Math.sin(this._lat) * Math.cos(this._meetPointLat) * Math.cos(this._meetPointLon - this._lon);
      const length = Math.sqrt(dLon * dLon + dLat * dLat);
      this._speedLat = dLat / length * this._speedRadian;
      this._speedLon = dLon / length * this._speedRadian / Math.cos(this._lat + this._speedLat);
      if (!Number.isFinite(this._speedLon) || !Number.isFinite(this._speedLat)) {
        this._speedLon = 0;
        this._speedLat = 0;
      }
    } else {
      this._speedLon = 0;
      this._speedLat = 0;
    }
  }
}
