import { load } from "js-yaml";
import type {
  CountryRule,
  CraftRule,
  FacilityRule,
  ItemRule,
  LoadedRuleset,
  ManufactureRule,
  RegionRule,
  ResearchRule,
  SoldierNamePool,
  SoldierRule,
  GameId,
  StartingBaseRule
} from "./types";

interface CountriesDoc {
  countries?: CountryRule[];
}

interface RegionsDoc {
  regions?: RegionRule[];
}

interface StartingBaseDoc {
  startingBase?: StartingBaseRule;
}

interface FacilitiesDoc {
  facilities?: FacilityRule[];
}

interface CraftsDoc {
  crafts?: CraftRule[];
}

interface ItemsDoc {
  items?: ItemRule[];
}

interface SoldiersDoc {
  soldiers?: SoldierRule[];
}

interface ResearchDoc {
  research?: ResearchRule[];
}

interface ManufactureDoc {
  manufacture?: ManufactureRule[];
}

interface RulesetRawDocuments {
  countriesRaw: string;
  regionsRaw: string;
  startingRaw: string;
  facilitiesRaw: string;
  craftsRaw: string;
  itemsRaw: string;
  soldiersRaw: string;
  researchRaw: string;
  manufactureRaw: string;
  languageRaw: string;
}

interface ParsedRulesetDocuments {
  countries: CountriesDoc;
  regions: RegionsDoc;
  starting: StartingBaseDoc;
  facilities: FacilitiesDoc;
  crafts: CraftsDoc;
  items: ItemsDoc;
  soldiers: SoldiersDoc;
  research: ResearchDoc;
  manufacture: ManufactureDoc;
  language: Record<string, string>;
}

const NAME_FILES = [
  "American.nam",
  "Arabic.nam",
  "Argentina.nam",
  "Belgium.nam",
  "British.nam",
  "Bulgarian.nam",
  "Chinese.nam",
  "Congolese.nam",
  "Czech.nam",
  "Danish.nam",
  "Dutch.nam",
  "Ethiopian.nam",
  "Finnish.nam",
  "French.nam",
  "German.nam",
  "Greek.nam",
  "Hindi.nam",
  "Hungarian.nam",
  "Irish.nam",
  "Italian.nam",
  "Japanese.nam",
  "Kenyan.nam",
  "Korean.nam",
  "Nigerian.nam",
  "Norwegian.nam",
  "Polish.nam",
  "Polynesia.nam",
  "Portuguese.nam",
  "Romanian.nam",
  "Russian.nam",
  "Slovak.nam",
  "Spanish.nam",
  "Swedish.nam",
  "Turkish.nam"
];

const parseYaml = <T>(input: string): T => {
  const value = load(input);
  if (!value || typeof value !== "object") {
    throw new Error("YAML did not contain an object");
  }
  return value as T;
};

function parseLanguageMap(input: string): Record<string, string> {
  const parsed = parseYaml<Record<string, unknown>>(input);
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      mapped[key] = value;
    }
  }
  return mapped;
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path} (${response.status})`);
  }
  return response.text();
}

export async function loadRulesetRawDocumentsFromBasePath(basePath: string): Promise<RulesetRawDocuments> {
  const [countriesRaw, regionsRaw, startingRaw, facilitiesRaw, craftsRaw, itemsRaw, soldiersRaw, researchRaw, manufactureRaw, languageRaw] = await Promise.all([
    fetchText(`${basePath}/countries.rul`),
    fetchText(`${basePath}/regions.rul`),
    fetchText(`${basePath}/startingBase.rul`),
    fetchText(`${basePath}/facilities.rul`),
    fetchText(`${basePath}/crafts.rul`),
    fetchText(`${basePath}/items.rul`),
    fetchText(`${basePath}/soldiers.rul`),
    fetchText(`${basePath}/research.rul`),
    fetchText(`${basePath}/manufacture.rul`),
    fetchText(`${basePath}/en-US.yml`)
  ]);

  return {
    countriesRaw,
    regionsRaw,
    startingRaw,
    facilitiesRaw,
    craftsRaw,
    itemsRaw,
    soldiersRaw,
    researchRaw,
    manufactureRaw,
    languageRaw
  };
}

export async function loadRulesetRawDocuments(gameId: GameId): Promise<RulesetRawDocuments> {
  return loadRulesetRawDocumentsFromBasePath(`/rulesets/${gameId}`);
}

export function parseRulesetRawDocuments(raw: RulesetRawDocuments): ParsedRulesetDocuments {
  return {
    countries: parseYaml<CountriesDoc>(raw.countriesRaw),
    regions: parseYaml<RegionsDoc>(raw.regionsRaw),
    starting: parseYaml<StartingBaseDoc>(raw.startingRaw),
    facilities: parseYaml<FacilitiesDoc>(raw.facilitiesRaw),
    crafts: parseYaml<CraftsDoc>(raw.craftsRaw),
    items: parseYaml<ItemsDoc>(raw.itemsRaw),
    soldiers: parseYaml<SoldiersDoc>(raw.soldiersRaw),
    research: parseYaml<ResearchDoc>(raw.researchRaw),
    manufacture: parseYaml<ManufactureDoc>(raw.manufactureRaw),
    language: parseLanguageMap(raw.languageRaw)
  };
}

export async function loadRulesetNamePools(): Promise<SoldierNamePool[]> {
  const soldierNamePoolsLoaded = await Promise.all(
    NAME_FILES.map(async (name): Promise<SoldierNamePool | null> => {
      try {
        const raw = await fetchText(`/rulesets/common/SoldierName/${name}`);
        return parseYaml<SoldierNamePool>(raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[ruleset] Skipping invalid soldier name pool ${name}: ${message}`);
        return null;
      }
    })
  );
  return soldierNamePoolsLoaded.filter((pool): pool is SoldierNamePool => pool !== null);
}

export async function loadRuleset(gameId: GameId): Promise<LoadedRuleset> {
  const raw = await loadRulesetRawDocuments(gameId);
  const docs = parseRulesetRawDocuments(raw);
  const soldierNamePools = await loadRulesetNamePools();

  const countries = docs.countries.countries ?? [];
  const regions = docs.regions.regions ?? [];
  const startingBase = docs.starting.startingBase;
  if (!startingBase) {
    throw new Error("startingBase.rul missing startingBase block");
  }

  return {
    gameId,
    language: docs.language,
    countries,
    regions,
    startingBase,
    facilities: docs.facilities.facilities ?? [],
    crafts: docs.crafts.crafts ?? [],
    items: docs.items.items ?? [],
    research: docs.research.research ?? [],
    manufacture: docs.manufacture.manufacture ?? [],
    soldiers: docs.soldiers.soldiers ?? [],
    soldierNamePools
  };
}

export async function loadXcom1Ruleset(): Promise<LoadedRuleset> {
  return loadRuleset("xcom1");
}

export async function loadXcom2Ruleset(): Promise<LoadedRuleset> {
  return loadRuleset("xcom2");
}

export function translate(language: Record<string, string>, id: string): string {
  return language[id] ?? id;
}
