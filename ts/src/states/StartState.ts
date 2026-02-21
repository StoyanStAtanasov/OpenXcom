import { CampaignModel } from "../campaign/CampaignModel";
import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { TextButton, type TextButtonStyle } from "../interface/TextButton";
import { UiRect, UiText } from "../interface/UiPrimitives";
import { UiState } from "../interface/UiState";
import type { GameId, LoadedRuleset } from "../ruleset/types";
import { GeoscapeState } from "./GeoscapeState";

interface AssetManifest {
  generatedAtIso: string;
  packs: Array<{
    name: string;
    synced: boolean;
    fileCount: number;
    topExtensions: Array<{ ext: string; count: number }>;
  }>;
}

export class StartState implements GameState {
  readonly id = "start";
  private readonly rulesets: { xcom1: LoadedRuleset; xcom2: LoadedRuleset };
  private readonly assetManifest: AssetManifest | null;
  private readonly ui = new UiState();
  private selectedGame: GameId = "xcom1";

  constructor(rulesets: { xcom1: LoadedRuleset; xcom2: LoadedRuleset }, assetManifest: AssetManifest | null = null) {
    this.rulesets = rulesets;
    this.assetManifest = assetManifest;
  }

  enter(ctx: StateContext): void {
    this.syncPalette(ctx);
    this.rebuildUi(ctx);
  }

  update(): StateTransition {
    return noTransition();
  }

  render(ctx: StateContext): void {
    const r = ctx.game.getRenderer();
    r.clear("#06101d");
    this.ui.draw(r);
  }

  onPointerDown(ctx: StateContext, x: number, y: number): StateTransition {
    const selectedBefore = this.selectedGame;
    const transition = this.ui.onPointerDown(x, y);
    if (selectedBefore !== this.selectedGame) {
      this.rebuildUi(ctx);
    }
    return transition;
  }

  onKeyDown(ctx: StateContext, event: KeyboardEvent): StateTransition {
    const selectedBefore = this.selectedGame;
    const transition = this.ui.onKeyDown(event);
    const shouldRebuild = selectedBefore !== this.selectedGame;
    if (shouldRebuild) {
      this.rebuildUi(ctx);
    }
    if (
      event.key === "Tab" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowLeft" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
    }
    return transition;
  }

