import type { Language } from "../Engine/Language.ts";
import type { Mod } from "../Mod/Mod.ts";
import type { RuleUfo } from "../Mod/RuleUfo.ts";
import type { MovingTarget } from "./MovingTarget.ts";
import type { SavedGame } from "./SavedGame.ts";
import type { TargetSaveNode } from "./Target.ts";
import { Waypoint } from "./Waypoint.ts";

export const ALTITUDE_STRING = [
  "STR_GROUND",
  "STR_VERY_LOW",
  "STR_LOW_UC",
  "STR_HIGH_UC",
  "STR_VERY_HIGH"
] as const;

export enum UfoStatus {
  FLYING = 0,
  LANDED,
  CRASHED,
  DESTROYED
}

export type UfoSaveNode = {
  type?: string;
  lon?: number;
  lat?: number;
  id?: number;
  name?: string;
  dest?: TargetSaveNode;
  speedLon?: number;
  speedLat?: number;
  speedRadian?: number;
  speed?: number;
  crashId?: number;
  landId?: number;
  damage?: number;
  altitude?: string;
  direction?: string;
  status?: number;
  detected?: boolean;
  hyperDetected?: boolean;
  secondsRemaining?: number;
  inBattlescape?: boolean;
  mission?: number;
  trajectory?: string;
  trajectoryPoint?: number;
  fireCountdown?: number;
  escapeCountdown?: number;
};

type GlobeTarget = {
  getLongitude(): number;
  getLatitude(): number;
};

type UfoMissionLike = {
  getRace?(): string;
  getRules?(): { getType(): string };
  getId?(): number;
  increaseLiveUfos?(): void;
};

type UfoTrajectoryLike = {
  getID?(): string;
  getWaypointCount?(): number;
  getZone?(wp: number): number;
  getAltitude?(wp: number): string;
  applySpeedPercentage?(wp: number, baseSpeed: number): number;
  groundTimer?(): number;
};

function areSame(left: number, right: number): boolean {
  return Math.abs(left - right) <= Number.EPSILON * Math.max(1.0, Math.abs(left), Math.abs(right));
}

function nautical(speed: number): number {
  return speed * (1 / 60.0) * (Math.PI / 180.0);
}

export class Ufo {
  static ALTITUDE_STRING = ALTITUDE_STRING;

  private _lon = 0.0;
  private _lat = 0.0;
  private _id = 0;
  private _name = "";
  private _dest: GlobeTarget | null = null;
  private _speedLon = 0.0;
  private _speedLat = 0.0;
  private _speedRadian = 0.0;
  private _meetPointLon = 0.0;
  private _meetPointLat = 0.0;
  private _speed = 0;
  private _meetCalculated = false;
  private _crashId = 0;
  private _landId = 0;
  private _damage = 0;
  private _direction = "STR_NORTH";
  private _altitude = "STR_HIGH_UC";
  private _status = UfoStatus.FLYING;
  private _secondsRemaining = 0;
  private _inBattlescape = false;
  private _shotDownByCraftId: number | string | null = null;
  private _mission: UfoMissionLike | null = null;
  private _trajectory: UfoTrajectoryLike | null = null;
  private _trajectoryPoint = 0;
  private _detected = false;
  private _hyperDetected = false;
  private _processedIntercept = false;
  private _shootingAt = 0;
  private _hitFrame = 0;
  private _fireCountdown = 0;
  private _escapeCountdown = 0;
  private _followers: MovingTarget[] = [];

  constructor(private _rules: RuleUfo) {}

