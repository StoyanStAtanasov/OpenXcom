import type { AlienDeployment } from "../Mod/AlienDeployment.ts";
import type { Language } from "../Engine/Language.ts";

export type AlienBaseSave = {
  lon?: number;
  lat?: number;
  id?: number;
  name?: string;
  race?: string;
  inBattlescape?: boolean;
  discovered?: boolean;
  deployment?: string;
};

/**
 * Represents an alien base on the world.
 */
export class AlienBase {
  private _lon = 0.0;
  private _lat = 0.0;
  private _id = 0;
  private _name = "";
  private _race = "";
  private _inBattlescape = false;
  private _discovered = false;

  constructor(private _deployment: AlienDeployment) {}

  load(node: AlienBaseSave): void {
    this._lon = typeof node.lon === "number" ? node.lon : this._lon;
    this._lat = typeof node.lat === "number" ? node.lat : this._lat;
    this._id = typeof node.id === "number" ? node.id : this._id;
    this._name = typeof node.name === "string" ? node.name : this._name;
    this._race = typeof node.race === "string" ? node.race : this._race;
    this._inBattlescape = typeof node.inBattlescape === "boolean" ? node.inBattlescape : this._inBattlescape;
    this._discovered = typeof node.discovered === "boolean" ? node.discovered : this._discovered;
  }

  save(): AlienBaseSave {
    const node: AlienBaseSave = {
      lon: this._lon,
      lat: this._lat,
      id: this._id,
      race: this._race,
      deployment: this._deployment.getType()
    };
    if (this._name) {
      node.name = this._name;
    }
    if (this._inBattlescape) {
      node.inBattlescape = this._inBattlescape;
    }
    if (this._discovered) {
      node.discovered = this._discovered;
    }
    return node;
  }

  getType(): string {
    return this._deployment.getMarkerName();
  }

  getLongitude(): number {
    return this._lon;
  }

  setLongitude(lon: number): void {
    this._lon = lon;
  }

  getLatitude(): number {
    return this._lat;
  }

  setLatitude(lat: number): void {
    this._lat = lat;
  }

  getId(): number {
    return this._id;
  }

  setId(id: number): void {
    this._id = id;
  }

  getMarkerName(): string {
    return this.getType();
  }

  getDefaultName(lang: Language): string {
    return String(lang.getString(this.getMarkerName()).arg(this._id));
  }

  getName(lang: Language): string {
    return this._name || this.getDefaultName(lang);
  }

  setName(name: string): void {
    this._name = name;
  }

  getMarker(): number {
    if (!this._discovered) {
      return -1;
    }
    return this._deployment.getMarkerIcon();
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

  isDiscovered(): boolean {
    return this._discovered;
  }

  setDiscovered(discovered: boolean): void {
    this._discovered = discovered;
  }

  getDeployment(): AlienDeployment {
    return this._deployment;
  }
}
