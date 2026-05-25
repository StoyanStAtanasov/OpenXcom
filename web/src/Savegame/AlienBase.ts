import type { AlienDeployment } from "../Mod/AlienDeployment.ts";
import type { Language } from "../Engine/Language.ts";
import { Target, type TargetSaveNode } from "./Target.ts";

export type AlienBaseSave = TargetSaveNode & {
  race?: string;
  inBattlescape?: boolean;
  discovered?: boolean;
  deployment?: string;
};

/**
 * Represents an alien base on the world.
 */
export class AlienBase extends Target {
  private _race = "";
  private _inBattlescape = false;
  private _discovered = false;

  constructor(private _deployment: AlienDeployment) {
    super();
  }

  load(node: AlienBaseSave): void {
    super.load(node);
    this._race = typeof node.race === "string" ? node.race : this._race;
    this._inBattlescape = typeof node.inBattlescape === "boolean" ? node.inBattlescape : this._inBattlescape;
    this._discovered = typeof node.discovered === "boolean" ? node.discovered : this._discovered;
  }

  save(): AlienBaseSave {
    const node: AlienBaseSave = {
      ...super.save(),
      race: this._race,
      deployment: this._deployment.getType()
    };
    if (this._inBattlescape) {
      node.inBattlescape = this._inBattlescape;
    }
    if (this._discovered) {
      node.discovered = this._discovered;
    }
    return node;
  }

  override saveId(): TargetSaveNode {
    return super.saveId();
  }

  getType(): string {
    return this._deployment.getMarkerName();
  }

  getMarkerName(): string {
    return this.getType();
  }

  getDefaultName(lang: Language): string {
    return String(lang.getString(this.getMarkerName()).arg(this._id));
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