  load(node: UfoSaveNode, mod: Mod | null = null, game: SavedGame | null = null): void {
    this._lon = node.lon ?? this._lon;
    this._lat = node.lat ?? this._lat;
    this._id = node.id ?? this._id;
    this._name = node.name ?? this._name;
    this._speedLon = node.speedLon ?? this._speedLon;
    this._speedLat = node.speedLat ?? this._speedLat;
    this._speedRadian = node.speedRadian ?? this._speedRadian;
    this._speed = node.speed ?? this._speed;
    this._crashId = node.crashId ?? this._crashId;
    this._landId = node.landId ?? this._landId;
    this._damage = node.damage ?? this._damage;
    this._altitude = node.altitude ?? this._altitude;
    this._direction = node.direction ?? this._direction;
    this._detected = node.detected ?? this._detected;
    this._hyperDetected = node.hyperDetected ?? this._hyperDetected;
    this._secondsRemaining = node.secondsRemaining ?? this._secondsRemaining;
    this._inBattlescape = node.inBattlescape ?? this._inBattlescape;
    this._fireCountdown = node.fireCountdown ?? this._fireCountdown;
    this._escapeCountdown = node.escapeCountdown ?? this._escapeCountdown;
    this._trajectoryPoint = node.trajectoryPoint ?? this._trajectoryPoint;
    if (node.status != null) {
      this._status = node.status as UfoStatus;
    } else if (this.isDestroyed()) {
      this._status = UfoStatus.DESTROYED;
    } else if (this.isCrashed()) {
      this._status = UfoStatus.CRASHED;
    } else if (this._altitude === "STR_GROUND") {
      this._status = UfoStatus.LANDED;
    } else {
      this._status = UfoStatus.FLYING;
    }
    if (node.dest) {
      const lon = node.dest.lon ?? this._lon;
      const lat = node.dest.lat ?? this._lat;
      const waypoint = new Waypoint();
      waypoint.setLongitude(lon);
      waypoint.setLatitude(lat);
      this._dest = waypoint;
    }
    if (mod && game && game.getMonthsPassed() !== -1 && node.mission != null) {
      const mission = game.getAlienMissions().find(alienMission => alienMission.getId() === node.mission) || null;
      if (!mission) {
        throw new Error("Unknown UFO mission, save file is corrupt.");
      }
      const trajectory = mod.getUfoTrajectory(node.trajectory || "");
      if (!trajectory) {
        throw new Error("Unknown UFO trajectory, save file is corrupt.");
      }
      this._mission = mission;
      this._trajectory = trajectory;
      this._trajectoryPoint = node.trajectoryPoint ?? this._trajectoryPoint;
    }
    if (this._inBattlescape) {
      this.setSpeed(0);
    }
  }

  save(newBattle = false): UfoSaveNode {
    const node: UfoSaveNode = {
      type: this._rules.getType(),
      lon: this._lon,
      lat: this._lat,
      damage: this._damage,
      altitude: this._altitude,
      direction: this._direction,
      status: this._status,
      speedLon: this._speedLon,
      speedLat: this._speedLat,
      speedRadian: this._speedRadian,
      speed: this._speed,
      fireCountdown: this._fireCountdown,
      escapeCountdown: this._escapeCountdown
    };
    if (this._id) {
      node.id = this._id;
    }
    if (this._name) {
      node.name = this._name;
    }
    if (this._dest) {
      const saveId = (this._dest as GlobeTarget & { saveId?: () => TargetSaveNode }).saveId?.();
      node.dest = saveId || { lon: this._dest.getLongitude(), lat: this._dest.getLatitude() };
    }
    if (this._crashId) {
      node.crashId = this._crashId;
    } else if (this._landId) {
      node.landId = this._landId;
    }
    if (this._detected) {
      node.detected = this._detected;
    }
    if (this._hyperDetected) {
      node.hyperDetected = this._hyperDetected;
    }
    if (this._secondsRemaining) {
      node.secondsRemaining = this._secondsRemaining;
    }
    if (this._inBattlescape) {
      node.inBattlescape = this._inBattlescape;
    }
    if (!newBattle && this._mission && this._trajectory) {
      const missionId = this._mission.getId?.();
      const trajectoryId = this._trajectory.getID?.();
      if (missionId != null) {
        node.mission = missionId;
      }
      if (trajectoryId != null) {
        node.trajectory = trajectoryId;
      }
      node.trajectoryPoint = this._trajectoryPoint;
    }
    return node;
  }

  getType(): string {
    return "STR_UFO";
  }

  getRules(): RuleUfo {
    return this._rules;
  }

  changeRules(rules: RuleUfo): void {
    this._rules = rules;
  }

  getLongitude(): number {
    return this._lon;
  }

