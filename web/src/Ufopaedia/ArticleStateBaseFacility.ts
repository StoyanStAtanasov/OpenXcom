import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";
import { Text } from "../Interface/Text.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionBaseFacility } from "../Mod/ArticleDefinition.ts";
import { formatFunding } from "../Engine/Unicode.ts";
import { ArticleState } from "./ArticleState.ts";

/**
 * Ufopaedia article for a base facility.
 */
export class ArticleStateBaseFacility extends ArticleState {
  protected _image: Surface;
  protected _txtTitle: Text;
  protected _txtInfo: Text;
  protected _lstInfo: TextList;

  constructor(defs: ArticleDefinitionBaseFacility) {
    super(defs.id);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const facility = mod.getBaseFacility(defs.id);
    if (!facility) {
      throw new Error(`Base facility rule ${defs.id} not found.`);
    }

    this._txtTitle = new Text(200, 17, 10, 24);
    this.setPaletteByName("PAL_BASESCAPE");
    this.initLayout();

    this.add(this._txtTitle);
    mod.getSurface("BACK09.SCR")?.blit(this._bg);
    this._btnOk.setColor(Palette.blockOffset(4));
    this._btnPrev.setColor(Palette.blockOffset(4));
    this._btnNext.setColor(Palette.blockOffset(4));

    this._txtTitle.setColor(Palette.blockOffset(13) + 10);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr(defs.title)));

    const tileSize = 32;
    this._image = new Surface(tileSize * 2, tileSize * 2, 232, 16);
    this.add(this._image);

    const graphic = mod.getSurfaceSet("BASEBITS.PCK");
    if (graphic) {
      let xOffset = 0;
      let yOffset = 0;
      if (facility.getSize() === 1) {
        xOffset = tileSize / 2;
        yOffset = tileSize / 2;
      }
      let num = 0;
      for (let y = 0, yPos = yOffset; y < facility.getSize(); ++y, yPos += tileSize) {
        for (let x = 0, xPos = xOffset; x < facility.getSize(); ++x, xPos += tileSize) {
          const shape = graphic.getFrame(facility.getSpriteShape() + num);
          if (shape) {
            shape.setX(xPos);
            shape.setY(yPos);
            shape.blit(this._image);
          }
          if (facility.getSize() === 1) {
            const sprite = graphic.getFrame(facility.getSpriteFacility() + num);
            if (sprite) {
              sprite.setX(xPos);
              sprite.setY(yPos);
              sprite.blit(this._image);
            }
          }
          num++;
        }
      }
    }

    this._txtInfo = new Text(300, 90, 10, 104);
    this.add(this._txtInfo);
    this._txtInfo.setColor(Palette.blockOffset(13) + 10);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

    this._lstInfo = new TextList(200, 42, 10, 42);
    this.add(this._lstInfo);
    this._lstInfo.setColor(Palette.blockOffset(13) + 10);
    this._lstInfo.setColumns(2, 140, 60);
    this._lstInfo.setDot(true);
    this._lstInfo.addRow(2, String(this.tr("STR_CONSTRUCTION_TIME")), this.tr("STR_DAY", facility.getBuildTime()).toString());
    this._lstInfo.setCellColor(0, 1, Palette.blockOffset(13));
    this._lstInfo.addRow(2, String(this.tr("STR_CONSTRUCTION_COST")), formatFunding(facility.getBuildCost()));
    this._lstInfo.setCellColor(1, 1, Palette.blockOffset(13));
    this._lstInfo.addRow(2, String(this.tr("STR_MAINTENANCE_COST")), formatFunding(facility.getMonthlyCost()));
    this._lstInfo.setCellColor(2, 1, Palette.blockOffset(13));
    if (facility.getDefenseValue() > 0) {
      this._lstInfo.addRow(2, String(this.tr("STR_DEFENSE_VALUE")), String(facility.getDefenseValue()));
      this._lstInfo.setCellColor(3, 1, Palette.blockOffset(13));
      this._lstInfo.addRow(2, String(this.tr("STR_HIT_RATIO")), `${facility.getHitRatio()}%`);
      this._lstInfo.setCellColor(4, 1, Palette.blockOffset(13));
    }

    this.centerAllSurfaces();
  }
}
