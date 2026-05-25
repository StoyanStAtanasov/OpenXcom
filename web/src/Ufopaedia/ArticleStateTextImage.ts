import { Palette } from "../Engine/Palette.ts";
import { Text, ALIGN_CENTER } from "../Interface/Text.ts";
import { ArticleDefinitionTextImage } from "../Mod/ArticleDefinition.ts";
import { ArticleState } from "./ArticleState.ts";

/**
 * Ufopaedia article with text and an image background.
 */
export class ArticleStateTextImage extends ArticleState {
  protected _txtTitle: Text;
  protected _txtInfo: Text;

  constructor(defs: ArticleDefinitionTextImage) {
    super(defs.id);
    this._txtTitle = new Text(defs.text_width, 48, 5, 22);

    this.setPaletteByName("PAL_UFOPAEDIA");
    this.initLayout();

    this.add(this._txtTitle);

    this.game().getMod()?.getSurface(defs.image_id)?.blit(this._bg);
    this._btnOk.setColor(Palette.blockOffset(5) + 3);
    this._btnPrev.setColor(Palette.blockOffset(5) + 3);
    this._btnNext.setColor(Palette.blockOffset(5) + 3);

    this._txtTitle.setColor(Palette.blockOffset(15) + 4);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr(defs.title)));

    const textHeight = this._txtTitle.getTextHeight();
    this._txtInfo = new Text(defs.text_width, 176 - textHeight, 5, 23 + textHeight);
    this.add(this._txtInfo);

    this._txtInfo.setColor(Palette.blockOffset(15) - 1);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

    this.centerAllSurfaces();
  }
}
