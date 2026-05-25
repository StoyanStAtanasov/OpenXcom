import type { Mod } from "../Mod/Mod.ts";
import { WeightedOptions } from "./WeightedOptions.ts";

export type AlienStrategySave = {
  regions?: Record<string, number>;
  possibleMissions?: Array<{ region?: string; missions?: Record<string, number> }>;
  missionLocations?: Record<string, Array<[string, number]>>;
  missionsRun?: Record<string, number>;
};

/**
 * Stores the information about alien strategy.
 */
export class AlienStrategy {
  private _regionChances = new WeightedOptions();
  private _regionMissions = new Map<string, WeightedOptions>();
  private _missionRuns = new Map<string, number>();
  private _missionLocations = new Map<string, Array<[string, number]>>();

  init(mod: Mod): void {
    for (const regionName of mod.getRegionsList()) {
      const region = mod.getRegion(regionName);
      if (!region) {
        continue;
      }
      this._regionChances.set(regionName, region.getWeight());
      const missions = new WeightedOptions();
      missions.load(region.getAvailableMissions().save());
      this._regionMissions.set(regionName, missions);
    }
  }

  load(node: AlienStrategySave): void {
    this._regionMissions.clear();
    this._regionChances.clear();
    this._regionChances.load(node.regions || {});
    for (const entry of node.possibleMissions || []) {
      if (!entry.region) {
        continue;
      }
      const options = new WeightedOptions();
      options.load(entry.missions || {});
      this._regionMissions.set(entry.region, options);
    }
    this._missionLocations = new Map(Object.entries(node.missionLocations || {}));
    this._missionRuns = new Map(Object.entries(node.missionsRun || {}));
  }

  save(): AlienStrategySave {
    return {
      regions: this._regionChances.save(),
      possibleMissions: [...this._regionMissions.entries()].map(([region, missions]) => ({ region, missions: missions.save() })),
      missionLocations: Object.fromEntries(this._missionLocations),
      missionsRun: Object.fromEntries(this._missionRuns)
    };
  }

  chooseRandomRegion(mod: Mod): string {
    let chosen = this._regionChances.choose();
    if (!chosen) {
      this._regionMissions.clear();
      this.init(mod);
      chosen = this._regionChances.choose();
    }
    return chosen;
  }

  chooseRandomMission(region: string): string {
    const found = this._regionMissions.get(region);
    if (!found) {
      return "";
    }
    return found.choose();
  }

  removeMission(region: string, mission: string): boolean {
    const found = this._regionMissions.get(region);
    if (found) {
      found.set(mission, 0);
      if (found.empty()) {
        this._regionMissions.delete(region);
        this._regionChances.set(region, 0);
      }
    }
    return this._regionMissions.size === 0;
  }

  getMissionsRun(varName: string): number {
    return this._missionRuns.get(varName) || 0;
  }

  addMissionRun(varName: string, increment = 1): void {
    if (!varName) {
      return;
    }
    this._missionRuns.set(varName, (this._missionRuns.get(varName) || 0) + increment);
  }

  addMissionLocation(varName: string, regionName: string, zoneNumber: number, maximum: number): void {
    if (maximum <= 0) {
      return;
    }
    const locations = this._missionLocations.get(varName) || [];
    locations.push([regionName, zoneNumber]);
    while (locations.length > maximum) {
      locations.shift();
    }
    this._missionLocations.set(varName, locations);
  }

  validMissionLocation(varName: string, regionName: string, zoneNumber: number): boolean {
    for (const [region, zone] of this._missionLocations.get(varName) || []) {
      if (region === regionName && zone === zoneNumber) {
        return false;
      }
    }
    return true;
  }

  validMissionRegion(regionName: string): boolean {
    return this._regionMissions.has(regionName);
  }
}
