import { Palette } from "../Engine/Palette.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionTFTD } from "../Mod/ArticleDefinition.ts";
import { ArticleStateTFTD } from "./ArticleStateTFTD.ts";

/**
 * TFTD vehicle article.
 */
export class ArticleStateTFTDVehicle extends ArticleStateTFTD {
  protected _lstStats: TextList;
  protected _lstStats2: TextList;

  constructor(defs: ArticleDefinitionTFTD) {
    super(defs);
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

    this._txtInfo.setHeight(72);
    this._lstStats = new TextList(150, 65, 168, 106);
    this.add(this._lstStats);
    this._lstStats.setColor(Palette.blockOffset(0) + 2);
    this._lstStats.setColumns(2, 100, 50);
    this._lstStats.setDot(true);

    this._lstStats2 = new TextList(195, 33, 25, 166);
    this.add(this._lstStats2);
    this._lstStats2.setColor(Palette.blockOffset(0) + 2);
    this._lstStats2.setColumns(2, 65, 130);
    this._lstStats2.setDot(true);

    this._lstStats.addRow(2, String(this.tr("STR_TIME_UNITS")), String(unit.getStats().tu));
    this._lstStats.addRow(2, String(this.tr("STR_HEALTH")), String(unit.getStats().health));
    this._lstStats.addRow(2, String(this.tr("STR_FRONT_ARMOR")), String(armor.getFrontArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_LEFT_ARMOR")), String(armor.getSideArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_RIGHT_ARMOR")), String(armor.getSideArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_REAR_ARMOR")), String(armor.getRearArmor()));
    this._lstStats.addRow(2, String(this.tr("STR_UNDER_ARMOR")), String(armor.getUnderArmor()));

    this._lstStats2.addRow(2, String(this.tr("STR_WEAPON")), String(this.tr(defs.weapon)));
    if (item.getCompatibleAmmo().length > 0) {
      const ammo = mod.getItem(item.getCompatibleAmmo()[0], true);
      if (ammo) {
        this._lstStats2.addRow(2, String(this.tr("STR_WEAPON_POWER")), String(ammo.getPower()));
        this._lstStats2.addRow(2, String(this.tr("STR_AMMUNITION")), String(this.tr(ammo.getName())));
        this._lstStats2.addRow(2, String(this.tr("STR_ROUNDS")), String(item.getClipSize() > 0 ? item.getClipSize() : ammo.getClipSize()));
      }
    } else {
      this._lstStats2.addRow(2, String(this.tr("STR_WEAPON_POWER")), String(item.getPower()));
    }

    for (let i = 0; i < this._lstStats.getRows(); ++i) {
      this._lstStats.setCellColor(i, 1, Palette.blockOffset(15) + 4);
    }
    for (let i = 0; i < this._lstStats2.getRows(); ++i) {
      this._lstStats2.setCellColor(i, 1, Palette.blockOffset(15) + 4);
    }

    this.centerAllSurfaces();
  }
}
