import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { ArticleDefinitionTFTD, UfopaediaTypeId } from "../Mod/ArticleDefinition.ts";
import { Palette } from "../Engine/Palette.ts";
import { ArticleState } from "./ArticleState.ts";

/**
 * Base article layout for TFTD Ufopaedia pages.
 */
export class ArticleStateTFTD extends ArticleState {
  protected _txtTitle: Text;
  protected _txtInfo: Text;

  constructor(defs: ArticleDefinitionTFTD) {
    super(defs.id);
    this.setPaletteByName("PAL_BASESCAPE");

    this._btnOk.setX(227);
    this._btnOk.setY(179);
    this._btnOk.setHeight(10);
    this._btnOk.setWidth(23);
    this._btnOk.setColor(Palette.blockOffset(0) + 2);
    this._btnPrev.setX(254);
    this._btnPrev.setY(179);
    this._btnPrev.setHeight(10);
    this._btnPrev.setWidth(23);
    this._btnPrev.setColor(Palette.blockOffset(0) + 2);
    this._btnNext.setX(281);
    this._btnNext.setY(179);
    this._btnNext.setHeight(10);
    this._btnNext.setWidth(23);
    this._btnNext.setColor(Palette.blockOffset(0) + 2);

    this.initLayout();
    this.game().getMod()?.getSurface("BACK08.SCR")?.blit(this._bg);
    this.game().getMod()?.getSurface(defs.image_id)?.blit(this._bg);

    this._txtInfo = new Text(defs.text_width, 136, 320 - defs.text_width, 34);
    this._txtTitle = new Text(284, 16, 36, 14);

    this.add(this._txtTitle);
    this.add(this._txtInfo);

    this._txtTitle.setColor(Palette.blockOffset(0) + 2);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr(defs.title)));

    this._txtInfo.setColor(Palette.blockOffset(0) + 2);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

    if (defs.getType() === UfopaediaTypeId.UFOPAEDIA_TYPE_TFTD) {
      this.centerAllSurfaces();
    }
  }
}
