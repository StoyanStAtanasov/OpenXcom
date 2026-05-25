import { RNG } from "../Engine/RNG.ts";
import type { Globe } from "../Geoscape/Globe.ts";
import type { Mod } from "../Mod/Mod.ts";
import { MissionObjective, type MissionWave, type RuleAlienMission } from "../Mod/RuleAlienMission.ts";
import type { RuleRegion } from "../Mod/RuleRegion.ts";
import type { UfoTrajectory } from "../Mod/UfoTrajectory.ts";
import { Ufo, UfoStatus } from "./Ufo.ts";
import type { SavedGame } from "./SavedGame.ts";

export type AlienMissionSaveNode = {
  type?: string;
  region?: string;
  race?: string;
  nextWave?: number;
  nextUfoCounter?: number;
  spawnCountdown?: number;
  liveUfos?: number;
  uniqueID?: number;
  alienBase?: number | { id: number; type: string };
  missionSiteZone?: number;
};

type GameLike = {
  getMod(): Mod | null;
  getSavedGame(): SavedGame | null;
};

type GlobeLike = Pick<Globe, "insideLand">;

export class AlienMission {
  private _region = "";
  private _race = "";
  private _nextWave = 0;
  private _nextUfoCounter = 0;
  private _spawnCountdown = 0;
  private _liveUfos = 0;
  private _uniqueID = 0;
  private _missionSiteZone = -1;
  private _base: unknown = null;

  constructor(private _rule: RuleAlienMission) {}

  load(node: AlienMissionSaveNode, game: SavedGame | null = null): void {
    this._region = node.region ?? this._region;
    this._race = node.race ?? this._race;
    this._nextWave = node.nextWave ?? this._nextWave;
    this._nextUfoCounter = node.nextUfoCounter ?? this._nextUfoCounter;
    this._spawnCountdown = node.spawnCountdown ?? this._spawnCountdown;
    this._liveUfos = node.liveUfos ?? this._liveUfos;
    this._uniqueID = node.uniqueID ?? this._uniqueID;
    this._missionSiteZone = node.missionSiteZone ?? this._missionSiteZone;
    if (node.alienBase != null && game) {
      let id = -1;
      let type = "STR_ALIEN_BASE";
      if (typeof node.alienBase === "number") {
        id = node.alienBase;
      } else {
        id = node.alienBase.id;
        type = node.alienBase.type;
      }
      const base = game.getAlienBases().find(alienBase => alienBase.getId() === id && alienBase.getDeployment().getMarkerName() === type);
      if (!base) {
        throw new Error("Corrupted save: Invalid base for mission.");
      }
      this._base = base;
    }
  }

  save(): AlienMissionSaveNode {
    const node: AlienMissionSaveNode = {
      type: this._rule.getType(),
      region: this._region,
      race: this._race,
      nextWave: this._nextWave,
      nextUfoCounter: this._nextUfoCounter,
      spawnCountdown: this._spawnCountdown,
      liveUfos: this._liveUfos,
      uniqueID: this._uniqueID,
      missionSiteZone: this._missionSiteZone
    };
    const base = this._base as { saveId?: () => { id?: number; type?: string } } | null;
    const baseId = base?.saveId?.();
    if (baseId) {
      node.alienBase = { id: baseId.id || 0, type: baseId.type || "STR_ALIEN_BASE" };
    }
    return node;
  }

  getRules(): RuleAlienMission {
    return this._rule;
  }

  getRegion(): string {
    return this._region;
  }

  setRegion(region: string, mod: Mod): void {
    const rule = mod.getRegion(region);
    this._region = rule?.getMissionRegion() || region;
  }

  getRace(): string {
    return this._race;
  }

  setRace(race: string): void {
    this._race = race;
  }

  getWaveCountdown(): number {
    return this._spawnCountdown;
  }

  setWaveCountdown(minutes: number): void {
    if (this.isOver()) {
      return;
    }
    this._spawnCountdown = minutes;
  }

  setId(id: number): void {
    if (this._uniqueID !== 0) {
      throw new Error("Reassigning alien mission ID.");
    }
    this._uniqueID = id;
  }

  getId(): number {
    return this._uniqueID;
  }

  getAlienBase(): unknown {
    return this._base;
  }

  setAlienBase(base: unknown): void {
    this._base = base;
  }

  isOver(): boolean {
    if (this._rule.getObjective() === MissionObjective.OBJECTIVE_INFILTRATION) {
      return false;
    }
    return this._nextWave === this._rule.getWaveCount() && this._liveUfos === 0;
  }

