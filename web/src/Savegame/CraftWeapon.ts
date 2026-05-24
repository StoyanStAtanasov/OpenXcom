import type { RuleCraftWeapon } from "../Mod/RuleCraftWeapon.ts";

export type CraftWeaponSaveNode = {
  ammo?: number;
  rearming?: boolean;
};

export class CraftWeapon {
  private _ammo = 0;
  private _rearming = false;

  constructor(private _rules: RuleCraftWeapon, ammo = 0) {
    this.setAmmo(ammo);
  }

  load(node: CraftWeaponSaveNode | null | undefined): void {
    if (!node) {
      return;
    }
    if (node.ammo != null) {
      this.setAmmo(node.ammo);
    }
    this._rearming = node.rearming ?? this._rearming;
  }

  save(): CraftWeaponSaveNode {
    const node: CraftWeaponSaveNode = { ammo: this._ammo };
    if (this._rearming) {
      node.rearming = true;
    }
    return node;
  }

  getRules(): RuleCraftWeapon {
    return this._rules;
  }

  getAmmo(): number {
    return this._ammo;
  }

  setAmmo(ammo: number): boolean {
    if (ammo < 0) {
      this._ammo = 0;
      return false;
    }
    this._ammo = Math.min(ammo, this._rules.getAmmoMax());
    return true;
  }

  isRearming(): boolean {
    return this._rearming;
  }

  setRearming(rearming: boolean): void {
    this._rearming = rearming;
  }

  rearm(available: number, clipSize: number): number {
    let ammoUsed = this._rules.getRearmRate();
    if (clipSize > 0) {
      const needed = Math.trunc(Math.min(this._rules.getRearmRate(), this._rules.getAmmoMax() - this._ammo + clipSize - 1) / clipSize);
      ammoUsed = Math.min(needed, available) * clipSize;
    }
    this.setAmmo(this._ammo + ammoUsed);
    this._rearming = this._ammo < this._rules.getAmmoMax();
    return clipSize <= 0 ? 0 : Math.trunc(ammoUsed / clipSize);
  }

  getClipsLoaded(mod: { getItem?: (id: string, error?: boolean) => { getClipSize: () => number } | null } | null): number {
    const rearmRate = this._rules.getRearmRate();
    let clips = rearmRate > 0 ? Math.floor(this._ammo / rearmRate) : 0;
    const clip = mod?.getItem?.(this._rules.getClipItem());
    if (clip && clip.getClipSize() > 0) {
      clips = Math.floor(this._ammo / clip.getClipSize());
    }
    return clips;
  }
}
