import { noTransition, type GameState, type StateContext, type StateTransition } from "../engine/State";
import { ModLoader } from "../mod/ModLoader";
import { StartState } from "./StartState";
import type { LoadedRuleset } from "../ruleset/types";

interface AssetManifest {
  generatedAtIso: string;
  packs: Array<{
    name: string;
    synced: boolean;
    fileCount: number;
    topExtensions: Array<{ ext: string; count: number }>;
  }>;
}

export class LoadingState implements GameState {
  readonly id = "loading";
  private readonly modLoader = new ModLoader();
  private loaded = false;
  private transition: StateTransition = noTransition();
  private error = "";
  private loadedRulesets: { xcom1: LoadedRuleset; xcom2: LoadedRuleset } | null = null;
  private assetManifest: AssetManifest | null = null;

  enter(): void {
    void this.startLoading();
  }

  update(): StateTransition {
    if (this.loaded) {
      return this.transition;
    }
    return noTransition();
  }

  render(ctx: StateContext): void {
    const r = ctx.game.getRenderer();
    const { width, height } = r.getSize();
    r.clear("#040a14");
    r.rect(0, 0, width, 20, "#0e1f37");
    r.text("OPENXCOM WEB (TS)", 8, 14, "#9fd8ff", 10);
    r.text("Loading xcom1 ruleset...", 80, 98, "#dce8f4", 10);
    r.text("Preparing UFO + TFTD datasets...", 52, 112, "#98b2cc", 8);
    if (this.error) {
      r.text(this.error, 8, height - 10, "#f9a2a2", 8);
    }
  }

  private async startLoading(): Promise<void> {
    try {
      const [xcom1, xcom2] = await Promise.all([this.modLoader.loadAll("xcom1"), this.modLoader.loadAll("xcom2")]);
      this.loadedRulesets = { xcom1, xcom2 };
      this.assetManifest = await this.tryLoadAssetManifest();
      this.transition = { type: "switch", next: new StartState(this.loadedRulesets, this.assetManifest) };
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Ruleset load failed";
      this.transition = noTransition();
    } finally {
      this.loaded = true;
    }
  }

  private async tryLoadAssetManifest(): Promise<AssetManifest | null> {
    try {
      const response = await fetch("/game-assets/manifest.json");
      if (!response.ok) return null;
      const parsed = (await response.json()) as AssetManifest;
      if (!parsed || !Array.isArray(parsed.packs)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
