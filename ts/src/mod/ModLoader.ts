import {
  loadRulesetNamePools,
  loadRulesetRawDocumentsFromBasePath,
  loadRulesetRawDocuments,
  parseRulesetRawDocuments
} from "../ruleset/RulesetLoader";
import type { GameId, LoadedRuleset } from "../ruleset/types";

interface ModLayer {
  readonly name: string;
  readonly basePath: string;
  readonly index: number;
  readonly size: number;
  readonly offset: number;
}

interface LoadedLayerRaw {
  readonly layer: ModLayer;
  readonly raw: Awaited<ReturnType<typeof loadRulesetRawDocuments>>;
}

interface ParsedLayerDocs {
  readonly layer: ModLayer;
  readonly docs: ReturnType<typeof parseRulesetRawDocuments>;
}

interface ParsedRulesetBundle {
  merged: {
    language: Record<string, string>;
    countries: { items: LoadedRuleset["countries"]; index: string[] };
    regions: { items: LoadedRuleset["regions"]; index: string[] };
    facilities: { items: LoadedRuleset["facilities"]; index: string[] };
    crafts: { items: LoadedRuleset["crafts"]; index: string[] };
    items: { items: LoadedRuleset["items"]; index: string[] };
    research: { items: LoadedRuleset["research"]; index: string[] };
    manufacture: { items: LoadedRuleset["manufacture"]; index: string[] };
    soldiers: { items: LoadedRuleset["soldiers"]; index: string[] };
    startingBase: ReturnType<typeof parseRulesetRawDocuments>["starting"]["startingBase"];
    layerOrder: string[];
    layerOffsets: Record<string, number>;
    vanillaPhase: {
      assetPack: "ufo" | "tftd";
      manifestAvailable: boolean;
      files: {
        backpalsDat: boolean;
        palettesDat: boolean;
      };
    };
  };
  soldierNamePools: Awaited<ReturnType<typeof loadRulesetNamePools>>;
}

interface ModLayerManifest {
  layers?: Array<{
    name?: string;
    path?: string;
    index?: number;
    size?: number;
  }>;
}

export class ModLoader {
  async loadAll(gameId: GameId): Promise<LoadedRuleset> {
    const vanillaPhase = await this.loadVanillaResources(gameId);
    const rawLayers = await this.loadResourceConfigAndVanilla(gameId);
    const parsed = await this.loadRulesetsAndMerge(rawLayers, vanillaPhase);
    return this.loadExtraResources(gameId, parsed);
  }

  private async loadResourceConfigAndVanilla(gameId: GameId): Promise<LoadedLayerRaw[]> {
    const layers = await this.resolveLayers(gameId);
    const loaded = await Promise.all(
      layers.map(async (layer): Promise<LoadedLayerRaw> => ({
        layer,
        raw: await loadRulesetRawDocumentsFromBasePath(layer.basePath)
      }))
    );
    return loaded.sort((a, b) => a.layer.index - b.layer.index);
  }

  private async loadRulesetsAndMerge(rawLayers: LoadedLayerRaw[], vanillaPhase: ParsedRulesetBundle["merged"]["vanillaPhase"]): Promise<ParsedRulesetBundle> {
    const parsedLayers: ParsedLayerDocs[] = rawLayers.map((entry) => ({
      layer: entry.layer,
      docs: parseRulesetRawDocuments(entry.raw)
    }));

    const merged = {
      language: this.mergeLanguage(parsedLayers),
      countries: this.mergeRuleTable(parsedLayers, (docs) => docs.countries.countries, ["type"]),
      regions: this.mergeRuleTable(parsedLayers, (docs) => docs.regions.regions, ["type"]),
      facilities: this.mergeRuleTable(parsedLayers, (docs) => docs.facilities.facilities, ["type"]),
      crafts: this.mergeRuleTable(parsedLayers, (docs) => docs.crafts.crafts, ["type"]),
      items: this.mergeRuleTable(parsedLayers, (docs) => docs.items.items, ["type"]),
      research: this.mergeRuleTable(parsedLayers, (docs) => docs.research.research, ["name"]),
      manufacture: this.mergeRuleTable(parsedLayers, (docs) => docs.manufacture.manufacture, ["name"]),
      soldiers: this.mergeRuleTable(parsedLayers, (docs) => docs.soldiers.soldiers, ["type"]),
      startingBase: this.pickStartingBase(parsedLayers),
      layerOrder: parsedLayers.map((entry) => entry.layer.name),
      layerOffsets: Object.fromEntries(parsedLayers.map((entry) => [entry.layer.name, entry.layer.offset])),
      vanillaPhase
    };

    const soldierNamePools = await loadRulesetNamePools();
    return { merged, soldierNamePools };
  }

  private async loadExtraResources(gameId: GameId, parsed: ParsedRulesetBundle): Promise<LoadedRuleset> {
    const startingBase = parsed.merged.startingBase;
    if (!startingBase) {
      throw new Error("startingBase.rul missing startingBase block");
    }
    return {
      gameId,
      language: parsed.merged.language,
      countries: parsed.merged.countries.items,
      regions: parsed.merged.regions.items,
      startingBase,
      facilities: parsed.merged.facilities.items,
      crafts: parsed.merged.crafts.items,
      items: parsed.merged.items.items,
      research: parsed.merged.research.items,
      manufacture: parsed.merged.manufacture.items,
      soldiers: parsed.merged.soldiers.items,
      soldierNamePools: parsed.soldierNamePools,
      mergeMeta: {
        layerOrder: parsed.merged.layerOrder,
        layerOffsets: parsed.merged.layerOffsets,
        resourcePhases: {
          vanilla: parsed.merged.vanillaPhase,
          extra: {
            soldierNamePoolsLoaded: parsed.soldierNamePools.length
          }
        },
        tableIndexes: {
          countries: parsed.merged.countries.index,
          regions: parsed.merged.regions.index,
          facilities: parsed.merged.facilities.index,
          crafts: parsed.merged.crafts.index,
          items: parsed.merged.items.index,
          research: parsed.merged.research.index,
          manufacture: parsed.merged.manufacture.index,
          soldiers: parsed.merged.soldiers.index
        }
      }
    };
  }

