import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { formatPercentage, TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextEdit } from "../Interface/TextEdit.ts";
import { POPUP_BOTH, POPUP_NONE, Window } from "../Interface/Window.ts";
import type { Base } from "../Savegame/Base.ts";
import type { Craft } from "../Savegame/Craft.ts";
import { CraftArmorState } from "./CraftArmorState.ts";
import { CraftEquipmentState } from "./CraftEquipmentState.ts";
import { CraftSoldiersState } from "./CraftSoldiersState.ts";
import { CraftWeaponsState } from "./CraftWeaponsState.ts";

/**
 * Craft Info screen that shows all the info of a specific craft.
 */
export class CraftInfoState extends State {
  private _craft: Craft | null = null;
  private _btnOk: TextButton;
  private _btnW1: TextButton;
  private _btnW2: TextButton;
  private _btnCrew: TextButton;
  private _btnEquip: TextButton;
  private _btnArmor: TextButton;
  private _window: Window;
  private _edtCraft: TextEdit;
  private _txtDamage: Text;
  private _txtFuel: Text;
  private _txtW1Name: Text;
  private _txtW1Ammo: Text;
  private _txtW2Name: Text;
  private _txtW2Ammo: Text;
  private _sprite: Surface;
  private _weapon1: Surface;
  private _weapon2: Surface;
  private _crew: Surface;
  private _equip: Surface;

  constructor(private _base: Base, private _craftId: number) {
    super();

    if ((this.game().getSavedGame()?.getMonthsPassed() ?? -1) !== -1) {
      this._window = new Window(this, 320, 200, 0, 0, POPUP_BOTH);
    } else {
      this._window = new Window(this, 320, 200, 0, 0, POPUP_NONE);
    }
    this._btnOk = new TextButton(64, 24, 128, 168);
    this._btnW1 = new TextButton(24, 32, 14, 48);
    this._btnW2 = new TextButton(24, 32, 282, 48);
    this._btnCrew = new TextButton(64, 16, 14, 96);
    this._btnEquip = new TextButton(64, 16, 14, 120);
    this._btnArmor = new TextButton(64, 16, 14, 144);
    this._edtCraft = new TextEdit(this, 140, 16, 80, 8);
    this._txtDamage = new Text(100, 17, 14, 24);
    this._txtFuel = new Text(82, 17, 228, 24);
    this._txtW1Name = new Text(95, 16, 46, 48);
    this._txtW1Ammo = new Text(75, 24, 46, 64);
    this._txtW2Name = new Text(95, 16, 184, 48);
    this._txtW2Ammo = new Text(75, 24, 204, 64);
    this._sprite = new Surface(32, 40, 144, 52);
    this._weapon1 = new Surface(15, 17, 121, 63);
    this._weapon2 = new Surface(15, 17, 184, 63);
    this._crew = new Surface(220, 18, 85, 96);
    this._equip = new Surface(220, 18, 85, 121);

    this.setInterface("craftInfo");

    this.add(this._window, "window", "craftInfo");
    this.add(this._btnOk, "button", "craftInfo");
    this.add(this._btnW1, "button", "craftInfo");
    this.add(this._btnW2, "button", "craftInfo");
    this.add(this._btnCrew, "button", "craftInfo");
    this.add(this._btnEquip, "button", "craftInfo");
    this.add(this._btnArmor, "button", "craftInfo");
    this.add(this._edtCraft, "text1", "craftInfo");
    this.add(this._txtDamage, "text1", "craftInfo");
    this.add(this._txtFuel, "text1", "craftInfo");
    this.add(this._txtW1Name, "text2", "craftInfo");
    this.add(this._txtW1Ammo, "text3", "craftInfo");
    this.add(this._txtW2Name, "text2", "craftInfo");
    this.add(this._txtW2Ammo, "text3", "craftInfo");
    this.add(this._sprite);
    this.add(this._weapon1);
    this.add(this._weapon2);
    this.add(this._crew);
    this.add(this._equip);

    this.centerAllSurfaces();

    const back14 = this.game().getMod()?.getSurface("BACK14.SCR");
    if (back14) {
      this._window.setBackground(back14);
    }

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);

