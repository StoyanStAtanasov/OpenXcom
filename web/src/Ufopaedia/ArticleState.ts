import { State } from "../Engine/State.ts";
import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { Surface } from "../Engine/Surface.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { ItemDamageType } from "../Mod/RuleItem.ts";
import { Ufopaedia } from "./Ufopaedia.ts";

/**
 * Ufopaedia article base screen.
 */
export class ArticleState extends State {
  protected _id: string;
  protected _bg: Surface;
  protected _btnOk: TextButton;
  protected _btnPrev: TextButton;
  protected _btnNext: TextButton;

  protected constructor(articleId: string) {
    super();
    this._id = articleId;
    this._bg = new Surface(320, 200, 0, 0);
    this._btnOk = new TextButton(30, 14, 5, 5);
    this._btnPrev = new TextButton(30, 14, 40, 5);
    this._btnNext = new TextButton(30, 14, 75, 5);
  }

  getId(): string {
    return this._id;
  }

  protected getDamageTypeText(dt: ItemDamageType): string {
    switch (dt) {
      case ItemDamageType.DT_AP: return "STR_DAMAGE_ARMOR_PIERCING";
      case ItemDamageType.DT_IN: return "STR_DAMAGE_INCENDIARY";
      case ItemDamageType.DT_HE: return "STR_DAMAGE_HIGH_EXPLOSIVE";
      case ItemDamageType.DT_LASER: return "STR_DAMAGE_LASER_BEAM";
      case ItemDamageType.DT_PLASMA: return "STR_DAMAGE_PLASMA_BEAM";
      case ItemDamageType.DT_STUN: return "STR_DAMAGE_STUN";
      case ItemDamageType.DT_MELEE: return "STR_DAMAGE_MELEE";
      case ItemDamageType.DT_ACID: return "STR_DAMAGE_ACID";
      case ItemDamageType.DT_SMOKE: return "STR_DAMAGE_SMOKE";
      default: return "STR_UNKNOWN";
    }
  }

  protected initLayout(): void {
    this.add(this._bg);
    this.add(this._btnOk);
    this.add(this._btnPrev);
    this.add(this._btnNext);

    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._btnPrev.setText("<<");
    this._btnPrev.onMouseClick(this.btnPrevClick.bind(this));
    this._btnPrev.onKeyboardPress(this.btnPrevClick.bind(this), Options.keyGeoLeft);
    this._btnNext.setText(">>");
    this._btnNext.onMouseClick(this.btnNextClick.bind(this));
    this._btnNext.onKeyboardPress(this.btnNextClick.bind(this), Options.keyGeoRight);
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }

  btnPrevClick(_action?: Action): void {
    Ufopaedia.prev(this.game());
  }

  btnNextClick(_action?: Action): void {
    Ufopaedia.next(this.game());
  }
}