  setLongitude(lon: number): void {
    this._lon = lon;
    while (this._lon < 0) {
      this._lon += 2 * Math.PI;
    }
    while (this._lon >= 2 * Math.PI) {
      this._lon -= 2 * Math.PI;
    }
  }

  getLatitude(): number {
    return this._lat;
  }

  setLatitude(lat: number): void {
    this._lat = lat;
    if (this._lat < -Math.PI / 2) {
      this._lat = -Math.PI - this._lat;
      this.setLongitude(this._lon + Math.PI);
    } else if (this._lat > Math.PI / 2) {
      this._lat = Math.PI - this._lat;
      this.setLongitude(this._lon - Math.PI);
    }
  }

  getId(): number {
    return this._id;
  }

  setId(id: number): void {
    this._id = id;
  }

  getName(lang: Language): string {
    if (this._name) {
      return this._name;
    }
    return this.getDefaultName(lang);
  }

  setName(newName: string): void {
    this._name = newName;
  }

  getDefaultName(lang: Language): string {
    switch (this._status) {
      case UfoStatus.LANDED:
        return lang.getString(this.getMarkerName()).arg(this._landId).toString();
      case UfoStatus.CRASHED:
        return lang.getString(this.getMarkerName()).arg(this._crashId).toString();
      default:
        return lang.getString(this.getMarkerName()).arg(this._id).toString();
    }
  }

  getMarkerName(): string {
    switch (this._status) {
      case UfoStatus.LANDED:
        return "STR_LANDING_SITE_";
      case UfoStatus.CRASHED:
        return "STR_CRASH_SITE_";
      default:
        return "STR_UFO_";
    }
  }

  getMarkerId(): number {
    switch (this._status) {
      case UfoStatus.LANDED:
        return this._landId;
      case UfoStatus.CRASHED:
        return this._crashId;
      default:
        return this._id;
    }
  }

  getMarker(): number {
    if (!this._detected) {
      return -1;
    }
    switch (this._status) {
      case UfoStatus.LANDED:
        return this._rules.getLandMarker() === -1 ? 3 : this._rules.getLandMarker();
      case UfoStatus.CRASHED:
        return this._rules.getCrashMarker() === -1 ? 4 : this._rules.getCrashMarker();
      default:
        return this._rules.getMarker() === -1 ? 2 : this._rules.getMarker();
    }
  }

  getFollowers(): MovingTarget[] {
    return this._followers;
  }

  getDamage(): number {
    return this._damage;
  }

  setDamage(damage: number): void {
    this._damage = Math.max(0, damage);
    if (this.isDestroyed()) {
      this._status = UfoStatus.DESTROYED;
    } else if (this.isCrashed()) {
      this._status = UfoStatus.CRASHED;
    }
  }

  getDetected(): boolean {
    return this._detected;
  }

  setDetected(detected: boolean): void {
    this._detected = detected;
  }

  getSecondsRemaining(): number {
    return this._secondsRemaining;
  }

  setSecondsRemaining(seconds: number): void {
    this._secondsRemaining = seconds;
  }

  getDirection(): string {
    return this._direction;
  }

  getAltitude(): string {
    return this._altitude;
  }

  getAltitudeInt(): number {
    return ALTITUDE_STRING.indexOf(this._altitude as typeof ALTITUDE_STRING[number]);
  }

  setAltitude(altitude: string): void {
    this._altitude = altitude;
    if (this._altitude !== "STR_GROUND") {
      this._status = UfoStatus.FLYING;
    } else {
      this._status = this.isCrashed() ? UfoStatus.CRASHED : UfoStatus.LANDED;
    }
  }

  getStatus(): UfoStatus {
    return this._status;
  }

  setStatus(status: UfoStatus): void {
    this._status = status;
  }

  isCrashed(): boolean {
    return this._damage > this._rules.getMaxDamage() / 2;
  }

  isDestroyed(): boolean {
    return this._damage >= this._rules.getMaxDamage();
  }

