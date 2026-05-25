import { Palette } from "../Engine/Palette.ts";
import { Text } from "../Interface/Text.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionVehicle } from "../Mod/ArticleDefinition.ts";
import { ArticleState } from "./ArticleState.ts";

/**
 * Ufopaedia article for a vehicle.
 */
export class ArticleStateVehicle extends ArticleState {
  protected _txtTitle: Text;
  protected _txtInfo: Text;
  protected _lstStats: TextList;

  constructor(defs: ArticleDefinitionVehicle) {
    super(defs.id);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const unit = mod.getUnit(defs.id, true);
    if (!unit) {
      throw new Error(`Unit rule ${defs.id} not found.`);
    }
    const armor = mod.getArmor(unit.getArmor());
    if (!armor) {
      throw new Error(`Armor rule ${unit.getArmor()} not found.`);
    }
    const item = mod.getItem(defs.id, true);
    if (!item) {
      throw new Error(`Item rule ${defs.id} not found.`);
    }

    this._txtTitle = new Text(310, 17, 5, 23);
    this._txtInfo = new Text(300, 150, 10, 122);
    this._lstStats = new TextList(300, 89, 10, 48);

    this.setPaletteByName("PAL_UFOPAEDIA");
    this.initLayout();

    this.add(this._txtTitle);
    this.add(this._txtInfo);
    this.add(this._lstStats);

    mod.getSurface("BACK10.SCR")?.blit(this._bg);
    this._btnOk.setColor(Palette.blockOffset(5));
    this._btnPrev.setColor(Palette.blockOffset(5));
    this._btnNext.setColor(Palette.blockOffset(5));

    this._txtTitle.setColor(Palette.blockOffset(15) + 4);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr(defs.title)));

    this._txtInfo.setColor(Palette.blockOffset(15) - 1);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

    this._lstStats.setColor(Palette.blockOffset(15) + 4);
    this._lstStats.setColumns(2, 175, 145);
    this._lstStats.setDot(true);

    this._lstStats.addRow(2, String(this.tr("STR_TIME_UNITS")), String(unit.getStats().tu));
    this._lstStats.addRow(2, String(this.tr("STR_HEALTH")), String(unit.getStats().health));
    this._lstStats.addRow(2, String(this.tr("STR_FRONT_ARMOR")), String(armor.getFrontArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_LEFT_ARMOR")), String(armor.getSideArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_RIGHT_ARMOR")), String(armor.getSideArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_REAR_ARMOR")), String(armor.getRearArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_UNDER_ARMOR")), String(armor.getUnderArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_WEAPON")), String(this.tr(defs.weapon)));

    if (item.getCompatibleAmmo().length > 0) {
      const ammo = mod.getItem(item.getCompatibleAmmo()[0], true);
      if (ammo) {
        this._lstStats.addRow(2, String(this.tr("STR_WEAPON_POWER")), String(ammo.getPower()));
        this._lstStats.addRow(2, String(this.tr("STR_AMMUNITION")), String(this.tr(ammo.getName())));
        this._lstStats.addRow(2, String(this.tr("STR_ROUNDS")), String(item.getClipSize() > 0 ? item.getClipSize() : ammo.getClipSize()));
        this._txtInfo.setY(138);
      }
    } else {
      this._lstStats.addRow(2, String(this.tr("STR_WEAPON_POWER")), String(item.getPower()));
    }

    this.centerAllSurfaces();
  }
}