  private rebuildUi(ctx: StateContext): void {
    const { width, height } = ctx.game.getRenderer().getSize();
    const slots = CampaignModel.listSaveSlots(this.selectedGame);
    const hasAnySave = slots.length > 0;
    const latestSlot = slots[0]?.slot;
    const slotInfo = new Map(slots.map((slot) => [slot.slot, slot]));

    const baseStyle: TextButtonStyle = {
      background: "#0e2238",
      border: "#74a0c8",
      focusBorder: "#9fd8ff",
      foreground: "#f4f7fb",
      fontSize: 8
    };

    const widgets = [
      new UiRect(0, 0, width, 20, "#102846", undefined, 0),
      new UiText(8, 10, "OPENXCOM WEB (TS)", { color: "#9fd8ff", size: 10 }, 1),
      new UiText(106, 34, "SELECT RULESET", { color: "#f2f2f2", size: 10 }, 1),
      new UiText(118, 46, () => `Active: ${this.selectedGame === "xcom1" ? "UFO" : "TFTD"}`, { color: "#9cb3c9", size: 8 }, 1),
      new UiText(106, 56, () => `Ruleset: ${this.selectedGame}/`, { color: "#9cb3c9", size: 8 }, 1),
      new UiText(
        92,
        66,
        () => {
          const pack = this.assetManifest?.packs.find((entry) => entry.name === (this.selectedGame === "xcom1" ? "ufo" : "tftd"));
          return pack?.synced ? `Assets synced: ${pack.fileCount} files` : "Assets manifest missing";
        },
        () => {
          const pack = this.assetManifest?.packs.find((entry) => entry.name === (this.selectedGame === "xcom1" ? "ufo" : "tftd"));
          return { color: pack?.synced ? "#8dd19a" : "#d1a28d", size: 8 };
        },
        1
      ),
      new UiText(
        10,
        136,
        () => {
          const latest = CampaignModel.listSaveSlots(this.selectedGame)[0];
          if (!latest) {
            return `No ${this.selectedGame.toUpperCase()} saves found`;
          }
          const slotLabel = latest.slot === 0 ? "A" : latest.slot.toString();
          return `Latest ${this.selectedGame.toUpperCase()}: S${slotLabel} ${latest.inGameDateIso.slice(0, 10)} $${latest.funds.toLocaleString()}`;
        },
        () => {
          const hasSave = CampaignModel.listSaveSlots(this.selectedGame).length > 0;
          return { color: hasSave ? "#a6bfd5" : "#7d93a8", size: 8 };
        },
        1
      ),
      new UiText(
        8,
        height - 18,
        () => {
          const meta = this.currentRuleset().mergeMeta;
          const layers = meta?.layerOrder.length ?? 1;
          const vanilla = meta?.resourcePhases?.vanilla;
          const files = vanilla?.files;
          const fileSummary = files ? `BP:${files.backpalsDat ? "Y" : "N"} PL:${files.palettesDat ? "Y" : "N"}` : "BP:? PL:?";
          return `Layers ${layers}  ${fileSummary}`;
        },
        { color: "#7d93a8", size: 8 },
        1
      ),
      new UiText(8, height - 10, `Canvas ${width}x${height}`, { color: "#7d93a8", size: 8 }, 1),
      new TextButton(width / 2 - 60, 74, 58, 18, this.selectedGame === "xcom1" ? "UFO*" : "UFO", () => {
        this.selectedGame = "xcom1";
        this.syncPalette(ctx);
        return noTransition();
      }, baseStyle),
      new TextButton(width / 2 + 2, 74, 58, 18, this.selectedGame === "xcom2" ? "TFTD*" : "TFTD", () => {
        this.selectedGame = "xcom2";
        this.syncPalette(ctx);
        return noTransition();
      }, baseStyle),
      new TextButton(
        width / 2 - 60,
        96,
        120,
        20,
        this.selectedGame === "xcom1" ? "NEW GAME UFO" : "NEW GAME TFTD",
        () => ({ type: "switch", next: new GeoscapeState(new CampaignModel(this.rulesets[this.selectedGame])) }),
        baseStyle
      ),
      new TextButton(width / 2 - 60, 118, 120, 20, hasAnySave ? "CONTINUE LATEST" : "CONTINUE (N/A)", () => {
        const loaded = CampaignModel.loadFromStorage(this.rulesets[this.selectedGame], latestSlot);
        return loaded ? { type: "switch", next: new GeoscapeState(loaded) } : noTransition();
      }, baseStyle),
      new TextButton(width / 2 - 60, 148, 36, 16, slotInfo.has(1) ? "S1" : "S1-", () => {
        const loaded = CampaignModel.loadFromStorage(this.rulesets[this.selectedGame], 1);
        return loaded ? { type: "switch", next: new GeoscapeState(loaded) } : noTransition();
      }, baseStyle),
      new TextButton(width / 2 - 18, 148, 36, 16, slotInfo.has(2) ? "S2" : "S2-", () => {
        const loaded = CampaignModel.loadFromStorage(this.rulesets[this.selectedGame], 2);
        return loaded ? { type: "switch", next: new GeoscapeState(loaded) } : noTransition();
      }, baseStyle),
      new TextButton(width / 2 + 24, 148, 36, 16, slotInfo.has(3) ? "S3" : "S3-", () => {
        const loaded = CampaignModel.loadFromStorage(this.rulesets[this.selectedGame], 3);
        return loaded ? { type: "switch", next: new GeoscapeState(loaded) } : noTransition();
      }, baseStyle),
      new TextButton(width / 2 - 60, 170, 120, 20, "QUIT", () => ({ type: "quit" }), baseStyle)
    ];
    this.ui.setWidgets(widgets);
  }

  private syncPalette(ctx: StateContext): void {
    const pack = this.selectedGame === "xcom1" ? "ufo" : "tftd";
    void ctx.game.getRenderer().setPalettePack(pack);
  }

  private currentRuleset(): LoadedRuleset {
    return this.rulesets[this.selectedGame];
  }
}