    this._btnW1.setText("1");
    this._btnW1.onMouseClick(this.btnW1Click.bind(this));

    this._btnW2.setText("2");
    this._btnW2.onMouseClick(this.btnW2Click.bind(this));

    this._btnCrew.setText(String(this.tr("STR_CREW")));
    this._btnCrew.onMouseClick(this.btnCrewClick.bind(this));

    this._btnEquip.setText(String(this.tr("STR_EQUIPMENT_UC")));
    this._btnEquip.onMouseClick(this.btnEquipClick.bind(this));

    this._btnArmor.setText(String(this.tr("STR_ARMOR")));
    this._btnArmor.onMouseClick(this.btnArmorClick.bind(this));

    this._edtCraft.setBig();
    this._edtCraft.setAlign(ALIGN_CENTER);
    this._edtCraft.onChange(this.edtCraftChange.bind(this));

    this._txtW1Name.setWordWrap(true);
    this._txtW2Name.setWordWrap(true);
  }

  /**
   * The craft info can change after going into other screens.
   */
  override init(): void {
    super.init();

    this._craft = this._base.getCrafts()[this._craftId] || null;
    if (!this._craft) {
      this.game().popState();
      return;
    }

    this._edtCraft.setText(this._craft.getName(this.game().getLanguage()));

    const texture = this.game().getMod()?.getSurfaceSet("BASEBITS.PCK") || null;
    this._sprite.clear();
    const craftFrame = texture?.getFrame(this._craft.getRules().getSprite() + 33);
    if (craftFrame) {
      craftFrame.setX(0);
      craftFrame.setY(0);
      craftFrame.blit(this._sprite);
    }

    let firstLine = String(this.tr("STR_DAMAGE_UC_").arg(formatPercentage(this._craft.getDamagePercentage())));
    if (this._craft.getStatus() === "STR_REPAIRS" && this._craft.getDamage() > 0) {
      const damageHours = Math.ceil(this._craft.getDamage() / this._craft.getRules().getRepairRate());
      firstLine += this.formatTime(damageHours);
    }
    this._txtDamage.setText(firstLine);

    let secondLine = String(this.tr("STR_FUEL").arg(formatPercentage(this._craft.getFuelPercentage())));
    if (this._craft.getStatus() === "STR_REFUELLING" && this._craft.getRules().getMaxFuel() - this._craft.getFuel() > 0) {
      const fuelHours = Math.ceil((this._craft.getRules().getMaxFuel() - this._craft.getFuel()) / this._craft.getRules().getRefuelRate() / 2.0);
      secondLine += this.formatTime(fuelHours);
    }
    this._txtFuel.setText(secondLine);

    if (this._craft.getRules().getSoldiers() > 0) {
      this._crew.setVisible(true);
      this._equip.setVisible(true);
      this._btnCrew.setVisible(true);
      this._btnEquip.setVisible(true);
      this._btnArmor.setVisible(true);

      this._crew.clear();
      this._equip.clear();

      const frame1 = texture?.getFrame(38);
      if (frame1) {
        frame1.setY(0);
        for (let i = 0, x = 0; i < this._craft.getNumSoldiers(); ++i, x += 10) {
          frame1.setX(x);
          frame1.blit(this._crew);
        }
      }

      const frame2 = texture?.getFrame(40);
      let x = 0;
      if (frame2) {
        frame2.setY(0);
        for (let i = 0; i < this._craft.getNumVehicles(); ++i, x += 10) {
          frame2.setX(x);
          frame2.blit(this._equip);
        }
      }

      const frame3 = texture?.getFrame(39);
      if (frame3) {
        for (let i = 0; i < this._craft.getNumEquipment(); i += 4, x += 10) {
          frame3.setX(x);
          frame3.blit(this._equip);
        }
      }
    } else {
      this._crew.setVisible(false);
      this._equip.setVisible(false);
      this._btnCrew.setVisible(false);
      this._btnEquip.setVisible(false);
      this._btnArmor.setVisible(false);
    }

    this.updateWeaponSlot(0, this._weapon1, this._btnW1, this._txtW1Name, this._txtW1Ammo);
    this.updateWeaponSlot(1, this._weapon2, this._btnW2, this._txtW2Name, this._txtW2Ammo);
  }

  /**
   * Turns an amount of time into a day/hour string.
   */
  private formatTime(total: number): string {
    const days = Math.trunc(total / 24);
    const hours = total % 24;
    let result = "\n(";
    if (days > 0) {
      result += `${String(this.tr("STR_DAY", days))}/`;
    }
    if (hours > 0) {
      result += String(this.tr("STR_HOUR", hours));
    }
    result += ")";
    return result;
  }

  /**
   * Returns to the previous screen.
   */
  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  /**
   * Goes to the Select Armament window for the first weapon.
   */
  btnW1Click(_action?: Action): void {
    this.game().pushState(new CraftWeaponsState(this._base, this._craftId, 0));
  }

  /**
   * Goes to the Select Armament window for the second weapon.
   */
  btnW2Click(_action?: Action): void {
    this.game().pushState(new CraftWeaponsState(this._base, this._craftId, 1));
  }

  /**
   * Goes to the Select Squad screen.
   */
  btnCrewClick(_action?: Action): void {
    this.game().pushState(new CraftSoldiersState(this._base, this._craftId));
  }

  /**
   * Goes to the Select Equipment screen.
   */
  btnEquipClick(_action?: Action): void {
    this.game().pushState(new CraftEquipmentState(this._base, this._craftId));
  }

  /**
   * Goes to the Select Armor screen.
   */
  btnArmorClick(_action?: Action): void {
    this.game().pushState(new CraftArmorState(this._base, this._craftId));
  }

  /**
   * Changes the Craft name.
   */
  edtCraftChange(action?: Action): void {
    if (!this._craft) {
      return;
    }
    if (this._edtCraft.getText() === this._craft.getDefaultName(this.game().getLanguage())) {
      this._craft.setName("");
    } else {
      this._craft.setName(this._edtCraft.getText());
    }

    const sym = action?.getDetails().key?.keysym.sym;
    if (sym === "Enter" || sym === "NumpadEnter") {
      this._edtCraft.setText(this._craft.getName(this.game().getLanguage()));
    }
  }

  private updateWeaponSlot(slot: number, surface: Surface, button: TextButton, name: Text, ammo: Text): void {
    if (!this._craft) {
      return;
    }
    if (this._craft.getRules().getWeapons() <= slot) {
      surface.setVisible(false);
      button.setVisible(false);
      name.setVisible(false);
      ammo.setVisible(false);
      return;
    }

    surface.setVisible(true);
    button.setVisible(true);
    name.setVisible(true);
    ammo.setVisible(true);
    surface.clear();

    const weapon = this._craft.getWeapons()[slot] || null;
    if (!weapon) {
      name.setText("");
      ammo.setText("");
      return;
    }

    const frame = this.game().getMod()?.getSurfaceSet("BASEBITS.PCK")?.getFrame(weapon.getRules().getSprite() + 48);
    if (frame) {
      frame.setX(0);
      frame.setY(0);
      frame.blit(surface);
    }

    name.setText(`${String.fromCharCode(TOK_COLOR_FLIP)}${String(this.tr(weapon.getRules().getType()))}`);
    let ammoLine = `${String(this.tr("STR_AMMO_").arg(weapon.getAmmo()))}\n${String.fromCharCode(TOK_COLOR_FLIP)}`;
    ammoLine += String(this.tr("STR_MAX").arg(weapon.getRules().getAmmoMax()));
    if (this._craft.getStatus() === "STR_REARMING" && weapon.getAmmo() < weapon.getRules().getAmmoMax()) {
      const rearmHours = Math.ceil((weapon.getRules().getAmmoMax() - weapon.getAmmo()) / weapon.getRules().getRearmRate());
      ammoLine += this.formatTime(rearmHours);
    }
    ammo.setText(ammoLine);
  }
}