  think(): void {
    switch (this._status) {
      case UfoStatus.FLYING:
        this.move();
        if (this.reachedDestination()) {
          this.setSpeed(0);
        }
        break;
      case UfoStatus.LANDED:
        this._secondsRemaining = Math.max(0, this._secondsRemaining - 5);
        break;
      case UfoStatus.CRASHED:
        if (!this._detected) {
          this._detected = true;
        }
        break;
      case UfoStatus.DESTROYED:
        break;
    }
  }

  setInBattlescape(inbattle: boolean): void {
    if (inbattle) {
      this.setSpeed(0);
    }
    this._inBattlescape = inbattle;
  }

  isInBattlescape(): boolean {
    return this._inBattlescape;
  }

  getAlienRace(): string {
    return this._mission?.getRace?.() || "";
  }

  setShotDownByCraftId(craftId: number | string | null): void {
    this._shotDownByCraftId = craftId;
  }

  getShotDownByCraftId(): number | string | null {
    return this._shotDownByCraftId;
  }

  getVisibility(): number {
    let size = 0;
    if (this._rules.getSize() === "STR_VERY_SMALL") {
      size = -30;
    } else if (this._rules.getSize() === "STR_SMALL") {
      size = -15;
    } else if (this._rules.getSize() === "STR_MEDIUM_UC") {
      size = 0;
    } else if (this._rules.getSize() === "STR_LARGE") {
      size = 15;
    } else if (this._rules.getSize() === "STR_VERY_LARGE") {
      size = 30;
    }

    if (this._altitude === "STR_GROUND") {
      return -30;
    } else if (this._altitude === "STR_VERY_LOW") {
      return size - 20;
    } else if (this._altitude === "STR_LOW_UC") {
      return size - 10;
    } else if (this._altitude === "STR_HIGH_UC") {
      return size;
    } else if (this._altitude === "STR_VERY_HIGH") {
      return size - 10;
    }
    return 0;
  }

  getMissionType(): string {
    return this._mission?.getRules?.().getType() || "";
  }

  setMissionInfo(mission: UfoMissionLike, trajectory: UfoTrajectoryLike): void {
    this._mission = mission;
    this._mission.increaseLiveUfos?.();
    this._trajectoryPoint = 0;
    this._trajectory = trajectory;
  }

  getHyperDetected(): boolean {
    return this._hyperDetected;
  }

  setHyperDetected(hyperDetected: boolean): void {
    this._hyperDetected = hyperDetected;
  }

  getTrajectoryPoint(): number {
    return this._trajectoryPoint;
  }

  setTrajectoryPoint(trajectoryPoint: number): void {
    this._trajectoryPoint = trajectoryPoint;
  }

  getTrajectory(): UfoTrajectoryLike | null {
    return this._trajectory;
  }

  getMission(): UfoMissionLike | null {
    return this._mission;
  }

  getDestination(): GlobeTarget | null {
    return this._dest;
  }

  setDestination(dest: GlobeTarget | null): void {
    this._dest = dest;
    this._meetCalculated = false;
    this.calculateSpeed();
  }

  getShootingAt(): number {
    return this._shootingAt;
  }

  setShootingAt(target: number): void {
    this._shootingAt = target;
  }

  getLandId(): number {
    return this._landId;
  }

  setLandId(id: number): void {
    this._landId = id;
  }

  getCrashId(): number {
    return this._crashId;
  }

  setCrashId(id: number): void {
    this._crashId = id;
  }

  setHitFrame(frame: number): void {
    this._hitFrame = frame;
  }

  getHitFrame(): number {
    return this._hitFrame;
  }

  setFireCountdown(time: number): void {
    this._fireCountdown = time;
  }

  getFireCountdown(): number {
    return this._fireCountdown;
  }

  setEscapeCountdown(time: number): void {
    this._escapeCountdown = time;
  }

  getEscapeCountdown(): number {
    return this._escapeCountdown;
  }

  setInterceptionProcessed(processed: boolean): void {
    this._processedIntercept = processed;
  }

  getInterceptionProcessed(): boolean {
    return this._processedIntercept;
  }

  getSpeed(): number {
    return this._speed;
  }

  getSpeedRadian(): number {
    return this._speedRadian;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
    this._speedRadian = nautical(this._speed) / 720.0;
    this.calculateSpeed();
  }