  think(engine: GameLike, globe: GlobeLike): void {
    const mod = engine.getMod();
    const game = engine.getSavedGame();
    if (!mod || !game || this._nextWave >= this._rule.getWaveCount()) {
      return;
    }
    if (this._spawnCountdown > 30) {
      this._spawnCountdown -= 30;
      return;
    }
    const wave = this._rule.getWave(this._nextWave);
    const trajectory = mod.getUfoTrajectory(wave.trajectory, true);
    if (!trajectory) {
      return;
    }
    const ufo = this.spawnUfo(game, mod, globe, wave, trajectory);
    if (ufo) {
      game.getUfos().push(ufo);
    }

    ++this._nextUfoCounter;
    if (this._nextUfoCounter >= wave.ufoCount) {
      this._nextUfoCounter = 0;
      ++this._nextWave;
    }
    if (this._rule.getObjective() === MissionObjective.OBJECTIVE_INFILTRATION && this._nextWave === this._rule.getWaveCount()) {
      this._nextWave = 0;
    }
    if (this._nextWave !== this._rule.getWaveCount()) {
      const spawnTimer = Math.trunc(this._rule.getWave(this._nextWave).spawnTimer / 30);
      this._spawnCountdown = (Math.trunc(spawnTimer / 2) + RNG.generate(0, spawnTimer)) * 30;
    }
  }

  start(initialCount = 0): void {
    this._nextWave = 0;
    this._nextUfoCounter = 0;
    this._liveUfos = 0;
    if (initialCount === 0 && this._rule.getWaveCount() > 0) {
      const spawnTimer = Math.trunc(this._rule.getWave(0).spawnTimer / 30);
      this._spawnCountdown = (Math.trunc(spawnTimer / 2) + RNG.generate(0, spawnTimer)) * 30;
    } else {
      this._spawnCountdown = initialCount;
    }
  }

  increaseLiveUfos(): void {
    ++this._liveUfos;
  }

  decreaseLiveUfos(): void {
    this._liveUfos = Math.max(0, this._liveUfos - 1);
  }

  ufoReachedWaypoint(ufo: Ufo, engine: GameLike, globe: GlobeLike): void {
    const mod = engine.getMod();
    const game = engine.getSavedGame();
    const trajectory = ufo.getTrajectory() as UfoTrajectory | null;
    if (!mod || !game || !trajectory) {
      return;
    }
    const currentWaypoint = ufo.getTrajectoryPoint();
    const nextWaypoint = currentWaypoint + 1;
    if (nextWaypoint >= trajectory.getWaypointCount()) {
      ufo.setDetected(false);
      ufo.setStatus(UfoStatus.DESTROYED);
      return;
    }
    ufo.setAltitude(trajectory.getAltitude(nextWaypoint));
    ufo.setTrajectoryPoint(nextWaypoint);
    const region = mod.getRegion(this._region);
    if (!region) {
      return;
    }
    const [lon, lat] = this.getWaypoint(trajectory, nextWaypoint, globe, region);
    ufo.setDestination({ getLongitude: () => lon, getLatitude: () => lat });
    if (ufo.getAltitude() !== "STR_GROUND") {
      if (ufo.getLandId() !== 0) {
        ufo.setLandId(0);
      }
      ufo.setSpeed(trajectory.applySpeedPercentage(nextWaypoint, ufo.getRules().getMaxSpeed()));
    } else if (globe.insideLand(ufo.getLongitude(), ufo.getLatitude())) {
      ufo.setSecondsRemaining(trajectory.groundTimer() * 5);
      if (ufo.getDetected() && ufo.getLandId() === 0) {
        ufo.setLandId(game.getId("STR_LANDING_SITE"));
      }
    } else {
      ufo.setSecondsRemaining(5);
    }
  }

  ufoLifting(ufo: Ufo, game: SavedGame): void {
    const trajectory = ufo.getTrajectory() as UfoTrajectory | null;
    switch (ufo.getStatus()) {
      case UfoStatus.LANDED:
        if (this._rule.getPoints() > 0 && this._rule.getObjective() !== MissionObjective.OBJECTIVE_BASE) {
          this.addScore(ufo.getLongitude(), ufo.getLatitude(), game);
        }
        ufo.setAltitude("STR_VERY_LOW");
        if (trajectory) {
          ufo.setSpeed(trajectory.applySpeedPercentage(ufo.getTrajectoryPoint(), ufo.getRules().getMaxSpeed()));
        }
        break;
      case UfoStatus.CRASHED:
        ufo.setDetected(false);
        ufo.setStatus(UfoStatus.DESTROYED);
        break;
      default:
        break;
    }
  }

