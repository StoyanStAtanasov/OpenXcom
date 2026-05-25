import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";
import { Text } from "../Interface/Text.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionUfo } from "../Mod/ArticleDefinition.ts";
import { formatNumber } from "../Engine/Unicode.ts";
import { ArticleState } from "./ArticleState.ts";

/**
 * Ufopaedia article for a UFO.
 */
export class ArticleStateUfo extends ArticleState {
  protected _image: Surface;
  protected _txtTitle: Text;
  protected _txtInfo: Text;
  protected _lstInfo: TextList;

  constructor(defs: ArticleDefinitionUfo) {
    super(defs.id);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const ufo = mod.getUfo(defs.id, true);
    if (!ufo) {
      throw new Error(`UFO rule ${defs.id} not found.`);
    }

    this._txtTitle = new Text(155, 32, 5, 24);
    this.setPaletteByName("PAL_GEOSCAPE");
    this.initLayout();

    this.add(this._txtTitle);
    mod.getSurface("BACK11.SCR")?.blit(this._bg);
    this._btnOk.setColor(Palette.blockOffset(8) + 5);
    this._btnPrev.setColor(Palette.blockOffset(8) + 5);
    this._btnNext.setColor(Palette.blockOffset(8) + 5);

    this._txtTitle.setColor(Palette.blockOffset(8) + 5);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr(defs.title)));

    this._image = new Surface(160, 52, 160, 6);
    this.add(this._image);

    const dogfightInterface = mod.getInterface("dogfight");
    let graphic = mod.getSurface("INTERWIN.DAT");
    if (graphic) {
      graphic.setX(0);
      graphic.setY(0);
      graphic.getCrop().x = 0;
      graphic.getCrop().y = 0;
      graphic.getCrop().w = this._image.getWidth();
      graphic.getCrop().h = this._image.getHeight();
      this._image.drawRect(graphic.getCrop(), 15);
      graphic.blit(this._image);
    }

    if (ufo.getModSprite() === "") {
      if (graphic && dogfightInterface) {
        const preview = dogfightInterface.getElement("previewMid");
        if (preview) {
          graphic.getCrop().y = preview.y + preview.h * ufo.getSprite();
          graphic.getCrop().h = preview.h;
          graphic.blit(this._image);
        }
      }
    } else {
      const modSprite = mod.getSurface(ufo.getModSprite());
      if (modSprite) {
        modSprite.setX(0);
        modSprite.setY(0);
        modSprite.blit(this._image);
      }
    }

    this._txtInfo = new Text(300, 50, 10, 140);
    this.add(this._txtInfo);
    this._txtInfo.setColor(Palette.blockOffset(8) + 5);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

    this._lstInfo = new TextList(310, 64, 10, 68);
    this.add(this._lstInfo);

    this.centerAllSurfaces();

    this._lstInfo.setColor(Palette.blockOffset(8) + 5);
    this._lstInfo.setColumns(2, 200, 110);
    this._lstInfo.setBig();
    this._lstInfo.setDot(true);
    this._lstInfo.addRow(2, String(this.tr("STR_DAMAGE_CAPACITY")), formatNumber(ufo.getMaxDamage()));
    this._lstInfo.addRow(2, String(this.tr("STR_WEAPON_POWER")), formatNumber(ufo.getWeaponPower()));
    this._lstInfo.addRow(2, String(this.tr("STR_WEAPON_RANGE")), this.tr("STR_KILOMETERS").arg(ufo.getWeaponRange()).toString());
    this._lstInfo.addRow(2, String(this.tr("STR_MAXIMUM_SPEED")), this.tr("STR_KNOTS").arg(formatNumber(ufo.getMaxSpeed())).toString());
  }
}