  private async loadVanillaResources(gameId: GameId): Promise<ParsedRulesetBundle["merged"]["vanillaPhase"]> {
    const assetPack = gameId === "xcom1" ? "ufo" : "tftd";
    const fileChecks = await Promise.all([
      this.resourceExists(`/game-assets/${assetPack}/GEODATA/BACKPALS.DAT`),
      this.resourceExists(`/game-assets/${assetPack}/GEODATA/PALETTES.DAT`)
    ]);

    const files = {
      backpalsDat: fileChecks[0],
      palettesDat: fileChecks[1]
    };

    const manifestAvailable = await this.checkAssetManifest(assetPack);
    return { assetPack, manifestAvailable, files };
  }

  private async checkAssetManifest(assetPack: "ufo" | "tftd"): Promise<boolean> {
    try {
      const response = await fetch("/game-assets/manifest.json");
      if (!response.ok) {
        return false;
      }
      const manifest = (await response.json()) as { packs?: Array<{ name?: string; synced?: boolean }> };
      return manifest.packs?.some((pack) => pack.name === assetPack && pack.synced === true) ?? false;
    } catch {
      return false;
    }
  }

  private async resourceExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return true;
      if (response.status === 405 || response.status === 501) {
        const getResponse = await fetch(url);
        return getResponse.ok;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async resolveLayers(gameId: GameId): Promise<ModLayer[]> {
    const fallback: ModLayer[] = [{ name: "master", basePath: `/rulesets/${gameId}`, index: 0, size: 1, offset: 0 }];
    let manifest: ModLayerManifest | null = null;

    try {
      const response = await fetch(`/rulesets/${gameId}/mod-index.json`);
      if (response.ok) {
        manifest = (await response.json()) as ModLayerManifest;
      }
    } catch {
      manifest = null;
    }

    const declared = manifest?.layers?.filter((layer) => typeof layer.path === "string" && layer.path.trim() !== "") ?? [];
    if (declared.length === 0) {
      return fallback;
    }

    const normalized = declared.map((entry, i) => ({
      name: entry.name?.trim() || `layer${i}`,
      basePath: entry.path!.trim(),
      index: Number.isFinite(entry.index) ? Math.floor(entry.index ?? i) : i,
      size: Number.isFinite(entry.size) ? Math.max(1, Math.floor(entry.size ?? 1)) : 1
    }));

    normalized.sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
    let runningOffset = 0;
    return normalized.map((entry) => {
      const layer: ModLayer = { ...entry, offset: runningOffset * 1000 };
      runningOffset += entry.size;
      return layer;
    });
  }

  private mergeLanguage(layers: ParsedLayerDocs[]): Record<string, string> {
    const merged: Record<string, string> = {};
    for (const layer of layers) {
      Object.assign(merged, layer.docs.language);
    }
    return merged;
  }

  private pickStartingBase(
    layers: ParsedLayerDocs[]
  ): ReturnType<typeof parseRulesetRawDocuments>["starting"]["startingBase"] {
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const value = layers[i].docs.starting.startingBase;
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  private mergeRuleTable<T extends object>(
    layers: ParsedLayerDocs[],
    extract: (docs: ReturnType<typeof parseRulesetRawDocuments>) => T[] | undefined,
    keyFields: string[]
  ): { items: T[]; index: string[] } {
    const map = new Map<string, T>();
    const index: string[] = [];

    for (const layer of layers) {
      const entries = extract(layer.docs) ?? [];
      for (const rawEntry of entries) {
        const entry = rawEntry as unknown as Record<string, unknown>;
        const deleteKey = typeof entry.delete === "string" ? entry.delete : null;
        if (deleteKey) {
          map.delete(deleteKey);
          const deleteIndex = index.indexOf(deleteKey);
          if (deleteIndex >= 0) {
            index.splice(deleteIndex, 1);
          }
          continue;
        }

        const id = this.getRuleId(entry, keyFields);
        if (!id) {
          continue;
        }

        const sanitized = this.stripDelete(entry) as unknown as T;
        if (!map.has(id)) {
          index.push(id);
        }
        map.set(id, sanitized);
      }
    }

    return {
      items: index.map((id) => map.get(id)).filter((value): value is T => value !== undefined),
      index
    };
  }

  private getRuleId(entry: Record<string, unknown>, keyFields: string[]): string | null {
    for (const key of keyFields) {
      if (typeof entry[key] === "string" && (entry[key] as string).trim() !== "") {
        return (entry[key] as string).trim();
      }
    }
    if (typeof entry.type === "string" && entry.type.trim() !== "") return entry.type.trim();
    if (typeof entry.name === "string" && entry.name.trim() !== "") return entry.name.trim();
    return null;
  }

  private stripDelete(entry: Record<string, unknown>): Record<string, unknown> {
    const clone = { ...entry };
    delete clone.delete;
    return clone;
  }
}
