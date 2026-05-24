import type { RuleBaseFacility, BaseFacilityPlacement } from "../Mod/RuleBaseFacility.ts";
import type { Base } from "./Base.ts";
import type { Craft } from "./Craft.ts";

export class BaseFacility {
  private _x = 0;
  private _y = 0;
  private _buildTime = 0;
  private _craftForDrawing: Craft | null = null;

  constructor(private _rules: RuleBaseFacility, private _base: Base) {}

  load(node: BaseFacilityPlacement): void {
    this._x = node.x ?? this._x;
    this._y = node.y ?? this._y;
    this._buildTime = node.buildTime ?? this._buildTime;
  }

  getRules(): RuleBaseFacility {
    return this._rules;
  }

  getBase(): Base {
    return this._base;
  }

  getX(): number {
    return this._x;
  }

  setX(x: number): void {
    this._x = x;
  }

  getY(): number {
    return this._y;
  }

  setY(y: number): void {
    this._y = y;
  }

  getBuildTime(): number {
    return this._buildTime;
  }

  setBuildTime(time: number): void {
    this._buildTime = time;
  }

  build(): void {
    if (this._buildTime > 0) {
      --this._buildTime;
    }
  }

  inUse(): boolean {
    if (this._buildTime > 0) {
      return false;
    }
    return (this._rules.getPersonnel() > 0 && this._base.getAvailableQuarters() - this._rules.getPersonnel() < this._base.getUsedQuarters()) ||
      (this._rules.getStorage() > 0 && this._base.getAvailableStores() - this._rules.getStorage() < this._base.getUsedStores()) ||
      (this._rules.getLaboratories() > 0 && this._base.getAvailableLaboratories() - this._rules.getLaboratories() < this._base.getUsedLaboratories()) ||
      (this._rules.getWorkshops() > 0 && this._base.getAvailableWorkshops() - this._rules.getWorkshops() < this._base.getUsedWorkshops()) ||
      (this._rules.getCrafts() > 0 && this._base.getAvailableHangars() - this._rules.getCrafts() < this._base.getUsedHangars()) ||
      (this._rules.getPsiLaboratories() > 0 && this._base.getAvailablePsiLabs() - this._rules.getPsiLaboratories() < this._base.getUsedPsiLabs()) ||
      (this._rules.getAliens() > 0 && this._base.getAvailableContainment() - this._rules.getAliens() < this._base.getUsedContainment());
  }

  getCraft(): Craft | null {
    return this._craftForDrawing;
  }

  setCraft(craft: Craft | null): void {
    this._craftForDrawing = craft;
  }
}
