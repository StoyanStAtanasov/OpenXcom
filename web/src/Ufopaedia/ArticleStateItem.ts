import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";
import { Text, ALIGN_CENTER, ALIGN_MIDDLE } from "../Interface/Text.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionItem } from "../Mod/ArticleDefinition.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import { ArticleState } from "./ArticleState.ts";
import { Ufopaedia } from "./Ufopaedia.ts";

/**
 * Ufopaedia article for an item.
 */
export class ArticleStateItem extends ArticleState {
  protected _image: Surface;
  protected _txtTitle: Text;
  protected _txtInfo: Text;
  protected _lstInfo: TextList | null = null;
  protected _txtShotType: Text | null = null;
  protected _txtAccuracy: Text | null = null;
  protected _txtTuCost: Text | null = null;
  protected _txtDamage: Text | null = null;
  protected _txtAmmo: Text | null = null;
  protected _txtAmmoType: Text[] = [];
  protected _txtAmmoDamage: Text[] = [];
  protected _imageAmmo: Surface[] = [];

  constructor(defs: ArticleDefinitionItem) {
    super(defs.id);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const item = mod.getItem(defs.id, true);
    if (!item) {
      throw new Error(`Item rule ${defs.id} not found.`);
    }

    this._txtTitle = new Text(148, 32, 5, 24);
    this.setPaletteByName("PAL_BATTLEPEDIA");
    this.initLayout();

    this.add(this._txtTitle);
    mod.getSurface("BACK08.SCR")?.blit(this._bg);
    this._btnOk.setColor(Palette.blockOffset(9));
    this._btnPrev.setColor(Palette.blockOffset(9));
    this._btnNext.setColor(Palette.blockOffset(9));

    this._txtTitle.setColor(Palette.blockOffset(14) + 15);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr(defs.title)));

    this._image = new Surface(32, 48, 157, 5);
    this.add(this._image);
    const bigObs = mod.getSurfaceSet("BIGOBS.PCK");
    if (bigObs) {
      item.drawHandSprite(bigObs, this._image);
    }

    const ammoData = item.getCompatibleAmmo();
    if (item.getBattleType() === BattleType.BT_FIREARM) {
      this._txtShotType = new Text(100, 17, 8, 66);
      this.add(this._txtShotType);
      this._txtShotType.setColor(Palette.blockOffset(14) + 15);
      this._txtShotType.setWordWrap(true);
      this._txtShotType.setText(String(this.tr("STR_SHOT_TYPE")));

      this._txtAccuracy = new Text(50, 17, 104, 66);
      this.add(this._txtAccuracy);
      this._txtAccuracy.setColor(Palette.blockOffset(14) + 15);
      this._txtAccuracy.setWordWrap(true);
      this._txtAccuracy.setText(String(this.tr("STR_ACCURACY_UC")));

      this._txtTuCost = new Text(60, 17, 158, 66);
      this.add(this._txtTuCost);
      this._txtTuCost.setColor(Palette.blockOffset(14) + 15);
      this._txtTuCost.setWordWrap(true);
      this._txtTuCost.setText(String(this.tr("STR_TIME_UNIT_COST")));

      this._lstInfo = new TextList(204, 55, 8, 82);
      this.add(this._lstInfo);
      this._lstInfo.setColor(Palette.blockOffset(15) + 4);
      this._lstInfo.setColumns(3, 100, 52, 52);
      this._lstInfo.setBig();

      let currentRow = 0;
      if (item.getTUAuto() > 0) {
        let tu = `${item.getTUAuto()}%`;
        if (item.getFlatRate()) {
          tu = tu.slice(0, -1);
        }
        this._lstInfo.addRow(3, String(this.tr("STR_SHOT_TYPE_AUTO")), `${item.getAccuracyAuto()}%`, tu);
        this._lstInfo.setCellColor(currentRow, 0, Palette.blockOffset(14) + 15);
        currentRow++;
      }
      if (item.getTUSnap() > 0) {
        let tu = `${item.getTUSnap()}%`;
        if (item.getFlatRate()) {
          tu = tu.slice(0, -1);
        }
        this._lstInfo.addRow(3, String(this.tr("STR_SHOT_TYPE_SNAP")), `${item.getAccuracySnap()}%`, tu);
        this._lstInfo.setCellColor(currentRow, 0, Palette.blockOffset(14) + 15);
        currentRow++;
      }
      if (item.getTUAimed() > 0) {
        let tu = `${item.getTUAimed()}%`;
        if (item.getFlatRate()) {
          tu = tu.slice(0, -1);
        }
        this._lstInfo.addRow(3, String(this.tr("STR_SHOT_TYPE_AIMED")), `${item.getAccuracyAimed()}%`, tu);
        this._lstInfo.setCellColor(currentRow, 0, Palette.blockOffset(14) + 15);
        currentRow++;
      }

      this._txtInfo = new Text(ammoData.length < 3 ? 300 : 180, 56, 8, 138);
    } else {
      this._txtInfo = new Text(300, 125, 8, 67);
    }

    this.add(this._txtInfo);
    this._txtInfo.setColor(Palette.blockOffset(14) + 15);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

    for (let i = 0; i < 3; ++i) {
      this._txtAmmoType[i] = new Text(82, 16, 194, 20 + i * 49);
      this.add(this._txtAmmoType[i]);
      this._txtAmmoType[i].setColor(Palette.blockOffset(14) + 15);
      this._txtAmmoType[i].setAlign(ALIGN_CENTER);
      this._txtAmmoType[i].setVerticalAlign(ALIGN_MIDDLE);
      this._txtAmmoType[i].setWordWrap(true);

      this._txtAmmoDamage[i] = new Text(82, 17, 194, 40 + i * 49);
      this.add(this._txtAmmoDamage[i]);
      this._txtAmmoDamage[i].setColor(Palette.blockOffset(2));
      this._txtAmmoDamage[i].setAlign(ALIGN_CENTER);
      this._txtAmmoDamage[i].setBig();

      this._imageAmmo[i] = new Surface(32, 48, 280, 16 + i * 49);
      this.add(this._imageAmmo[i]);
    }

    switch (item.getBattleType()) {
      case BattleType.BT_FIREARM: {
        this._txtDamage = new Text(82, 10, 194, 7);
        this.add(this._txtDamage);
        this._txtDamage.setColor(Palette.blockOffset(14) + 15);
        this._txtDamage.setAlign(ALIGN_CENTER);
        this._txtDamage.setText(String(this.tr("STR_DAMAGE_UC")));

        this._txtAmmo = new Text(50, 10, 268, 7);
        this.add(this._txtAmmo);
        this._txtAmmo.setColor(Palette.blockOffset(14) + 15);
        this._txtAmmo.setAlign(ALIGN_CENTER);
        this._txtAmmo.setText(String(this.tr("STR_AMMO")));

        if (ammoData.length === 0) {
          this._txtAmmoType[0]!.setText(String(this.tr(this.getDamageTypeText(item.getDamageType()))));
          this._txtAmmoDamage[0]!.setText(item.getShotgunPellets() ? `${item.getPower()}x${item.getShotgunPellets()}` : String(item.getPower()));
        } else {
          for (let i = 0; i < Math.min(ammoData.length, 3); ++i) {
            const ammoArticle = mod.getUfopaediaArticle(ammoData[i]);
            if (ammoArticle && Ufopaedia.isArticleAvailable(this.game().getSavedGame(), ammoArticle)) {
              const ammoRule = mod.getItem(ammoData[i], true);
              if (!ammoRule) {
                continue;
              }
              this._txtAmmoType[i]!.setText(String(this.tr(this.getDamageTypeText(ammoRule.getDamageType()))));
              this._txtAmmoDamage[i]!.setText(ammoRule.getShotgunPellets() ? `${ammoRule.getPower()}x${ammoRule.getShotgunPellets()}` : String(ammoRule.getPower()));
              if (bigObs) {
                ammoRule.drawHandSprite(bigObs, this._imageAmmo[i]);
              }
            }
          }
        }
        break;
      }
      case BattleType.BT_AMMO:
      case BattleType.BT_GRENADE:
      case BattleType.BT_PROXIMITYGRENADE:
      case BattleType.BT_MELEE:
        this._txtDamage = new Text(82, 10, 194, 7);
        this.add(this._txtDamage);
        this._txtDamage.setColor(Palette.blockOffset(14) + 15);
        this._txtDamage.setAlign(ALIGN_CENTER);
        this._txtDamage.setText(String(this.tr("STR_DAMAGE_UC")));
        this._txtAmmoType[0]!.setText(String(this.tr(this.getDamageTypeText(item.getDamageType()))));
        this._txtAmmoDamage[0]!.setText(item.getShotgunPellets() ? `${item.getPower()}x${item.getShotgunPellets()}` : String(item.getPower()));
        break;
      default:
        break;
    }

    this.centerAllSurfaces();
  }
}
