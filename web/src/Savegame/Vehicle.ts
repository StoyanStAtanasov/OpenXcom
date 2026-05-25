import type { RuleItem } from "../Mod/RuleItem.ts";

export type VehicleSave = {
  type?: string;
  ammo?: number;
  size?: number;
};

/**
 * Represents a vehicle kept in a craft.
 */
export class Vehicle {
  constructor(private _rules: RuleItem, private _ammo: number, private _size: number) {}

  load(node: VehicleSave): void {
    this._ammo = node.ammo ?? this._ammo;
    this._size = node.size ?? this._size;
  }

  save(): VehicleSave {
    return {
      type: this._rules.getType(),
      ammo: this._ammo,
      size: this._size
    };
  }

  getRules(): RuleItem {
    return this._rules;
  }

  getAmmo(): number {
    if (this._ammo === -1) {
      return 255;
    }
    return this._ammo;
  }

  setAmmo(ammo: number): void {
    if (this._ammo !== -1) {
      this._ammo = ammo;
    }
  }

  getSize(): number {
    return this._size;
  }
}
