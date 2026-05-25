import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { formatPercentage } from "../Engine/Unicode.ts";
import { BattleType, ItemDamageType } from "../Mod/RuleItem.ts";
import { UnitFaction, UnitStatus, type BattleUnit } from "../Savegame/BattleUnit.ts";
import { SDL_BUTTON_RIGHT, SDL_KEYDOWN, SDL_MOUSEBUTTONDOWN } from "../types.ts";
import { ActionMenuItem } from "./ActionMenuItem.ts";
import { BattleActionType, type BattleAction } from "./BattlescapeGame.ts";
import { MedikitState } from "./MedikitState.ts";
import { PrimeGrenadeState } from "./PrimeGrenadeState.ts";
import { ScannerState } from "./ScannerState.ts";
import type { Action } from "../Engine/Action.ts";

/**
 * Context-sensitive battlescape item action popup menu.
 */
export class ActionMenuState extends State {
  private _actionMenu: ActionMenuItem[] = [];

  constructor(private _action: BattleAction, x: number, y: number) {
    super();
    this._screen = false;

    this.game().getSavedGame()?.getSavedBattle()?.setPaletteByDepth(this);

    for (let i = 0; i < 6; ++i) {
      this._actionMenu[i] = new ActionMenuItem(i, this.game(), x, y);
      this.add(this._actionMenu[i]);
      this._actionMenu[i].setVisible(false);
      this._actionMenu[i].onMouseClick(this.btnActionMenuItemClick.bind(this));
    }

    const weaponItem = this._action.weapon;
    const actor = this._action.actor;
    if (!weaponItem || !actor) {
      return;
    }

    const id = { value: 0 };
    const weapon = weaponItem.getRules();

    if (!weapon.isFixed()) {
      this.addItem(BattleActionType.BA_THROW, "STR_THROW", id);
    }

    if ((weapon.getBattleType() === BattleType.BT_GRENADE || weapon.getBattleType() === BattleType.BT_PROXIMITYGRENADE) &&
      weaponItem.getFuseTimer() === -1) {
      this.addItem(BattleActionType.BA_PRIME, "STR_PRIME_GRENADE", id);
    }

    if (weapon.getBattleType() === BattleType.BT_FIREARM) {
      if (weapon.getWaypoints() !== 0 || (weaponItem.getAmmoItem() && weaponItem.getAmmoItem()!.getRules().getWaypoints() !== 0)) {
        this.addItem(BattleActionType.BA_LAUNCH, "STR_LAUNCH_MISSILE", id);
      } else {
        if (weapon.getAccuracyAuto() !== 0) {
          this.addItem(BattleActionType.BA_AUTOSHOT, "STR_AUTO_SHOT", id);
        }
        if (weapon.getAccuracySnap() !== 0) {
          this.addItem(BattleActionType.BA_SNAPSHOT, "STR_SNAP_SHOT", id);
        }
        if (weapon.getAccuracyAimed() !== 0) {
          this.addItem(BattleActionType.BA_AIMEDSHOT, "STR_AIMED_SHOT", id);
        }
      }
    }

    if (weapon.getTUMelee()) {
      if (weapon.getBattleType() === BattleType.BT_MELEE && weapon.getDamageType() === ItemDamageType.DT_STUN) {
        this.addItem(BattleActionType.BA_HIT, "STR_STUN", id);
      } else {
        this.addItem(BattleActionType.BA_HIT, "STR_HIT_MELEE", id);
      }
    } else if (weapon.getBattleType() === BattleType.BT_MEDIKIT) {
      this.addItem(BattleActionType.BA_USE, "STR_USE_MEDI_KIT", id);
    } else if (weapon.getBattleType() === BattleType.BT_SCANNER) {
      this.addItem(BattleActionType.BA_USE, "STR_USE_SCANNER", id);
    } else if (weapon.getBattleType() === BattleType.BT_PSIAMP && actor.getBaseStats().psiSkill > 0) {
      this.addItem(BattleActionType.BA_MINDCONTROL, "STR_MIND_CONTROL", id);
      this.addItem(BattleActionType.BA_PANIC, "STR_PANIC_UNIT", id);
    } else if (weapon.getBattleType() === BattleType.BT_MINDPROBE) {
      this.addItem(BattleActionType.BA_USE, "STR_USE_MIND_PROBE", id);
    }
  }

  private addItem(ba: BattleActionType, name: string, id: { value: number }): void {
    const actor = this._action.actor;
    const weapon = this._action.weapon;
    if (!actor || !weapon) {
      return;
    }

    let s1 = "";
    let acc = actor.getFiringAccuracy(ba, weapon);
    if (ba === BattleActionType.BA_THROW) {
      acc = Math.trunc(actor.getThrowingAccuracy());
    }
    const tu = actor.getActionTUs(ba, weapon);

    if (ba === BattleActionType.BA_THROW ||
      ba === BattleActionType.BA_AIMEDSHOT ||
      ba === BattleActionType.BA_SNAPSHOT ||
      ba === BattleActionType.BA_AUTOSHOT ||
      ba === BattleActionType.BA_LAUNCH ||
      ba === BattleActionType.BA_HIT) {
      s1 = String(this.tr("STR_ACCURACY_SHORT").arg(formatPercentage(acc)));
    }
    const s2 = String(this.tr("STR_TIME_UNITS_SHORT").arg(tu));
    this._actionMenu[id.value].setAction(ba, String(this.tr(name)), s1, s2, tu);
    this._actionMenu[id.value].setVisible(true);
    id.value++;
  }