  reachedDestination(): boolean {
    if (!this._dest) {
      return false;
    }
    return areSame(this._dest.getLongitude(), this._lon) && areSame(this._dest.getLatitude(), this._lat);
  }

  move(): void {
    this.calculateSpeed();
    if (!this._dest) {
      return;
    }
    if (this.getDistance(this._meetPointLon, this._meetPointLat) > this._speedRadian) {
      this.setLongitude(this._lon + this._speedLon);
      this.setLatitude(this._lat + this._speedLat);
    } else if (this.getDistance(this._dest.getLongitude(), this._dest.getLatitude()) > this._speedRadian) {
      this.setLongitude(this._meetPointLon);
      this.setLatitude(this._meetPointLat);
    } else {
      this.setLongitude(this._dest.getLongitude());
      this.setLatitude(this._dest.getLatitude());
    }
  }

  calculateMeetPoint(): void {
    if (this._meetCalculated) {
      return;
    }
    if (this._dest) {
      this._meetPointLat = this._dest.getLatitude();
      this._meetPointLon = this._dest.getLongitude();
    } else {
      this._meetPointLat = this._lat;
      this._meetPointLon = this._lon;
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

  getDistance(lon: number, lat: number): number {
    if (areSame(lon, this._lon) && areSame(lat, this._lat)) {
      return 0.0;
    }
    const value = Math.cos(this._lat) * Math.cos(lat) * Math.cos(lon - this._lon) + Math.sin(this._lat) * Math.sin(lat);
    return Math.acos(Math.max(-1, Math.min(1, value)));
  }

  private calculateSpeed(): void {
    this.calculateMeetPoint();
    if (this._dest) {
      const dLon = Math.sin(this._meetPointLon - this._lon) * Math.cos(this._meetPointLat);
      const dLat = Math.cos(this._lat) * Math.sin(this._meetPointLat) - Math.sin(this._lat) * Math.cos(this._meetPointLat) * Math.cos(this._meetPointLon - this._lon);
      const length = Math.sqrt(dLon * dLon + dLat * dLat);
      if (length > 0) {
        this._speedLat = dLat / length * this._speedRadian;
        this._speedLon = dLon / length * this._speedRadian / Math.cos(this._lat + this._speedLat);
      } else {
        this._speedLon = 0;
        this._speedLat = 0;
      }
      if (!Number.isFinite(this._speedLon) || !Number.isFinite(this._speedLat)) {
        this._speedLon = 0;
        this._speedLat = 0;
      }
    } else {
      this._speedLon = 0;
      this._speedLat = 0;
    }
    this.calculateDirection();
  }

  private calculateDirection(): void {
    const x = this._speedLon;
    const y = -this._speedLat;
    if (areSame(x, 0.0) || areSame(y, 0.0)) {
      if (areSame(x, 0.0) && areSame(y, 0.0)) {
        this._direction = "STR_NONE_UC";
      } else if (areSame(x, 0.0)) {
        this._direction = y > 0.0 ? "STR_NORTH" : "STR_SOUTH";
      } else if (areSame(y, 0.0)) {
        this._direction = x > 0.0 ? "STR_EAST" : "STR_WEST";
      }
      return;
    }

    const theta = Math.atan2(y, x) * 180.0 / Math.PI;
    if (22.5 > theta && theta > -22.5) {
      this._direction = "STR_EAST";
    } else if (-22.5 > theta && theta > -67.5) {
      this._direction = "STR_SOUTH_EAST";
    } else if (-67.5 > theta && theta > -112.5) {
      this._direction = "STR_SOUTH";
    } else if (-112.5 > theta && theta > -157.5) {
      this._direction = "STR_SOUTH_WEST";
    } else if (-157.5 > theta || theta > 157.5) {
      this._direction = "STR_WEST";
    } else if (157.5 > theta && theta > 112.5) {
      this._direction = "STR_NORTH_WEST";
    } else if (112.5 > theta && theta > 67.5) {
      this._direction = "STR_NORTH";
    } else {
      this._direction = "STR_NORTH_EAST";
    }
  }
}
