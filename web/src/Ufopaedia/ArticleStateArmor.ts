import { Palette } from "../Engine/Palette.ts";
import { Surface } from "../Engine/Surface.ts";
import { Text } from "../Interface/Text.ts";
import { TextList } from "../Interface/TextList.ts";
import { ArticleDefinitionArmor } from "../Mod/ArticleDefinition.ts";
import { Armor } from "../Mod/Armor.ts";
import { ItemDamageType } from "../Mod/RuleItem.ts";
import { ArticleState } from "./ArticleState.ts";

function round(value: number): number {
  return Math.round(value);
}

/**
 * Ufopaedia article for an armor.
 */
export class ArticleStateArmor extends ArticleState {
  protected _row = 0;
  protected _image: Surface;
  protected _txtTitle: Text;
  protected _lstInfo: TextList;
  protected _txtInfo: Text;

  constructor(defs: ArticleDefinitionArmor) {
    super(defs.id);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const armor = mod.getArmor(defs.id);
    if (!armor) {
      throw new Error(`Armor rule ${defs.id} not found.`);
    }

    this._txtTitle = new Text(300, 17, 5, 24);
    this.setPaletteByName("PAL_BATTLEPEDIA");
    this.initLayout();

    this.add(this._txtTitle);
    this._btnOk.setColor(Palette.blockOffset(0) + 15);
    this._btnPrev.setColor(Palette.blockOffset(0) + 15);
    this._btnNext.setColor(Palette.blockOffset(0) + 15);

    this._txtTitle.setColor(Palette.blockOffset(14) + 15);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr(defs.title)));

    this._image = new Surface(320, 200, 0, 0);
    this.add(this._image);

    let look = `${armor.getSpriteInventory()}M0.SPK`;
    if (!mod.getSurface(look)) {
      look = `${armor.getSpriteInventory()}.SPK`;
    }
    if (!mod.getSurface(look)) {
      look = armor.getSpriteInventory();
    }
    mod.getSurface(look)?.blit(this._image);

    this._lstInfo = new TextList(150, 96, 150, 46);
    this.add(this._lstInfo);
    this._lstInfo.setColor(Palette.blockOffset(14) + 15);
    this._lstInfo.setColumns(2, 125, 25);
    this._lstInfo.setDot(true);

    this._txtInfo = new Text(300, 48, 8, 150);
    this.add(this._txtInfo);
    this._txtInfo.setColor(Palette.blockOffset(14) + 15);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

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
