import type { MissionDebriefingReport } from "../campaign/CampaignModel";
import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { TextButton } from "../interface/TextButton";
import { UiRect, UiText } from "../interface/UiPrimitives";
import type { UiWidget } from "../interface/UiState";
import { UiState } from "../interface/UiState";
import type { BasescapeState } from "./BasescapeState";

export class DebriefingState implements GameState {
  readonly id = "debriefing";
  private readonly report: MissionDebriefingReport;
  private readonly basescapeState: BasescapeState;
  private readonly ui = new UiState();

  constructor(report: MissionDebriefingReport, basescapeState: BasescapeState) {
    this.report = report;
    this.basescapeState = basescapeState;
  }

  enter(ctx: StateContext): void {
    const { width } = ctx.game.getRenderer().getSize();
    const outcome = this.report.aborted
      ? "ABORTED"
      : this.report.success
        ? "SUCCESS"
        : "FAILURE";
    const outcomeColor = this.report.success ? "#9ad8a0" : this.report.aborted ? "#d8c89a" : "#d89a9a";

    const widgets: UiWidget[] = [
      new UiText(8, 14, "MISSION DEBRIEFING", { color: "#efe7dc", size: 10 }, 1),
      new UiRect(8, 22, 306, 166, "p:0", "#7b6a57", 1),
      new UiText(14, 34, `Mission: ${this.report.missionLabel.slice(0, 26)}`, { color: "#d8c8b2", size: 8 }, 1),
      new UiText(14, 44, `Outcome: ${outcome}`, { color: outcomeColor, size: 8 }, 1),
      new UiText(
        14,
        54,
        `Loot: $${this.report.lootCredits.toLocaleString()}  Score: ${this.report.scoreDelta >= 0 ? "+" : ""}${this.report.scoreDelta}`,
        { color: "#c8b49a", size: 7 },
        1
      ),
      new UiText(14, 63, `KIA ${this.report.kia}  Wounded ${this.report.wounded}  Promoted ${this.report.promoted}`, { color: "#c8b49a", size: 7 }, 1),
      new UiText(14, 76, "Soldier                Status    Rank      Kills  Gains", { color: "#d8c8b2", size: 7 }, 1)
    ];

    let y = 86;
    for (const soldier of this.report.soldiers.slice(0, 11)) {
      const statusColor = soldier.status === "kia" ? "#d89a9a" : soldier.status === "wounded" ? "#d8c89a" : "#9ad8a0";
      const promoted = soldier.rankBefore !== soldier.rankAfter;
      const gains = `F${soldier.statGain.firing} R${soldier.statGain.reactions}`;
      widgets.push(new UiText(14, y, soldier.name.slice(0, 19).padEnd(19), { color: "#c8b49a", size: 7 }, 1));
      widgets.push(new UiText(114, y, soldier.status.toUpperCase().padEnd(8), { color: statusColor, size: 7 }, 1));
      widgets.push(
        new UiText(166, y, (promoted ? `${soldier.rankBefore}>${soldier.rankAfter}` : soldier.rankAfter).slice(0, 10), {
          color: promoted ? "#9ad8a0" : "#c8b49a",
          size: 7
        }, 1)
      );
      widgets.push(new UiText(228, y, `${soldier.killsGained}`.padStart(2), { color: "#c8b49a", size: 7 }, 1));
      widgets.push(new UiText(252, y, gains, { color: "#c8b49a", size: 7 }, 1));
      y += 9;
    }

    widgets.push(
      new TextButton(width - 106, 184, 98, 16, "CONTINUE", () => ({ type: "switch", next: this.basescapeState }), {
        background: "#4c4038",
        border: "#c5ab8b",
        focusBorder: "#fff0d5",
        foreground: "#fff0d5",
        fontSize: 8
      })
    );

    this.ui.setWidgets(widgets);
  }

  update(): StateTransition {
    return noTransition();
  }

  render(ctx: StateContext): void {
    const r = ctx.game.getRenderer();
    r.clear("#120f11");
    this.ui.draw(r);
  }

  onPointerDown(_: StateContext, x: number, y: number): StateTransition {
    return this.ui.onPointerDown(x, y);
  }

  onKeyDown(_: StateContext, event: KeyboardEvent): StateTransition {
    const transition = this.ui.onKeyDown(event);
    if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    return transition;
  }
}
