import { CampaignModel } from "../campaign/CampaignModel";
import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { TextButton } from "../interface/TextButton";
import { UiState } from "../interface/UiState";
import { BasescapeState } from "./BasescapeState";
import { DebriefingState } from "./DebriefingState";
import {
  TacticalSimulation,
  type TacticalActionMode,
  type TacticalView
} from "../battlescape/TacticalSimulation";

export class BattlescapeState implements GameState {
  readonly id = "battlescape";
  private readonly campaign: CampaignModel;
  private readonly basescapeState: BasescapeState;
  private readonly ui = new UiState();
  private simulation: TacticalSimulation | null = null;

  constructor(campaign: CampaignModel, basescapeState: BasescapeState) {
    this.campaign = campaign;
    this.basescapeState = basescapeState;
  }

  enter(ctx: StateContext): void {
    void ctx.game.getRenderer().setPalettePack(this.campaign.getGameId() === "xcom1" ? "ufo" : "tftd");
    const { width } = ctx.game.getRenderer().getSize();
    const roster = this.campaign.getBattleDeployment(8);
    this.simulation = new TacticalSimulation(roster);

    const baseStyle = {
      background: "#473c35",
      border: "#c5ab8b",
      focusBorder: "#fff0d5",
      foreground: "#fff0d5",
      fontSize: 8
    };
    this.ui.setWidgets([
      new TextButton(width - 106, 20, 98, 16, "ABORT", () => this.finishMission(true), baseStyle),
      new TextButton(width - 106, 42, 98, 16, "END TURN", () => {
        this.simulation?.endTurn();
        return noTransition();
      }, baseStyle),
      new TextButton(width - 106, 64, 98, 16, "NEXT UNIT", () => {
        this.simulation?.cycleSelectedUnit();
        return noTransition();
      }, baseStyle),
      new TextButton(width - 106, 86, 98, 16, "KNEEL/STAND", () => {
        this.simulation?.kneelSelected();
        return noTransition();
      }, baseStyle),
      new TextButton(width - 106, 116, 46, 16, "MOVE", () => this.setMode("move"), () => ({
        ...baseStyle,
        background: this.simulation?.getMode() === "move" ? "#7d5a31" : baseStyle.background
      })),
      new TextButton(width - 58, 116, 50, 16, "SMOKE", () => this.setMode("smoke"), () => ({
        ...baseStyle,
        background: this.simulation?.getMode() === "smoke" ? "#7d5a31" : baseStyle.background
      })),
      new TextButton(width - 106, 138, 46, 16, "SNAP", () => this.setMode("snap"), () => ({
        ...baseStyle,
        background: this.simulation?.getMode() === "snap" ? "#7d5a31" : baseStyle.background
      })),
      new TextButton(width - 58, 138, 50, 16, "AUTO", () => this.setMode("auto"), () => ({
        ...baseStyle,
        background: this.simulation?.getMode() === "auto" ? "#7d5a31" : baseStyle.background
      })),
      new TextButton(width - 106, 186, 98, 16, "EXIT", () => this.finishMission(false), baseStyle)
    ]);
  }

  update(): StateTransition {
    const sim = this.simulation;
    if (!sim) return noTransition();

    const view = sim.getView();
    if (view.state === "xcom-victory" || view.state === "xcom-defeat" || view.state === "aborted") {
      return this.finishMission(false);
    }

    return noTransition();
  }

  render(ctx: StateContext): void {
    const sim = this.simulation;
    if (!sim) return;

    const r = ctx.game.getRenderer();
    const view = sim.getView();
    const snapshot = this.campaign.getSnapshot();

    r.clear("#13110f");
    r.text("BATTLESCAPE", 8, 13, "#f3ead8", 10);

    this.renderMap(r, view);
    this.renderUnits(r, view);
    const missionCraft =
      snapshot.bases[0]?.craftLoadout.find((craft) => craft.status === "STR_ON_MISSION" || craft.status === "STR_OUTBOUND")
      ?? snapshot.bases[0]?.craftLoadout[0];
    this.renderHud(r, view, snapshot.funds, missionCraft);

    this.ui.draw(r);
  }

  onPointerDown(_: StateContext, x: number, y: number): StateTransition {
    const uiTransition = this.ui.onPointerDown(x, y);
    if (uiTransition.type !== "none") return uiTransition;

    const sim = this.simulation;
    if (!sim) return noTransition();

    const originX = 8;
    const originY = 22;
    const tile = 14;
    const gridX = Math.floor((x - originX) / tile);
    const gridY = Math.floor((y - originY) / tile);

    if (gridX >= 0 && gridX < 14 && gridY >= 0 && gridY < 10) {
      sim.onTileClicked(gridX, gridY);
    }

    return noTransition();
  }

