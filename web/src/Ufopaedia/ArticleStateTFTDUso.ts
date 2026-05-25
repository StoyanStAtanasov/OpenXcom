import { Palette } from "../Engine/Palette.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionTFTD } from "../Mod/ArticleDefinition.ts";
import { ArticleStateTFTD } from "./ArticleStateTFTD.ts";
import { formatNumber } from "../Engine/Unicode.ts";

/**
 * TFTD USO article.
 */
export class ArticleStateTFTDUso extends ArticleStateTFTD {
  protected _lstInfo: TextList;

  constructor(defs: ArticleDefinitionTFTD) {
    super(defs);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const ufo = mod.getUfo(defs.id, true);
    if (!ufo) {
      throw new Error(`UFO rule ${defs.id} not found.`);
    }

    this._txtInfo.setHeight(112);
    this._lstInfo = new TextList(150, 50, 168, 142);
    this.add(this._lstInfo);
    this._lstInfo.setColor(Palette.blockOffset(0) + 2);
    this._lstInfo.setColumns(2, 95, 55);
    this._lstInfo.setDot(true);
    this._lstInfo.addRow(2, String(this.tr("STR_DAMAGE_CAPACITY")), formatNumber(ufo.getMaxDamage()));
    this._lstInfo.addRow(2, String(this.tr("STR_WEAPON_POWER")), formatNumber(ufo.getWeaponPower()));
    this._lstInfo.addRow(2, String(this.tr("STR_WEAPON_RANGE")), this.tr("STR_KILOMETERS").arg(ufo.getWeaponRange()).toString());
    this._lstInfo.addRow(2, String(this.tr("STR_MAXIMUM_SPEED")), this.tr("STR_KNOTS").arg(formatNumber(ufo.getMaxSpeed())).toString());
    for (let i = 0; i < 4; ++i) {
      this._lstInfo.setCellColor(i, 1, Palette.blockOffset(15) + 4);
    }

    this.centerAllSurfaces();
  }
}
