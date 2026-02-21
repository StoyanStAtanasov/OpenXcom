import type { StrategicOutcomeAlert } from "../campaign/CampaignModel";
import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { TextButton } from "../interface/TextButton";
import { UiText } from "../interface/UiPrimitives";
import { UiState } from "../interface/UiState";

export class StrategicOutcomeState implements GameState {
  readonly id = "strategic-outcome";
  private readonly alert: StrategicOutcomeAlert;
  private readonly fallbackState: GameState;
  private readonly ui = new UiState();

  constructor(alert: StrategicOutcomeAlert, fallbackState: GameState) {
    this.alert = alert;
    this.fallbackState = fallbackState;
  }

  enter(ctx: StateContext): void {
    const { width } = ctx.game.getRenderer().getSize();
    const defeat = this.alert.kind === "defeat";
    this.ui.setWidgets([
      new UiText(92, 54, defeat ? "XCOM DEFEATED" : "XCOM VICTORY", { color: defeat ? "#f0a0a0" : "#a0f0b1", size: 12 }, 1),
      new UiText(24, 82, this.alert.title.slice(0, 32), { color: "#e8dfd2", size: 9 }, 1),
      new UiText(24, 98, this.alert.detail.slice(0, 46), { color: "#cabba8", size: 8 }, 1),
      new UiText(88, 122, "Campaign outcome reached.", { color: "#cabba8", size: 8 }, 1),
      new UiText(64, 132, "Continue keeps simulation running.", { color: "#cabba8", size: 8 }, 1),
      new TextButton(width - 106, 162, 98, 16, "CONTINUE", () => ({ type: "switch", next: this.fallbackState }), {
        background: defeat ? "#4f2a2a" : "#2a4f33",
        border: defeat ? "#d79a9a" : "#9ad7aa",
        focusBorder: "#f5f0e7",
        foreground: "#f5f0e7",
        fontSize: 8
      }),
      new TextButton(width - 106, 184, 98, 16, "QUIT", () => ({ type: "quit" }), {
        background: defeat ? "#4f2a2a" : "#2a4f33",
        border: defeat ? "#d79a9a" : "#9ad7aa",
        focusBorder: "#f5f0e7",
        foreground: "#f5f0e7",
        fontSize: 8
      })
    ]);
  }

  update(): StateTransition {
    return noTransition();
  }

  render(ctx: StateContext): void {
    const r = ctx.game.getRenderer();
    const defeat = this.alert.kind === "defeat";

    r.clear(defeat ? "#170d0d" : "#0d170f");
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
