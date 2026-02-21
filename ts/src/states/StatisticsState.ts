import { CampaignModel } from "../campaign/CampaignModel";
import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { TextButton } from "../interface/TextButton";
import { UiRect, UiText } from "../interface/UiPrimitives";
import type { UiWidget } from "../interface/UiState";
import { UiState } from "../interface/UiState";

export class StatisticsState implements GameState {
  readonly id = "statistics";
  private readonly campaign: CampaignModel;
  private readonly backState: GameState;
  private readonly ui = new UiState();

  constructor(campaign: CampaignModel, backState: GameState) {
    this.campaign = campaign;
    this.backState = backState;
  }

  enter(ctx: StateContext): void {
    void ctx.game.getRenderer().setPalettePack(this.campaign.getGameId() === "xcom1" ? "ufo" : "tftd");
    const { width } = ctx.game.getRenderer().getSize();
    const stats = this.campaign.getStatisticsSnapshot();
    const strategic = this.campaign.getStrategicStatus();
    const locked = this.campaign.isCampaignLocked();

    const widgets: UiWidget[] = [
      new UiText(8, 14, "CAMPAIGN STATISTICS", { color: "#d2e4f7", size: 10 }, 1),
      new UiRect(8, 22, 306, 166, "p:0", "#6f859d", 1)
    ];

    let y = 36;
    widgets.push(new UiText(14, y, `Days elapsed: ${stats.daysElapsed}`, { color: "#a9bfd4", size: 8 }, 1)); y += 10;
    widgets.push(new UiText(14, y, `UFO detected: ${stats.ufoDetected}`, { color: "#a9bfd4", size: 8 }, 1)); y += 9;
    widgets.push(new UiText(14, y, `UFO downed: ${stats.ufoDowned}`, { color: "#a9bfd4", size: 8 }, 1)); y += 9;
    widgets.push(new UiText(14, y, `Interceptor sorties: ${stats.interceptorSorties}`, { color: "#a9bfd4", size: 8 }, 1)); y += 9;
    widgets.push(new UiText(14, y, `Interceptor damaged events: ${stats.interceptorDamaged}`, { color: "#a9bfd4", size: 8 }, 1)); y += 11;
    widgets.push(new UiText(14, y, `Missions launched: ${stats.missionsLaunched}`, { color: "#a9bfd4", size: 8 }, 1)); y += 9;
    widgets.push(new UiText(14, y, `Ground wins/losses/aborts: ${stats.groundWins}/${stats.groundLosses}/${stats.groundAborts}`, { color: "#a9bfd4", size: 8 }, 1)); y += 9;
    widgets.push(new UiText(14, y, `Soldier KIA: ${stats.soldiersKia}`, { color: "#d9a1a1", size: 8 }, 1)); y += 9;
    widgets.push(new UiText(14, y, `Soldier wounded: ${stats.soldiersWounded}`, { color: "#d9c5a1", size: 8 }, 1)); y += 9;
    widgets.push(new UiText(14, y, `Promotions: ${stats.promotions}`, { color: "#a9d9b1", size: 8 }, 1)); y += 9;
    widgets.push(new UiText(14, y, `Recovered loot credits: ${stats.lootCredits.toLocaleString()}`, { color: "#a9d9b1", size: 8 }, 1));

    let y2 = 36;
    widgets.push(new UiText(206, y2, "Strategic", { color: "#d2e4f7", size: 8 }, 1)); y2 += 10;
    widgets.push(new UiText(206, y2, `Final unlocked: ${strategic.finalAssaultUnlocked ? "YES" : "NO"}`, { color: "#a9bfd4", size: 8 }, 1)); y2 += 9;
    widgets.push(new UiText(206, y2, `Final launchable: ${strategic.finalAssaultLaunchable ? "YES" : "NO"}`, { color: "#a9bfd4", size: 8 }, 1)); y2 += 9;
    widgets.push(new UiText(206, y2, `Deficit months: ${strategic.deficitMonths}`, { color: "#a9bfd4", size: 8 }, 1)); y2 += 9;
    widgets.push(new UiText(206, y2, `Pacts: ${strategic.pactCount}/${strategic.totalCountries}`, { color: "#a9bfd4", size: 8 }, 1)); y2 += 9;
    widgets.push(new UiText(206, y2, `Campaign locked: ${locked ? "YES" : "NO"}`, { color: locked ? "#d9a1a1" : "#a9d9b1", size: 8 }, 1));

    widgets.push(
      new TextButton(width - 106, 184, 98, 16, "BACK", () => ({ type: "switch", next: this.backState }), {
        background: "#334659",
        border: "#9eb9d3",
        focusBorder: "#eef5ff",
        foreground: "#eef5ff",
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
    r.clear("#10161d");
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
