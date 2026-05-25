import { Palette } from "../Engine/Palette.ts";
import { Text } from "../Interface/Text.ts";
import { ArticleDefinitionCraft } from "../Mod/ArticleDefinition.ts";
import { formatNumber } from "../Engine/Unicode.ts";
import { ArticleState } from "./ArticleState.ts";

/**
 * Ufopaedia article for a craft.
 */
export class ArticleStateCraft extends ArticleState {
  protected _txtTitle: Text;
  protected _txtInfo: Text;
  protected _txtStats: Text;

  constructor(defs: ArticleDefinitionCraft) {
    super(defs.id);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const craft = mod.getCraft(defs.id);
    if (!craft) {
      throw new Error(`Craft rule ${defs.id} not found.`);
    }

    this._txtTitle = new Text(210, 32, 5, 24);
    this.setPaletteByName("PAL_UFOPAEDIA");
    this.initLayout();

    this.add(this._txtTitle);
    mod.getSurface(defs.image_id)?.blit(this._bg);
    this._btnOk.setColor(Palette.blockOffset(15) - 1);
    this._btnPrev.setColor(Palette.blockOffset(15) - 1);
    this._btnNext.setColor(Palette.blockOffset(15) - 1);

    this._txtTitle.setColor(Palette.blockOffset(14) + 15);
    this._txtTitle.setBig();
    this._txtTitle.setWordWrap(true);
    this._txtTitle.setText(String(this.tr(defs.title)));

    this._txtInfo = new Text(defs.rect_text.width, defs.rect_text.height, defs.rect_text.x, defs.rect_text.y);
    this.add(this._txtInfo);
    this._txtInfo.setColor(Palette.blockOffset(14) + 15);
    this._txtInfo.setWordWrap(true);
    this._txtInfo.setScrollable(true);
    this._txtInfo.setText(String(this.tr(defs.text)));

    this._txtStats = new Text(defs.rect_stats.width, defs.rect_stats.height, defs.rect_stats.x, defs.rect_stats.y);
    this.add(this._txtStats);
    this._txtStats.setColor(Palette.blockOffset(14) + 15);
    this._txtStats.setSecondaryColor(Palette.blockOffset(15) + 4);

    const stats = [
      `${this.tr("STR_MAXIMUM_SPEED_UC").arg(formatNumber(craft.getMaxSpeed()))}`,
      `${this.tr("STR_ACCELERATION").arg(craft.getAcceleration())}`,
      `${this.tr("STR_FUEL_CAPACITY").arg(formatNumber(craft.getMaxFuel()))}`,
      `${this.tr("STR_WEAPON_PODS").arg(craft.getWeapons())}`,
      `${this.tr("STR_DAMAGE_CAPACITY_UC").arg(formatNumber(craft.getMaxDamage()))}`,
      `${this.tr("STR_CARGO_SPACE").arg(craft.getSoldiers())}`,
      `${this.tr("STR_HWP_CAPACITY").arg(craft.getVehicles())}`
    ];
    this._txtStats.setText(stats.join("\n"));

    this.centerAllSurfaces();
  }
}
