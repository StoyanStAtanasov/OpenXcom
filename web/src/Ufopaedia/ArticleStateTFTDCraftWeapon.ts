import { Palette } from "../Engine/Palette.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionTFTD } from "../Mod/ArticleDefinition.ts";
import { formatNumber } from "../Engine/Unicode.ts";
import { ArticleStateTFTD } from "./ArticleStateTFTD.ts";

/**
 * TFTD craft weapon article.
 */
export class ArticleStateTFTDCraftWeapon extends ArticleStateTFTD {
  protected _lstInfo: TextList;

  constructor(defs: ArticleDefinitionTFTD) {
    super(defs);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const weapon = mod.getCraftWeapon(defs.id);
    if (!weapon) {
      throw new Error(`Craft weapon rule ${defs.id} not found.`);
    }

    this._txtInfo.setHeight(88);
    this._lstInfo = new TextList(150, 50, 168, 126);
    this.add(this._lstInfo);
    this._lstInfo.setColor(Palette.blockOffset(0) + 2);
    this._lstInfo.setColumns(2, 100, 68);
    this._lstInfo.setDot(true);
    this._lstInfo.addRow(2, String(this.tr("STR_DAMAGE")), formatNumber(weapon.getDamage()));
    this._lstInfo.setCellColor(0, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_RANGE")), this.tr("STR_KILOMETERS").arg(weapon.getRange()).toString());
    this._lstInfo.setCellColor(1, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_ACCURACY")), `${weapon.getAccuracy()}%`);
    this._lstInfo.setCellColor(2, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_RE_LOAD_TIME")), this.tr("STR_SECONDS").arg(weapon.getStandardReload()).toString());
    this._lstInfo.setCellColor(3, 1, Palette.blockOffset(15) + 4);

    this.centerAllSurfaces();
  }
}
