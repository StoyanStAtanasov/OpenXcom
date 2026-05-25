import type { Action } from "../Engine/Action.ts";
import { Options } from "../Engine/Options.ts";
import { State } from "../Engine/State.ts";
import { ALIGN_CENTER, Text } from "../Interface/Text.ts";
import { TextButton } from "../Interface/TextButton.ts";
import { TextList } from "../Interface/TextList.ts";
import { Window } from "../Interface/Window.ts";
import type { Soldier } from "../Savegame/Soldier.ts";

/**
 * Medals screen that displays dead soldier medals.
 */
export class CommendationLateState extends State {
  private _btnOk: TextButton;
  private _window: Window;
  private _txtTitle: Text;
  private _lstSoldiers: TextList;

  constructor(soldiersMedalled: Soldier[]) {
    super();
    this._window = new Window(this, 320, 200, 0, 0);
    this._btnOk = new TextButton(288, 16, 16, 176);
    this._txtTitle = new Text(300, 16, 10, 8);
    this._lstSoldiers = new TextList(288, 128, 8, 32);

    this.setInterface("commendationsLate");
    this.add(this._window, "window", "commendationsLate");
    this.add(this._btnOk, "button", "commendationsLate");
    this.add(this._txtTitle, "text", "commendationsLate");
    this.add(this._lstSoldiers, "list", "commendationsLate");
    this.centerAllSurfaces();

    const back02 = this.game().getMod()?.getSurface("BACK02.SCR");
    if (back02) {
      this._window.setBackground(back02);
    }
    this._btnOk.setText(String(this.tr("STR_OK")));
    this._btnOk.onMouseClick(this.btnOkClick.bind(this));
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyOk);
    this._btnOk.onKeyboardPress(this.btnOkClick.bind(this), Options.keyCancel);
    this._txtTitle.setBig();
    this._txtTitle.setAlign(ALIGN_CENTER);
    this._txtTitle.setText(String(this.tr("STR_LOST_IN_SERVICE")));
    this._lstSoldiers.setColumns(5, 51, 51, 51, 51, 84);
    this._lstSoldiers.setSelectable(true);
    this._lstSoldiers.setBackground(this._window);
    this._lstSoldiers.setMargin(8);
    this._lstSoldiers.setFlooding(true);

    this.populateSoldiers(soldiersMedalled);
  }

  private populateSoldiers(soldiersMedalled: Soldier[]): void {
    const mod = this.game().getMod() as { getCommendationsList?: () => Map<string, unknown> | Record<string, unknown> } | null;
    const list = mod?.getCommendationsList?.() || new Map<string, unknown>();
    const commendationsList = list instanceof Map ? [...list.entries()] : Object.entries(list);

    for (const soldier of soldiersMedalled as any[]) {
      this._lstSoldiers.addRow(
        5,
        soldier.getName?.() || "",
        "",
        String(this.tr(soldier.getRankString?.() || "")),
        "",
        String(this.tr("STR_KILLS").arg(soldier.getDiary?.().getKillTotal?.() || 0))
      );

      for (let index = 0; index < commendationsList.length;) {
        let noun = "noNoun";
        let modularCommendation = false;
        const [commendationType, commendationRule] = commendationsList[index];
        for (const soldierComm of soldier.getDiary?.().getSoldierCommendations?.() || []) {
          if (soldierComm.getType?.() === commendationType && soldierComm.isNew?.() && noun === "noNoun") {
            soldierComm.makeOld?.();
            if (soldierComm.getNoun?.() !== "noNoun") {
              noun = soldierComm.getNoun();
              modularCommendation = true;
            }
            const skipCounter = this.calculateSkipCounter(commendationRule, soldierComm);
            const title = modularCommendation
              ? String(this.tr(commendationType).arg(this.tr(noun)))
              : String(this.tr(commendationType));
            this._lstSoldiers.addRow(5, `   ${title}`, "", "", "", String(this.tr(soldierComm.getDecorationLevelName?.(skipCounter) || "")));
            break;
          }
        }
        if (noun === "noNoun") {
          index++;
        }
      }
    }
  }

  private calculateSkipCounter(commendationRule: any, soldierComm: any): number {
    const criteriaMap = commendationRule?.getCriteria?.();
    const first = criteriaMap instanceof Map ? criteriaMap.values().next().value : Object.values(criteriaMap || {})[0];
    const criteria: number[] = Array.isArray(first) ? first : [];
    let skipCounter = 0;
    let lastInt = -2;
    const decorationLevel = soldierComm.getDecorationLevelInt?.() ?? -1;
    for (let i = 0; i < criteria.length && i <= decorationLevel; ++i) {
      const thisInt = criteria[i];
      if (i > 0) {
        lastInt = criteria[i - 1];
      }
      if (thisInt === lastInt) {
        skipCounter++;
      }
    }
    return skipCounter;
  }

  btnOkClick(_action?: Action): void {
    this.game().popState();
  }
}
