import { Palette } from "../Engine/Palette.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionTFTD } from "../Mod/ArticleDefinition.ts";
import { ArticleStateTFTD } from "./ArticleStateTFTD.ts";
import { formatFunding } from "../Engine/Unicode.ts";

/**
 * TFTD base facility article.
 */
export class ArticleStateTFTDFacility extends ArticleStateTFTD {
  protected _lstInfo: TextList;

  constructor(defs: ArticleDefinitionTFTD) {
    super(defs);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const facility = mod.getBaseFacility(defs.id);
    if (!facility) {
      throw new Error(`Base facility rule ${defs.id} not found.`);
    }

    this._txtInfo.setHeight(112);
    this._lstInfo = new TextList(150, 50, 168, 150);
    this.add(this._lstInfo);
    this._lstInfo.setColor(Palette.blockOffset(0) + 2);
    this._lstInfo.setColumns(2, 104, 46);
    this._lstInfo.setDot(true);

    let row = 0;
    if (facility.getDefenseValue() > 0) {
      this._lstInfo.setY(this._lstInfo.getY() - 16);
      this._txtInfo.setHeight(this._txtInfo.getHeight() - 16);
      this._lstInfo.addRow(2, String(this.tr("STR_DEFENSE_VALUE")), String(facility.getDefenseValue()));
      this._lstInfo.setCellColor(row++, 1, Palette.blockOffset(15) + 4);
      this._lstInfo.addRow(2, String(this.tr("STR_HIT_RATIO")), `${facility.getHitRatio()}%`);
      this._lstInfo.setCellColor(row++, 1, Palette.blockOffset(15) + 4);
    }

    this._lstInfo.addRow(2, String(this.tr("STR_CONSTRUCTION_TIME")), String(this.tr("STR_DAY", facility.getBuildTime())));
    this._lstInfo.setCellColor(row++, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_CONSTRUCTION_COST")), formatFunding(facility.getBuildCost()));
    this._lstInfo.setCellColor(row++, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_MAINTENANCE_COST")), formatFunding(facility.getMonthlyCost()));
    this._lstInfo.setCellColor(row++, 1, Palette.blockOffset(15) + 4);

    this.centerAllSurfaces();
  }
}
