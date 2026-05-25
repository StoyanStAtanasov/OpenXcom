import { RNG } from "../Engine/RNG.ts";
import type { RuleCountry } from "../Mod/RuleCountry.ts";

export type CountrySave = {
  type?: string;
  funding?: number[];
  activityXcom?: number[];
  activityAlien?: number[];
  pact?: boolean;
  newPact?: boolean;
};

function numberArray(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  return value.filter(entry => typeof entry === "number" && Number.isFinite(entry)).map(entry => Math.trunc(entry));
}

export class Country {
  private _pact = false;
  private _newPact = false;
  private _funding: number[] = [];
  private _activityXcom: number[] = [];
  private _activityAlien: number[] = [];
  private _satisfaction = 2;

  constructor(private _rules: RuleCountry, gen = true) {
    if (gen) {
      this._funding.push(this._rules.generateFunding());
    }
    this._activityAlien.push(0);
    this._activityXcom.push(0);
  }

  getRules(): RuleCountry {
    return this._rules;
  }

  load(node: CountrySave = {}): void {
    this._funding = numberArray(node.funding, this._funding);
    this._activityXcom = numberArray(node.activityXcom, this._activityXcom);
    this._activityAlien = numberArray(node.activityAlien, this._activityAlien);
    this._pact = typeof node.pact === "boolean" ? node.pact : this._pact;
    this._newPact = typeof node.newPact === "boolean" ? node.newPact : this._newPact;
  }

  save(): CountrySave {
    const node: CountrySave = {
      type: this._rules.getType(),
      funding: [...this._funding],
      activityXcom: [...this._activityXcom],
      activityAlien: [...this._activityAlien]
    };
    if (this._pact) {
      node.pact = this._pact;
    } else if (this._newPact) {
      node.newPact = this._newPact;
    }
    return node;
  }

  getFunding(): number[] {
    return this._funding;
  }

  setFunding(funding: number): void {
    this._funding[this._funding.length - 1] = funding;
  }

  getSatisfaction(): number {
    if (this._pact) {
      return 0;
    }
    return this._satisfaction;
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

  newMonth(xcomTotal: number, alienTotal: number, pactScore: number): void {
    this._satisfaction = 2;
    const funding = this.getFunding().at(-1) || 0;
    const good = Math.trunc(xcomTotal / 10) + (this._activityXcom.at(-1) || 0);
    const bad = Math.trunc(alienTotal / 20) + (this._activityAlien.at(-1) || 0);
    const oldFunding = Math.trunc(funding / 1000);
    let newFunding = Math.trunc(oldFunding * RNG.generate(5, 20) / 100) * 1000;

    if (bad <= good + 30) {
      if (good > bad + 30 && RNG.generate(0, good) > bad) {
        const cap = this.getRules().getFundingCap() * 1000;
        if (funding + newFunding > cap) {
          newFunding = cap - funding;
        }
        if (newFunding) {
          this._satisfaction = 3;
        }
      }
    } else if (RNG.generate(0, bad) > good && newFunding) {
      newFunding = -newFunding;
      if (funding + newFunding < 0) {
        newFunding = 0 - funding;
      }
      if (newFunding) {
        this._satisfaction = 1;
      }
    }

    if (this._newPact && !this._pact) {
      this._newPact = false;
      this._pact = true;
      this.addActivityAlien(pactScore);
    }

    if (this._pact) {
      this._funding.push(0);
    } else if (this._satisfaction !== 2) {
      this._funding.push(funding + newFunding);
    } else {
      this._funding.push(funding);
    }
    this._activityAlien.push(0);
    this._activityXcom.push(0);
    if (this._activityAlien.length > 12) {
      this._activityAlien.shift();
    }
    if (this._activityXcom.length > 12) {
      this._activityXcom.shift();
    }
    if (this._funding.length > 12) {
      this._funding.shift();
    }
  }

  getNewPact(): boolean {
    return this._newPact;
  }

  setNewPact(): void {
    this._newPact = true;
  }

  getPact(): boolean {
    return this._pact;
  }

  setPact(): void {
    this._pact = true;
  }
}
