import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_BOTTOM, ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_BOTH, Window } from "../Interface/Window.ts";
import type { RuleCraftWeapon } from "../Mod/RuleCraftWeapon.ts";
import type { Base } from "../Savegame/Base.ts";
import { CraftWeapon } from "../Savegame/CraftWeapon.ts";

/**
 * Select Armament window for changing the weapon equipped on a craft.
 */
export class CraftWeaponsState extends State {
  private _btnCancel: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtArmament: Text;
  private _txtQuantity: Text;
  private _txtAmmunition: Text;
  private _lstWeapons: TextList;
  private _weapons: Array<RuleCraftWeapon | null> = [];

  constructor(private _base: Base, private _craft: number, private _weapon: number) {
    super();
    this._screen = false;

    this._window = new Window(this, 220, 160, 50, 20, POPUP_BOTH);
    this._btnCancel = new TextButton(140, 16, 90, 156);
    this._txtTitle = new Text(208, 17, 56, 28);
    this._txtArmament = new Text(76, 9, 66, 52);
    this._txtQuantity = new Text(50, 9, 140, 52);
    this._txtAmmunition = new Text(68, 17, 200, 44);
    this._lstWeapons = new TextList(188, 80, 58, 68);

    this.setInterface("craftWeapons");

    this.add(this._window, "window", "craftWeapons");
    this.add(this._btnCancel, "button", "craftWeapons");
    this.add(this._txtTitle, "text", "craftWeapons");
    this.add(this._txtArmament, "text", "craftWeapons");
    this.add(this._txtQuantity, "text", "craftWeapons");
    this.add(this._txtAmmunition, "text", "craftWeapons");
    this.add(this._lstWeapons, "list", "craftWeapons");

    this.centerAllSurfaces();

    const back14 = this.game().getMod()?.getSurface("BACK14.SCR");
    if (back14) {
      this._window.setBackground(back14);
    }

    this._btnCancel.setText(String(this.tr("STR_CANCEL_UC")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);

    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_SELECT_ARMAMENT")));

    this._txtArmament.setText(String(this.tr("STR_ARMAMENT")));
    this._txtQuantity.setText(String(this.tr("STR_QUANTITY_UC")));
    this._txtAmmunition.setText(String(this.tr("STR_AMMUNITION_AVAILABLE")));
    this._txtAmmunition.setWordWrap(true);
    this._txtAmmunition.setVerticalAlign(ALIGN_BOTTOM);

    this._lstWeapons.setColumns(3, 94, 50, 36);
    this._lstWeapons.setSelectable(true);
    this._lstWeapons.setBackground(this._window);
    this._lstWeapons.setMargin(8);

    this._lstWeapons.addRow(1, String(this.tr("STR_NONE_UC")));
    this._weapons.push(null);

    const mod = this.game().getMod();
    for (const type of mod?.getCraftWeaponsList() || []) {
      const weapon = mod?.getCraftWeapon(type);
      if (!weapon || this._base.getStorageItems().getItem(weapon.getLauncherItem()) <= 0) {
        continue;
      }

      this._weapons.push(weapon);
      const quantity = `${this._base.getStorageItems().getItem(weapon.getLauncherItem())}`;
      const ammunition = weapon.getClipItem().length > 0
        ? `${this._base.getStorageItems().getItem(weapon.getClipItem())}`
        : String(this.tr("STR_NOT_AVAILABLE"));
      this._lstWeapons.addRow(3, String(this.tr(weapon.getType())), quantity, ammunition);
    }

    this._lstWeapons.onMouseClick(this.lstWeaponsClick.bind(this));
  }

  /**
   * Returns to the previous screen.
   */
  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  /**
   * Equips the weapon on the craft and returns to the previous screen.
   */
  lstWeaponsClick(_action?: Action): void {
    const craft = this._base.getCrafts()[this._craft];
    const row = this._lstWeapons.getSelectedRow();
    if (!craft || row < 0 || row >= this._weapons.length) {
      return;
    }

    const current = craft.getWeapons()[this._weapon] || null;
    if (current !== null) {
      this._base.getStorageItems().addItem(current.getRules().getLauncherItem());
      this._base.getStorageItems().addItem(current.getRules().getClipItem(), current.getClipsLoaded(this.game().getMod()));
      craft.getWeapons()[this._weapon] = null;
    }

    const selected = this._weapons[row];
    if (selected !== null) {
      const sel = new CraftWeapon(selected, 0);
      sel.setRearming(true);
      this._base.getStorageItems().removeItem(sel.getRules().getLauncherItem());
      craft.getWeapons()[this._weapon] = sel;
      if (craft.getStatus() === "STR_READY") {
        craft.setStatus("STR_REARMING");
      }
    }

    this.game().popState();
  }
}
