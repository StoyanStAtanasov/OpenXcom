import { Palette } from "../Engine/Palette.ts";
import { Text } from "../Interface/Text.ts";
import { ArticleDefinitionTFTD } from "../Mod/ArticleDefinition.ts";
import { formatNumber } from "../Engine/Unicode.ts";
import { ArticleStateTFTD } from "./ArticleStateTFTD.ts";

/**
 * TFTD craft article.
 */
export class ArticleStateTFTDCraft extends ArticleStateTFTD {
  protected _txtStats: Text;

  constructor(defs: ArticleDefinitionTFTD) {
    super(defs);
    const mod = this.game().getMod();
    if (!mod) {
      throw new Error("Mod not loaded.");
    }
    const craft = mod.getCraft(defs.id);
    if (!craft) {
      throw new Error(`Craft rule ${defs.id} not found.`);
    }

    this._txtInfo.setHeight(80);
    this._txtStats = new Text(131, 56, 187, 116);
    this.add(this._txtStats);
    this._txtStats.setColor(Palette.blockOffset(0) + 2);
    this._txtStats.setSecondaryColor(Palette.blockOffset(15) + 4);
    this._txtStats.setText([
      `${this.tr("STR_MAXIMUM_SPEED_UC").arg(formatNumber(craft.getMaxSpeed()))}`,
      `${this.tr("STR_ACCELERATION").arg(craft.getAcceleration())}`,
      `${this.tr("STR_FUEL_CAPACITY").arg(formatNumber(craft.getMaxFuel()))}`,
      `${this.tr("STR_WEAPON_PODS").arg(craft.getWeapons())}`,
      `${this.tr("STR_DAMAGE_CAPACITY_UC").arg(formatNumber(craft.getMaxDamage()))}`,
      `${this.tr("STR_CARGO_SPACE").arg(craft.getSoldiers())}`,
      `${this.tr("STR_HWP_CAPACITY").arg(craft.getVehicles())}`
    ].join("\n"));

    this.centerAllSurfaces();
  }
}
