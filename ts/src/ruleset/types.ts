export type GameId = "xcom1" | "xcom2";

export interface CountryRule {
  type: string;
  fundingBase: number;
  fundingCap: number;
}

export interface RegionRule {
  type: string;
  cost: number;
  regionWeight: number;
}

export interface StartingFacilityRule {
  type: string;
  x: number;
  y: number;
}

export interface StartingCraftWeaponRule {
  type: string;
  ammo: number;
}

export interface StartingCraftRule {
  type: string;
  id: number;
  fuel: number;
  damage: number;
  status?: string;
  weapons?: StartingCraftWeaponRule[];
  items?: Record<string, number>;
}

export interface StartingBaseRule {
  facilities: StartingFacilityRule[];
  randomSoldiers: number;
  crafts: StartingCraftRule[];
  items?: Record<string, number>;
  scientists: number;
  engineers: number;
}

export interface FacilityRule {
  type: string;
  size?: number;
  buildCost?: number;
  monthlyCost?: number;
  personnel?: number;
  labs?: number;
  workshops?: number;
  storage?: number;
  crafts?: number;
  aliens?: number;
}

export interface CraftRule {
  type: string;
  soldiers?: number;
  vehicles?: number;
  weapons?: number;
  speedMax?: number;
  fuelMax?: number;
  damageMax?: number;
}

export interface ItemRule {
  type: string;
  costBuy?: number;
  costSell?: number;
  size?: number;
}

export interface ResearchRule {
  name: string;
  cost: number;
  points: number;
  needItem?: boolean;
  requires?: string[];
  dependencies?: string[];
}

export interface ManufactureRule {
  name: string;
  category: string;
  requires?: string[];
  space: number;
  time: number;
  cost: number;
  requiredItems?: Record<string, number>;
}

export interface SoldierStatsRule {
  tu: number;
  stamina: number;
  health: number;
  bravery: number;
  reactions: number;
  firing: number;
  throwing: number;
  strength: number;
}

export interface SoldierRule {
  type: string;
  femaleFrequency?: number;
  costBuy?: number;
  costSalary?: number;
  minStats: SoldierStatsRule;
  maxStats: SoldierStatsRule;
  soldierNames?: string[];
}

export interface SoldierNamePool {
  maleFirst?: string[];
  femaleFirst?: string[];
  maleLast?: string[];
  femaleLast?: string[];
}

export interface LoadedRuleset {
  gameId: GameId;
  language: Record<string, string>;
  countries: CountryRule[];
  regions: RegionRule[];
  startingBase: StartingBaseRule;
  facilities: FacilityRule[];
  crafts: CraftRule[];
  items: ItemRule[];
  research: ResearchRule[];
  manufacture: ManufactureRule[];
  soldiers: SoldierRule[];
  soldierNamePools: SoldierNamePool[];
  mergeMeta?: {
    layerOrder: string[];
    layerOffsets: Record<string, number>;
    resourcePhases?: {
      vanilla: {
        assetPack: "ufo" | "tftd";
        manifestAvailable: boolean;
        files?: {
          backpalsDat: boolean;
          palettesDat: boolean;
        };
      };
      extra: {
        soldierNamePoolsLoaded: number;
      };
    };
    tableIndexes: {
      countries: string[];
      regions: string[];
      facilities: string[];
      crafts: string[];
      items: string[];
      research: string[];
      manufacture: string[];
      soldiers: string[];
    };
  };
}
