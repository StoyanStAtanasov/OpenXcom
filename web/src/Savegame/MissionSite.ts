import type { Language } from "../Engine/Language.ts";
import type { AlienDeployment } from "../Mod/AlienDeployment.ts";
import type { RuleAlienMission } from "../Mod/RuleAlienMission.ts";
import { Target } from "./Target.ts";

export type MissionSiteSave = {
  lon?: number;
  lat?: number;
  id?: number;
  name?: string;
  type?: string;
  deployment?: string;
  texture?: number;
  secondsRemaining?: number;
  race?: string;
  inBattlescape?: boolean;
  detected?: boolean;
};

/**
 * Represents an alien mission site on the world.
 */
export class MissionSite extends Target {
  private _texture = -1;
  private _secondsRemaining = 0;
  private _race = "";
  private _city = "";
  private _inBattlescape = false;
  private _detected = false;

  constructor(private _rules: RuleAlienMission, private _deployment: AlienDeployment) {
    super();
  }

  load(node: MissionSiteSave): void {
    this._lon = typeof node.lon === "number" ? node.lon : this._lon;
    this._lat = typeof node.lat === "number" ? node.lat : this._lat;
    this._id = typeof node.id === "number" ? node.id : this._id;
    this._name = typeof node.name === "string" ? node.name : this._name;
    this._texture = typeof node.texture === "number" ? node.texture : this._texture;
    this._secondsRemaining = typeof node.secondsRemaining === "number" ? node.secondsRemaining : this._secondsRemaining;
    this._race = typeof node.race === "string" ? node.race : this._race;
    this._inBattlescape = typeof node.inBattlescape === "boolean" ? node.inBattlescape : this._inBattlescape;
    this._detected = typeof node.detected === "boolean" ? node.detected : this._detected;
  }

  save(): MissionSiteSave {
    const node: MissionSiteSave = {
      lon: this._lon,
      lat: this._lat,
      type: this._rules.getType(),
      deployment: this._deployment.getType(),
      texture: this._texture,
      race: this._race,
      detected: this._detected
    };
    if (this._id) {
      node.id = this._id;
    }
    if (this._name) {
      node.name = this._name;
    }
    if (this._secondsRemaining) {
      node.secondsRemaining = this._secondsRemaining;
    }
    if (this._inBattlescape) {
      node.inBattlescape = this._inBattlescape;
    }
    return node;
  }

  getType(): string {
    return this._deployment.getMarkerName();
  }

  getRules(): RuleAlienMission {
    return this._rules;
  }

  getDeployment(): AlienDeployment {
    return this._deployment;
  }

  getMarkerName(): string {
    return this.getType();
  }

  getDefaultName(lang: Language): string {
    return String(lang.getString(this.getMarkerName()).arg(this._id));
  }

  getMarker(): number {
    if (!this._detected) {
      return -1;
    }
    const marker = this._deployment.getMarkerIcon();
    return marker === -1 ? 5 : marker;
  }

  getSecondsRemaining(): number {
    return this._secondsRemaining;
  }

  setSecondsRemaining(seconds: number): void {
    this._secondsRemaining = seconds;
  }

  getAlienRace(): string {
    return this._race;
  }

  setAlienRace(race: string): void {
    this._race = race;
  }

  setInBattlescape(inbattle: boolean): void {
    this._inBattlescape = inbattle;
  }

  isInBattlescape(): boolean {
    return this._inBattlescape;
  }

  getTexture(): number {
    return this._texture;
  }

  setTexture(texture: number): void {
    this._texture = texture;
  }

  getCity(): string {
    return this._city;
  }

  setCity(city: string): void {
    this._city = city;
  }

  getDetected(): boolean {
    return this._detected;
  }

  setDetected(detected: boolean): void {
    this._detected = detected;
  }
}