  ufoShotDown(ufo: Ufo): void {
    if ((ufo.getStatus() === UfoStatus.CRASHED || ufo.getStatus() === UfoStatus.DESTROYED) && this._nextWave !== this._rule.getWaveCount()) {
      this._spawnCountdown += 30 * (RNG.generate(0, 400) + 48);
    }
  }

  addScore(lon: number, lat: number, game: SavedGame): void {
    if (this._rule.getObjective() === MissionObjective.OBJECTIVE_INFILTRATION) {
      return;
    }
    for (const region of game.getRegions()) {
      if (region.getRules().insideRegion(lon, lat)) {
        region.addActivityAlien(this._rule.getPoints());
        break;
      }
    }
    for (const country of game.getCountries()) {
      if (country.getRules().insideCountry(lon, lat)) {
        country.addActivityAlien(this._rule.getPoints());
        break;
      }
    }
  }

  setMissionSiteZone(zone: number): void {
    this._missionSiteZone = zone;
  }

  private spawnUfo(game: SavedGame, mod: Mod, globe: GlobeLike, wave: MissionWave, trajectory: UfoTrajectory): Ufo | null {
    const ufoRule = mod.getUfo(wave.ufoType);
    if (!ufoRule) {
      return null;
    }
    const region = mod.getRegion(this._region);
    if (!region) {
      return null;
    }
    const ufo = new Ufo(ufoRule);
    ufo.setMissionInfo(this, trajectory);
    const [lon, lat] = this.getWaypoint(trajectory, 0, globe, region);
    ufo.setAltitude(trajectory.getAltitude(0));
    if (trajectory.getAltitude(0) === "STR_GROUND") {
      ufo.setSecondsRemaining(trajectory.groundTimer() * 5);
    }
    ufo.setSpeed(trajectory.applySpeedPercentage(0, ufoRule.getMaxSpeed()));
    ufo.setLongitude(lon);
    ufo.setLatitude(lat);
    if (trajectory.getWaypointCount() > 1) {
      const [destLon, destLat] = this.getWaypoint(trajectory, 1, globe, region);
      ufo.setDestination({ getLongitude: () => destLon, getLatitude: () => destLat });
    }
    if (ufo.getId() === 0) {
      ufo.setId(game.getId("STR_UFO"));
    }
    return ufo;
  }

  private getWaypoint(trajectory: UfoTrajectory, nextWaypoint: number, globe: GlobeLike, region: RuleRegion): [number, number] {
    const zone = trajectory.getZone(nextWaypoint);
    if (zone >= region.getMissionZones().length) {
      this.logMissionError(zone, region);
    }
    if (trajectory.getWaypointCount() > nextWaypoint + 1 && trajectory.getAltitude(nextWaypoint + 1) === "STR_GROUND") {
      return this.getLandPoint(globe, region, zone);
    }
    return region.getRandomPoint(zone);
  }

  private getLandPoint(globe: GlobeLike, region: RuleRegion, zone: number): [number, number] {
    if (zone >= region.getMissionZones().length || region.getMissionZones()[zone].areas.length === 0) {
      this.logMissionError(zone, region);
    }
    const firstArea = region.getMissionZones()[zone].areas[0];
    if (Math.abs(firstArea.lonMin - firstArea.lonMax) <= Number.EPSILON && Math.abs(firstArea.latMin - firstArea.latMax) <= Number.EPSILON) {
      return region.getRandomPoint(zone);
    }
    let pos: [number, number] = [0.0, 0.0];
    let tries = 0;
    do {
      pos = region.getRandomPoint(zone);
      ++tries;
    } while (!(globe.insideLand(pos[0], pos[1]) && region.insideRegion(pos[0], pos[1])) && tries < 100);
    return pos;
  }

  private logMissionError(zone: number, region: RuleRegion): never {
    if (region.getMissionZones().length > 0) {
      throw new Error(`Error occurred while trying to determine waypoint for mission type: ${this._rule.getType()} in region: ${region.getType()}, mission tried to find a waypoint in zone ${zone} but this region only has zones valid up to ${region.getMissionZones().length - 1}.`);
    }
    throw new Error(`Error occurred while trying to determine waypoint for mission type: ${this._rule.getType()} in region: ${region.getType()}, region has no valid zones.`);
  }
}
