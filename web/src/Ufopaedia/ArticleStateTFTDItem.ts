import { Palette } from "../Engine/Palette.ts";
import { Text } from "../Interface/Text.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionTFTD } from "../Mod/ArticleDefinition.ts";
import { BattleType } from "../Mod/RuleItem.ts";
import { ArticleStateTFTD } from "./ArticleStateTFTD.ts";
import { Ufopaedia } from "./Ufopaedia.ts";

/**
 * TFTD item article.
 */
export class ArticleStateTFTDItem extends ArticleStateTFTD {
  protected _lstInfo: TextList | null = null;
  protected _txtShotType: Text | null = null;
  protected _txtAccuracy: Text | null = null;
  protected _txtTuCost: Text | null = null;
  protected _txtAmmoType: Text[] = [];
  protected _txtAmmoDamage: Text[] = [];

  constructor(defs: ArticleDefinitionTFTD) {
    super(defs);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const item = mod.getItem(defs.id, true);
    if (!item) {
      throw new Error(`Item rule ${defs.id} not found.`);
    }

    const ammoData = item.getCompatibleAmmo();
    if (item.getBattleType() === BattleType.BT_FIREARM) {
      this._txtShotType = new Text(53, 17, 8, 157);
      this.add(this._txtShotType);
      this._txtShotType.setColor(Palette.blockOffset(0) + 2);
      this._txtShotType.setWordWrap(true);
      this._txtShotType.setText(String(this.tr("STR_SHOT_TYPE")));

      this._txtAccuracy = new Text(57, 17, 61, 157);
      this.add(this._txtAccuracy);
      this._txtAccuracy.setColor(Palette.blockOffset(0) + 2);
      this._txtAccuracy.setWordWrap(true);
      this._txtAccuracy.setText(String(this.tr("STR_ACCURACY_UC")));

      this._txtTuCost = new Text(56, 17, 118, 157);
      this.add(this._txtTuCost);
      this._txtTuCost.setColor(Palette.blockOffset(0) + 2);
      this._txtTuCost.setWordWrap(true);
      this._txtTuCost.setText(String(this.tr("STR_TIME_UNIT_COST")));

      this._lstInfo = new TextList(140, 55, 8, 170);
      this.add(this._lstInfo);
      this._lstInfo.setColor(Palette.blockOffset(15) + 4);
      this._lstInfo.setColumns(3, 70, 40, 30);

      let currentRow = 0;
      if (item.getTUAuto() > 0) {
        let tu = `${item.getTUAuto()}%`;
        if (item.getFlatRate()) {
          tu = tu.slice(0, -1);
        }
        this._lstInfo.addRow(3, String(this.tr("STR_SHOT_TYPE_AUTO")), `${item.getAccuracyAuto()}%`, tu);
        this._lstInfo.setCellColor(currentRow, 0, Palette.blockOffset(0) + 2);
        currentRow++;
      }
      if (item.getTUSnap() > 0) {
        let tu = `${item.getTUSnap()}%`;
        if (item.getFlatRate()) {
          tu = tu.slice(0, -1);
        }
        this._lstInfo.addRow(3, String(this.tr("STR_SHOT_TYPE_SNAP")), `${item.getAccuracySnap()}%`, tu);
        this._lstInfo.setCellColor(currentRow, 0, Palette.blockOffset(0) + 2);
        currentRow++;
      }
      if (item.getTUAimed() > 0) {
        let tu = `${item.getTUAimed()}%`;
        if (item.getFlatRate()) {
          tu = tu.slice(0, -1);
        }
        this._lstInfo.addRow(3, String(this.tr("STR_SHOT_TYPE_AIMED")), `${item.getAccuracyAimed()}%`, tu);
        this._lstInfo.setCellColor(currentRow, 0, Palette.blockOffset(0) + 2);
      }
    }

    for (let i = 0; i < 3; ++i) {
      this._txtAmmoType[i] = new Text(120, 9, 168, 144 + i * 10);
      this.add(this._txtAmmoType[i]);
      this._txtAmmoType[i].setColor(Palette.blockOffset(0) + 2);
      this._txtAmmoType[i].setWordWrap(true);

      this._txtAmmoDamage[i] = new Text(20, 9, 300, 144 + i * 10);
      this.add(this._txtAmmoDamage[i]);
      this._txtAmmoDamage[i].setColor(Palette.blockOffset(3) + 6);
    }

    switch (item.getBattleType()) {
      case BattleType.BT_FIREARM:
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
            }
          }
        }
        break;
      case BattleType.BT_AMMO:
      case BattleType.BT_GRENADE:
      case BattleType.BT_PROXIMITYGRENADE:
      case BattleType.BT_MELEE:
        this._txtAmmoType[0]!.setText(String(this.tr(this.getDamageTypeText(item.getDamageType()))));
        this._txtAmmoDamage[0]!.setText(item.getShotgunPellets() ? `${item.getPower()}x${item.getShotgunPellets()}` : String(item.getPower()));
        break;
      default:
        break;
    }

    if (this._txtAmmoType[0]?.getText().length) {
      this._txtInfo.setHeight(112);
    }

    this.centerAllSurfaces();
  }
}
