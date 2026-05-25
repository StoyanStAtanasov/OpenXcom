import { Palette } from "../Engine/Palette.ts";
import { Text } from "../Interface/Text.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionCraftWeapon } from "../Mod/ArticleDefinition.ts";
import { formatNumber } from "../Engine/Unicode.ts";
import { ArticleState } from "./ArticleState.ts";

/**
 * Ufopaedia article for a craft weapon.
 */
export class ArticleStateCraftWeapon extends ArticleState {
  protected _txtTitle: Text;
  protected _txtInfo: Text;
  protected _lstInfo: TextList;

  constructor(defs: ArticleDefinitionCraftWeapon) {
    super(defs.id);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const weapon = mod.getCraftWeapon(defs.id);
    if (!weapon) {
      throw new Error(`Craft weapon rule ${defs.id} not found.`);
    }

    this._txtTitle = new Text(200, 32, 5, 24);
    this.setPaletteByName("PAL_BATTLEPEDIA");
    this.initLayout();

    this.add(this._txtTitle);
    mod.getSurface(defs.image_id)?.blit(this._bg);
    this._btnOk.setColor(Palette.blockOffset(1));
    this._btnPrev.setColor(Palette.blockOffset(1));
    this._btnNext.setColor(Palette.blockOffset(1));

    this._txtTitle.setColor(Palette.blockOffset(14) + 15);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr(defs.title)));

    this._txtInfo = new Text(310, 32, 5, 160);
    this.add(this._txtInfo);
    this._txtInfo.setColor(Palette.blockOffset(14) + 15);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

    this._lstInfo = new TextList(250, 111, 5, 80);
    this.add(this._lstInfo);
    this._lstInfo.setColor(Palette.blockOffset(14) + 15);
    this._lstInfo.setColumns(2, 180, 70);
    this._lstInfo.setDot(true);
    this._lstInfo.setBig();

    this._lstInfo.addRow(2, String(this.tr("STR_DAMAGE")), formatNumber(weapon.getDamage()));
    this._lstInfo.setCellColor(0, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_RANGE")), this.tr("STR_KILOMETERS").arg(weapon.getRange()).toString());
    this._lstInfo.setCellColor(1, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_ACCURACY")), `${weapon.getAccuracy()}%`);
    this._lstInfo.setCellColor(2, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_RE_LOAD_TIME")), this.tr("STR_SECONDS").arg(weapon.getStandardReload()).toString());
    this._lstInfo.setCellColor(3, 1, Palette.blockOffset(15) + 4);
    this._lstInfo.addRow(2, String(this.tr("STR_ROUNDS")), formatNumber(weapon.getAmmoMax()));
    this._lstInfo.setCellColor(4, 1, Palette.blockOffset(15) + 4);

    this.centerAllSurfaces();
  }
}
