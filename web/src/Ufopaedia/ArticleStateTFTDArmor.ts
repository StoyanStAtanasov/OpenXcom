import { Palette } from "../Engine/Palette.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionTFTD } from "../Mod/ArticleDefinition.ts";
import { Armor } from "../Mod/Armor.ts";
import { ItemDamageType } from "../Mod/RuleItem.ts";
import { ArticleStateTFTD } from "./ArticleStateTFTD.ts";

function round(value: number): number {
  return Math.round(value);
}

/**
 * TFTD armor article.
 */
export class ArticleStateTFTDArmor extends ArticleStateTFTD {
  protected _row = 0;
  protected _lstInfo: TextList;

  constructor(defs: ArticleDefinitionTFTD) {
    super(defs);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const armor = mod.getArmor(defs.id);
    if (!armor) {
      throw new Error(`Armor rule ${defs.id} not found.`);
    }

    this._txtInfo.setHeight(72);
    this._lstInfo = new TextList(150, 64, 168, 110);
    this.add(this._lstInfo);
    this._lstInfo.setColor(Palette.blockOffset(0) + 2);
    this._lstInfo.setColumns(2, 125, 25);
    this._lstInfo.setDot(true);

    this.addStat("STR_FRONT_ARMOR", armor.getFrontArmor());
    this.addStat("STR_LEFT_ARMOR", armor.getSideArmor());
    this.addStat("STR_RIGHT_ARMOR", armor.getSideArmor());
    this.addStat("STR_REAR_ARMOR", armor.getRearArmor());
    this.addStat("STR_UNDER_ARMOR", armor.getUnderArmor());

    this._lstInfo.addRow(0);
    this._row++;

    for (let i = 0; i < Armor.DAMAGE_TYPES; ++i) {
      const dt = i as ItemDamageType;
      const percentage = round(armor.getDamageModifier(dt) * 100);
      const damage = this.getDamageTypeText(dt);
      if (percentage !== 100 && damage !== "STR_UNKNOWN") {
        this.addStat(damage, `${percentage}%`);
      }
    }

    this._lstInfo.addRow(0);
    this._row++;

    this.addStat("STR_TIME_UNITS", armor.getStats().tu, true);
    this.addStat("STR_STAMINA", armor.getStats().stamina, true);
    this.addStat("STR_HEALTH", armor.getStats().health, true);
    this.addStat("STR_BRAVERY", armor.getStats().bravery, true);
    this.addStat("STR_REACTIONS", armor.getStats().reactions, true);
    this.addStat("STR_FIRING_ACCURACY", armor.getStats().firing, true);
    this.addStat("STR_THROWING_ACCURACY", armor.getStats().throwing, true);
    this.addStat("STR_MELEE_ACCURACY", armor.getStats().melee, true);
    this.addStat("STR_STRENGTH", armor.getStats().strength, true);
    this.addStat("STR_PSIONIC_STRENGTH", armor.getStats().psiStrength, true);
    this.addStat("STR_PSIONIC_SKILL", armor.getStats().psiSkill, true);

    this.centerAllSurfaces();
  }

  protected addStat(label: string, stat: number, plus?: boolean): void;
  protected addStat(label: string, stat: string): void;
  protected addStat(label: string, stat: number | string, plus = false): void {
    if (typeof stat === "number") {
      if (stat !== 0) {
        this._lstInfo.addRow(2, String(this.tr(label)), `${plus && stat > 0 ? "+" : ""}${stat}`);
        this._lstInfo.setCellColor(this._row, 1, Palette.blockOffset(15) + 4);
        this._row++;
      }
      return;
    }
    this._lstInfo.addRow(2, String(this.tr(label)), stat);
    this._lstInfo.setCellColor(this._row, 1, Palette.blockOffset(15) + 4);
    this._row++;
  }
}
