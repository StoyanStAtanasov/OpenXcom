import type { CampaignModel } from "../campaign/CampaignModel";
import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { TextButton } from "../interface/TextButton";
import { UiRect, UiText } from "../interface/UiPrimitives";
import type { UiWidget } from "../interface/UiState";
import { UiState } from "../interface/UiState";

type Report = NonNullable<ReturnType<CampaignModel["consumeCouncilReport"]>>;

export class CouncilReportState implements GameState {
  readonly id = "council-report";
  private readonly report: Report;
  private readonly nextState: GameState;
  private readonly ui = new UiState();

  constructor(report: Report, nextState: GameState) {
    this.report = report;
    this.nextState = nextState;
  }

  enter(ctx: StateContext): void {
    const { width } = ctx.game.getRenderer().getSize();
    const ratingColor = this.report.rating === "Excellent" ? "#96e0a8"
      : this.report.rating === "Good" ? "#a2d9ff"
      : this.report.rating === "Average" ? "#d6d6a2"
      : this.report.rating === "Poor" ? "#e2b28f"
      : "#e08f8f";
    const netColor = this.report.net >= 0 ? "#95d9a8" : "#d99595";

    const widgets: UiWidget[] = [
      new UiText(8, 14, "COUNCIL REPORT", { color: "#dce7ff", size: 10 }, 1),
      new UiRect(8, 22, 306, 166, "p:0", "#7387b0", 1),
      new UiText(14, 34, `Month: ${this.report.monthIso}`, { color: "#b9caea", size: 8 }, 1),
      new UiText(14, 44, `Council Rating: ${this.report.rating}`, { color: ratingColor, size: 8 }, 1),
      new UiText(14, 54, `Income ${this.report.income.toLocaleString()}  Maint ${this.report.maintenance.toLocaleString()}`, { color: "#a7bbdd", size: 7 }, 1),
      new UiText(14, 63, `Salaries ${this.report.salaries.toLocaleString()}  Score ${this.report.scoreBonus.toLocaleString()}`, { color: "#a7bbdd", size: 7 }, 1),
      new UiText(14, 72, `Net ${this.report.net.toLocaleString()}  Funds ${this.report.fundsAfter.toLocaleString()}`, { color: netColor, size: 7 }, 1),
      new UiText(14, 86, "Country              Funding Delta   Satisfaction   Pact", { color: "#c7d6f2", size: 7 }, 1)
    ];

    let y = 96;
    for (const row of this.report.countryChanges.slice(0, 10)) {
      const deltaStr = `${row.delta >= 0 ? "+" : ""}${row.delta.toLocaleString()}`;
      const deltaColor = row.delta >= 0 ? "#95d9a8" : "#d99595";
      const satColor = row.satisfaction >= 60 ? "#95d9a8" : row.satisfaction >= 35 ? "#d6d6a2" : "#d99595";
      const pactColor = row.pact ? "#d99595" : "#a7bbdd";
      widgets.push(new UiText(14, y, row.label.slice(0, 18).padEnd(18), { color: "#a7bbdd", size: 7 }, 1));
      widgets.push(new UiText(130, y, deltaStr.padStart(10), { color: deltaColor, size: 7 }, 1));
      widgets.push(new UiText(214, y, `${row.satisfaction}`.padStart(3), { color: satColor, size: 7 }, 1));
      widgets.push(new UiText(270, y, row.pact ? "YES" : "NO", { color: pactColor, size: 7 }, 1));
      y += 9;
    }

    widgets.push(
      new TextButton(width - 106, 184, 98, 16, "CONTINUE", () => ({ type: "switch", next: this.nextState }), {
        background: "#33415a",
        border: "#9fb9e2",
        focusBorder: "#dce7ff",
        foreground: "#eff5ff",
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
    r.clear("#0f1320");
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