  onKeyDown(_: StateContext, event: KeyboardEvent): StateTransition {
    const transition = this.ui.onKeyDown(event);
    if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
    }
    return transition;
  }

  private setMode(mode: TacticalActionMode): StateTransition {
    this.simulation?.setMode(mode);
    return noTransition();
  }

  private finishMission(forceAbort: boolean): StateTransition {
    const sim = this.simulation;
    if (!sim) return { type: "switch", next: this.basescapeState };

    if (forceAbort) sim.abortMission();

    const outcome = sim.buildOutcome();
    this.campaign.applyBattlescapeOutcome(outcome);
    const report = this.campaign.consumeDebriefingReport();
    this.simulation = null;
    if (report) return { type: "switch", next: new DebriefingState(report, this.basescapeState) };
    return { type: "switch", next: this.basescapeState };
  }

  private renderMap(r: ReturnType<StateContext["game"]["getRenderer"]>, view: TacticalView): void {
    const originX = 8;
    const originY = 22;
    const tile = 14;

    for (const t of view.tiles) {
      const px = originX + t.x * tile;
      const py = originY + t.y * tile;

      let color = "#2f3a34";
      if (t.terrain === "cover") color = "#485547";
      if (t.terrain === "wall") color = "#262624";
      if (t.smoke > 0) color = t.smoke > 1 ? "#6f7278" : "#55595f";

      r.rect(px, py, tile - 1, tile - 1, color);
      if (t.terrain === "wall") {
        r.strokeRect(px, py, tile - 1, tile - 1, "#8d8a74");
      }
    }

    r.strokeRect(originX - 1, originY - 1, view.width * tile + 1, view.height * tile + 1, "#a8a189");
  }

  private renderUnits(r: ReturnType<StateContext["game"]["getRenderer"]>, view: TacticalView): void {
    const originX = 8;
    const originY = 22;
    const tile = 14;

    for (const unit of view.units) {
      const px = originX + unit.x * tile;
      const py = originY + unit.y * tile;

      const bodyColor = unit.faction === "xcom" ? "#6fa4dd" : "#d66f6f";
      r.rect(px + 2, py + 2, tile - 5, tile - 5, bodyColor);
      if (unit.kneeling) r.strokeRect(px + 1, py + 1, tile - 3, tile - 3, "#f2dd8a");
      if (unit.selected) r.strokeRect(px, py, tile - 1, tile - 1, "#ffe46e");

      const hpWidth = Math.max(1, Math.floor(((tile - 4) * unit.hp) / Math.max(1, unit.maxHp)));
      r.rect(px + 2, py + tile - 3, tile - 4, 2, "#2a1c1c");
      r.rect(px + 2, py + tile - 3, hpWidth, 2, "#8fe08f");
    }
  }

  private renderHud(
    r: ReturnType<StateContext["game"]["getRenderer"]>,
    view: TacticalView,
    funds: number,
    craft:
      | ReturnType<CampaignModel["getSnapshot"]>["bases"][number]["craftLoadout"][number]
      | undefined
  ): void {
    const panelX = 206;

    r.text(`Turn ${view.turnNumber} | ${view.turn.toUpperCase()}`, panelX, 16, "#efe1c4", 8);
    r.text(`Mode ${view.mode.toUpperCase()}`, panelX, 26, "#d1bc9d", 8);
    r.text(`Obj: ${view.objective}`, panelX, 36, "#d1bc9d", 7);
    r.text(`XCOM ${view.xcomAlive}  ALIEN ${view.alienAlive}`, panelX, 46, "#d1bc9d", 7);

    let y = 160;
    r.text("Squad", panelX, y, "#efe1c4", 8);
    y += 8;
    for (const unit of view.units.filter((u) => u.faction === "xcom").slice(0, 5)) {
      const marker = unit.selected ? ">" : " ";
      const panicTag = unit.panicked ? " P!" : "";
      r.text(`${marker}${unit.name.slice(0, 8)} H${unit.hp} M${unit.morale}${panicTag}`, panelX, y, "#c8b08f", 7);
      y += 8;
    }

    if (craft) {
      y += 2;
      r.text("Transport", panelX, y, "#efe1c4", 8);
      y += 8;
      r.text(craft.label.slice(0, 14), panelX, y, "#c8b08f", 7);
      y += 8;
      r.text(`Fuel ${craft.fuel} Dmg ${craft.damage}`, panelX, y, "#c8b08f", 7);
    }

    y = 90;
    r.text("Combat Log", panelX, y, "#efe1c4", 8);
    y += 8;
    for (const line of view.log.slice(-7)) {
      r.text(line.slice(0, 21), panelX, y, "#b8a488", 7);
      y += 7;
    }

    r.text(`Funding $${funds.toLocaleString()}`, 8, 193, "#c8bba3", 7);
    r.text("Map click: select/move/attack", 110, 193, "#c8bba3", 7);
  }
}
