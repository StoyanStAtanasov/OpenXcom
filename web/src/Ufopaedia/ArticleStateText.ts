import { Palette } from "../Engine/Palette.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { ArticleDefinitionText } from "../Mod/ArticleDefinition.ts";
import { ArticleState } from "./ArticleState.ts";

/**
 * Ufopaedia article with text only.
 */
export class ArticleStateText extends ArticleState {
  protected _txtTitle: Text;
  protected _txtInfo: Text;

  constructor(defs: ArticleDefinitionText) {
    super(defs.id);
    this._txtTitle = new Text(296, 17, 5, 23);
    this._txtInfo = new Text(296, 150, 10, 48);

    this.setPaletteByName("PAL_UFOPAEDIA");
    this.initLayout();

    this.add(this._txtTitle);
    this.add(this._txtInfo);
    this.centerAllSurfaces();

    const back05 = this.game().getMod()?.getSurface("BACK10.SCR");
    if (back05) {
      back05.blit(this._bg);
    }
    this._btnOk.setColor(Palette.blockOffset(5));
    this._btnPrev.setColor(Palette.blockOffset(5));
    this._btnNext.setColor(Palette.blockOffset(5));

    this._txtTitle.setColor(Palette.blockOffset(15) + 4);
    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr(defs.title)));

    this._txtInfo.setColor(Palette.blockOffset(15) - 1);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));
  }
}
