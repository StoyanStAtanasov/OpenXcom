import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { TOK_COLOR_FLIP } from "../Engine/Unicode.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { POPUP_HORIZONTAL, Window } from "../Interface/Window.ts";
import { BasescapeState } from "../Basescape/BasescapeState.ts";
import type { Base } from "../Savegame/Base.ts";
import { Craft } from "../Savegame/Craft.ts";
import type { TargetLike } from "../Savegame/Target.ts";
import { SDL_BUTTON_RIGHT } from "../types.ts";
import { ConfirmDestinationState } from "./ConfirmDestinationState.ts";
import type { Globe } from "./Globe.ts";
import { SelectDestinationState } from "./SelectDestinationState.ts";

type CraftRuntime = Craft & {
  getLowFuel?: () => boolean;
  getMissionComplete?: () => boolean;
};

type GlobeRuntime = Globe & {
  center?: (lon: number, lat: number) => void;
};

const COLOR_FLIP = String.fromCharCode(TOK_COLOR_FLIP);

function coloredCount(count: number): string {
  return count > 0 ? `${COLOR_FLIP}${count}${COLOR_FLIP}` : "0";
}

function craftLaunchAlways(): boolean {
  return (Options as typeof Options & { craftLaunchAlways?: boolean }).craftLaunchAlways ?? false;
}

/**
 * Intercept window that lets the player launch crafts into missions from the Geoscape.
 */
export class InterceptState extends State {
  private _btnCancel: TextButton;
  private _btnGotoBase: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _txtCraft: Text;
  private _txtStatus: Text;
  private _txtBase: Text;
  private _txtWeapons: Text;
  private _lstCrafts: TextList;
  private _crafts: Craft[] = [];

  constructor(private _globe: Globe, private _base: Base | null = null, private _target: TargetLike | null = null) {
    super();
    this._screen = false;

    this._window = new Window(this, 320, 140, 0, 30, POPUP_HORIZONTAL);
    this._btnCancel = new TextButton(this._base ? 142 : 288, 16, 16, 146);
    this._btnGotoBase = new TextButton(142, 16, 162, 146);
    this._txtTitle = new Text(300, 17, 10, 46);
    this._txtCraft = new Text(86, 9, 14, 70);
    this._txtStatus = new Text(70, 9, 100, 70);
    this._txtBase = new Text(80, 9, 170, 70);
    this._txtWeapons = new Text(80, 17, 238, 62);
    this._lstCrafts = new TextList(288, 64, 8, 78);

    this.setInterface("intercept");

    this.add(this._window, "window", "intercept");
    this.add(this._btnCancel, "button", "intercept");
    this.add(this._btnGotoBase, "button", "intercept");
    this.add(this._txtTitle, "text1", "intercept");
    this.add(this._txtCraft, "text2", "intercept");
    this.add(this._txtStatus, "text2", "intercept");
    this.add(this._txtBase, "text2", "intercept");
    this.add(this._txtWeapons, "text2", "intercept");
    this.add(this._lstCrafts, "list", "intercept");

    this.centerAllSurfaces();

    const back12 = this.game().getMod()?.getSurface("BACK12.SCR");
    if (back12) {
      this._window.setBackground(back12);
    }

    this._btnCancel.setText(String(this.tr("STR_CANCEL")));
    this._btnCancel.onMouseClick(this.btnCancelClick.bind(this));
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyCancel);
    this._btnCancel.onKeyboardPress(this.btnCancelClick.bind(this), Options.keyGeoIntercept);

    this._btnGotoBase.setText(String(this.tr("STR_GO_TO_BASE")));
    this._btnGotoBase.onMouseClick(this.btnGotoBaseClick.bind(this));
    this._btnGotoBase.setVisible(this._base !== null);

    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setBig();
    this._txtTitle.setText(String(this.tr("STR_LAUNCH_INTERCEPTION")));

    this._txtCraft.setText(String(this.tr("STR_CRAFT")));
    this._txtStatus.setText(String(this.tr("STR_STATUS")));
    this._txtBase.setText(String(this.tr("STR_BASE")));
    this._txtWeapons.setText(String(this.tr("STR_WEAPONS_CREW_HWPS")));

    this._lstCrafts.setColumns(4, 86, 70, 80, 46);
    this._lstCrafts.setSelectable(true);
    this._lstCrafts.setBackground(this._window);
    this._lstCrafts.setMargin(6);
    this._lstCrafts.onMouseClick(this.lstCraftsLeftClick.bind(this));
    this._lstCrafts.onMouseClick(this.lstCraftsRightClick.bind(this), SDL_BUTTON_RIGHT);

    let row = 0;
    for (const base of this.game().getSavedGame()?.getBases() || []) {
      if (this._base !== null && base !== this._base) {
        continue;
      }
      for (const craft of base.getCrafts()) {
        const crew = `${coloredCount(craft.getNumWeapons())}/${coloredCount(craft.getNumSoldiers())}/${coloredCount(craft.getNumVehicles())}`;
        this._crafts.push(craft);
        this._lstCrafts.addRow(4, craft.getName(this.game().getLanguage()), String(this.tr(craft.getStatus())), base.getName(), crew);
        if (craft.getStatus() === "STR_READY") {
          this._lstCrafts.setCellColor(row, 1, this._lstCrafts.getSecondaryColor());
        }
        row++;
      }
    }
  }

  btnCancelClick(_action?: Action): void {
    this.game().popState();
  }

  btnGotoBaseClick(_action?: Action): void {
    if (!this._base) {
      return;
    }
    this.game().popState();
    this.game().pushState(new BasescapeState(this._base, this._globe));
  }

  lstCraftsLeftClick(_action?: Action): void {
    const row = this._lstCrafts.getSelectedRow();
    if (row < 0 || row >= this._crafts.length) {
      return;
    }
    const craft = this._crafts[row] as CraftRuntime;
    if (craft.getStatus() === "STR_READY" || ((craft.getStatus() === "STR_OUT" || craftLaunchAlways()) && !craft.getLowFuel?.() && !craft.getMissionComplete?.())) {
      this.game().popState();
      if (this._target === null) {
        this.game().pushState(new SelectDestinationState(craft, this._globe));
      } else {
        this.game().pushState(new ConfirmDestinationState(craft, this._target));
      }
    }
  }

  lstCraftsRightClick(_action?: Action): void {
    const row = this._lstCrafts.getSelectedRow();
    if (row < 0 || row >= this._crafts.length) {
      return;
    }
    const craft = this._crafts[row];
    if (craft.getStatus() === "STR_OUT") {
      (this._globe as GlobeRuntime).center?.(craft.getLongitude(), craft.getLatitude());
      this.game().popState();
    }
  }
}
