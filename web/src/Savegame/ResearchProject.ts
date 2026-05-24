import type { RuleResearch } from "../Mod/RuleResearch.ts";

const PROGRESS_LIMIT_UNKNOWN = 0.333;
const PROGRESS_LIMIT_POOR = 0.07;
const PROGRESS_LIMIT_AVERAGE = 0.13;
const PROGRESS_LIMIT_GOOD = 0.25;

export type ResearchProjectSaveNode = {
  project?: string;
  assigned?: number;
  spent?: number;
  cost?: number;
};

export class ResearchProject {
  private _assigned = 0;
  private _spent = 0;

  constructor(private _project: RuleResearch, private _cost = 0) {}

  step(): boolean {
    this._spent += this._assigned;
    return this.isFinished();
  }

  isFinished(): boolean {
    return this._spent >= this.getCost();
  }

  setAssigned(nb: number): void {
    this._assigned = nb;
  }

  getRules(): RuleResearch {
    return this._project;
  }

  getAssigned(): number {
    return this._assigned;
  }

  getSpent(): number {
    return this._spent;
  }

  setSpent(spent: number): void {
    this._spent = spent;
  }

  getCost(): number {
    return this._cost;
  }

  setCost(f: number): void {
    this._cost = f;
  }

  load(node: ResearchProjectSaveNode | null | undefined): void {
    if (!node) {
      return;
    }
    this.setAssigned(node.assigned ?? this.getAssigned());
    this.setSpent(node.spent ?? this.getSpent());
    this.setCost(node.cost ?? this.getCost());
  }

  save(): ResearchProjectSaveNode {
    return {
      project: this.getRules().getName(),
      assigned: this.getAssigned(),
      spent: this.getSpent(),
      cost: this.getCost()
    };
  }

  getResearchProgress(): string {
    const progress = this.getSpent() / this.getRules().getCost();
    if (this.getAssigned() === 0) {
      return "STR_NONE";
    } else if (progress <= PROGRESS_LIMIT_UNKNOWN) {
      return "STR_UNKNOWN";
    } else {
      const rating = this.getAssigned() / this.getRules().getCost();
      if (rating <= PROGRESS_LIMIT_POOR) {
        return "STR_POOR";
      } else if (rating <= PROGRESS_LIMIT_AVERAGE) {
        return "STR_AVERAGE";
      } else if (rating <= PROGRESS_LIMIT_GOOD) {
        return "STR_GOOD";
      }
      return "STR_EXCELLENT";
    }
  }
}
