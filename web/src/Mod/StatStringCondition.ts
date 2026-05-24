export class StatStringCondition {
  constructor(private _conditionName: string, private _minVal: number, private _maxVal: number) {}

  getConditionName(): string {
    return this._conditionName;
  }

  getMinVal(): number {
    return this._minVal;
  }

  getMaxVal(): number {
    return this._maxVal;
  }

  isMet(stat: number, psi: boolean): boolean {
    if (this._conditionName === "psiTraining") {
      return true;
    }
    let conditionMet = stat >= this._minVal && stat <= this._maxVal;
    if (this._conditionName === "psiStrength" || this._conditionName === "psiSkill") {
      conditionMet = conditionMet && psi;
    }
    return conditionMet;
  }
}