  override handle(action: Action): void {
    super.handle(action);
    const details = action.getDetails();
    if (details.type === SDL_MOUSEBUTTONDOWN && details.button?.button === SDL_BUTTON_RIGHT) {
      this.game().popState();
    } else if (details.type === SDL_KEYDOWN &&
      (details.key?.keysym.sym === Options.keyCancel ||
        details.key?.keysym.sym === Options.keyBattleUseLeftHand ||
        details.key?.keysym.sym === Options.keyBattleUseRightHand)) {
      this.game().popState();
    }
  }

  btnActionMenuItemClick(action: Action): void {
    const save = this.game().getSavedGame()?.getSavedBattle();
    save?.getPathfinding()?.removePreview();

    let btnID = -1;
    const weaponItem = this._action.weapon;
    const actor = this._action.actor;
    if (!weaponItem || !actor || !save) {
      return;
    }

    const weapon = weaponItem.getRules();
    const weaponUsable = save.getItemUsable(weaponItem);

    for (let i = 0; i < this._actionMenu.length && btnID === -1; ++i) {
      if (action.getSender() === this._actionMenu[i]) {
        btnID = i;
      }
    }

    if (btnID === -1) {
      return;
    }

    this._action.type = this._actionMenu[btnID].getAction();
    this._action.TU = this._actionMenu[btnID].getTUs();
    if (this._action.type !== BattleActionType.BA_THROW &&
      actor.getOriginalFaction() === UnitFaction.FACTION_PLAYER &&
      !this.game().getSavedGame()?.isResearched(weapon.getRequirements())) {
      this._action.result = "STR_UNABLE_TO_USE_ALIEN_ARTIFACT_UNTIL_RESEARCHED";
      this.game().popState();
    } else if (this._action.type !== BattleActionType.BA_THROW && weaponUsable.length > 0) {
      this._action.result = weaponUsable;
      this.game().popState();
    } else if (this._action.type === BattleActionType.BA_PRIME) {
      if (weapon.getBattleType() === BattleType.BT_PROXIMITYGRENADE) {
        this._action.value = 0;
        this.game().popState();
      } else {
        this.game().pushState(new PrimeGrenadeState(this._action, false, null));
      }
    } else if (this._action.type === BattleActionType.BA_USE && weapon.getBattleType() === BattleType.BT_MEDIKIT) {
      const targetUnit = this.findMedikitTarget(actor);
      if (targetUnit) {
        this.game().popState();
        this.game().pushState(new MedikitState(targetUnit, this._action));
      } else {
        this._action.result = "STR_THERE_IS_NO_ONE_THERE";
        this.game().popState();
      }
    } else if (this._action.type === BattleActionType.BA_USE && weapon.getBattleType() === BattleType.BT_SCANNER) {
      if (actor.spendTimeUnits(this._action.TU)) {
        this.game().popState();
        this.game().pushState(new ScannerState(this._action));
        return;
      }
      this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      this.game().popState();
    } else if (this._action.type === BattleActionType.BA_LAUNCH) {
      if (this._action.TU > actor.getTimeUnits()) {
        this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      } else if (!weaponItem.getAmmoItem() || (weaponItem.getAmmoItem() && weaponItem.getAmmoItem()!.getAmmoQuantity() === 0)) {
        this._action.result = "STR_NO_AMMUNITION_LOADED";
      } else {
        this._action.targeting = true;
      }
      this.game().popState();
    } else if (this._action.type === BattleActionType.BA_HIT) {
      if (this._action.TU > actor.getTimeUnits()) {
        this._action.result = "STR_NOT_ENOUGH_TIME_UNITS";
      } else if (!save.getTileEngine()?.validMeleeRange(actor.getPosition(), actor.getDirection(), actor, null, this._action.target)) {
        this._action.result = "STR_THERE_IS_NO_ONE_THERE";
      }
      this.game().popState();
    } else {
      this._action.targeting = true;
      this.game().popState();
    }

    if (this._action.type === BattleActionType.BA_HIT && this._action.result.length > 0) {
      this._action.type = BattleActionType.BA_NONE;
    }
  }

  override resize(dX: { value: number }, dY: { value: number }): void {
    this.recenter(dX.value, dY.value * 2);
  }

  private findMedikitTarget(actor: BattleUnit): BattleUnit | null {
    const save = this.game().getSavedGame()?.getSavedBattle();
    if (!save) {
      return null;
    }

    for (const unit of save.getUnits()) {
      if (unit.getPosition().equals(actor.getPosition()) &&
        unit !== actor &&
        unit.getStatus() === UnitStatus.STATUS_UNCONSCIOUS &&
        unit.isWoundable()) {
        return unit;
      }
    }

    if (save.getTileEngine()?.validMeleeRange(actor.getPosition(), actor.getDirection(), actor, null, this._action.target, false)) {
      const tile = save.getTile(this._action.target);
      if (tile?.getUnit() && tile.getUnit()!.isWoundable()) {
        return tile.getUnit();
      }
    }

    return null;
  }

}
