import type { RuleRegion } from "../Mod/RuleRegion.ts";

export class Region {
  private _activityXcom: number[] = [0];
  private _activityAlien: number[] = [0];

  constructor(private _rules: RuleRegion) {}

  getRules(): RuleRegion {
    return this._rules;
  }

  addActivityXcom(activity: number): void {
    this._activityXcom[this._activityXcom.length - 1] += activity;
  }

  addActivityAlien(activity: number): void {
    this._activityAlien[this._activityAlien.length - 1] += activity;
  }

  getActivityXcom(): number[] {
    return this._activityXcom;
  }

  getActivityAlien(): number[] {
    return this._activityAlien;
  }

  newMonth(): void {
    this._activityAlien.push(0);
    this._activityXcom.push(0);
    if (this._activityAlien.length > 12) {
      this._activityAlien.shift();
    }
    if (this._activityXcom.length > 12) {
      this._activityXcom.shift();
    }
  }
}
