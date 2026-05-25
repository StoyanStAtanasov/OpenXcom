import { RNG } from "../Engine/RNG.ts";
import type { Target } from "../Savegame/Target.ts";

export type TerrainCriteriaDefinition = {
  name?: string;
  weight?: number;
  area?: [number, number, number, number] | number[];
};

export type TextureDefinition = {
  id?: number;
  deployments?: Record<string, number> | Map<string, number>;
  terrain?: TerrainCriteriaDefinition[];
};

export class TerrainCriteria {
  name = "";
  weight = 1;
  lonMin = 0.0;
  lonMax = deg2Rad(360.0);
  latMin = deg2Rad(-90.0);
  latMax = deg2Rad(90.0);

  load(node: TerrainCriteriaDefinition): void {
    this.name = node.name ?? this.name;
    this.weight = node.weight ?? this.weight;
    if (node.area && node.area.length >= 4) {
      this.lonMin = deg2Rad(node.area[0]);
      this.lonMax = deg2Rad(node.area[1]);
      this.latMin = deg2Rad(node.area[2]);
      this.latMax = deg2Rad(node.area[3]);
    }
  }
}

/**
 * Represents the relations between a Geoscape texture and the corresponding Battlescape mission attributes.
 */
export class Texture {
  private _deployments = new Map<string, number>();
  private _terrain: TerrainCriteria[] = [];

  constructor(private _id: number) {}

  load(node: TextureDefinition): void {
    this._id = node.id ?? this._id;
    if (node.deployments) {
      this._deployments = node.deployments instanceof Map
        ? new Map(node.deployments)
        : new Map(Object.entries(node.deployments));
    }
    if (node.terrain) {
      this._terrain = node.terrain.map(entry => {
        const terrain = new TerrainCriteria();
        terrain.load(entry);
        return terrain;
      });
    }
  }

  getId(): number {
    return this._id;
  }

  getTerrain(): TerrainCriteria[] {
    return this._terrain;
  }

  getRandomTerrain(target: Target): string {
    let totalWeight = 0;
    const possibilities = new Map<number, string>();
    for (const terrain of this._terrain) {
      if (
        terrain.weight > 0 &&
        target.getLongitude() >= terrain.lonMin &&
        target.getLongitude() < terrain.lonMax &&
        target.getLatitude() >= terrain.latMin &&
        target.getLatitude() < terrain.latMax
      ) {
        totalWeight += terrain.weight;
        possibilities.set(totalWeight, terrain.name);
      }
    }
    if (totalWeight > 0) {
      const pick = RNG.generate(1, totalWeight);
      for (const [weight, name] of possibilities) {
        if (pick <= weight) {
          return name;
        }
      }
    }
    return "";
  }

  getDeployments(): Map<string, number> {
    return this._deployments;
  }

  getRandomDeployment(): string {
    if (this._deployments.size === 0) {
      return "";
    }
    if (this._deployments.size === 1) {
      return this._deployments.keys().next().value || "";
    }
    let totalWeight = 0;
    for (const weight of this._deployments.values()) {
      totalWeight += weight;
    }
    if (totalWeight >= 1) {
      let pick = RNG.generate(1, totalWeight);
      for (const [deployment, weight] of this._deployments) {
        if (pick <= weight) {
          return deployment;
        }
        pick -= weight;
      }
    }
    return "";
  }
}

function deg2Rad(value: number): number {
  return value * Math.PI / 180.0;
}
