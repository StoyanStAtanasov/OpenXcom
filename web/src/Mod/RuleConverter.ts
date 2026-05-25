type ConverterListKey =
  | "markers"
  | "countries"
  | "regions"
  | "facilities"
  | "items"
  | "crews"
  | "crafts"
  | "ufos"
  | "craftWeapons"
  | "missions"
  | "armor"
  | "alienRaces"
  | "alienRanks"
  | "research"
  | "manufacture"
  | "ufopaedia";

export type ConverterDefinition = Partial<Record<ConverterListKey, string[]>> & {
  offsets?: Record<string, number>;
};

const converterListKeys = new Set<ConverterListKey>([
  "markers",
  "countries",
  "regions",
  "facilities",
  "items",
  "crews",
  "crafts",
  "ufos",
  "craftWeapons",
  "missions",
  "armor",
  "alienRaces",
  "alienRanks",
  "research",
  "manufacture",
  "ufopaedia"
]);

function stripComment(line: string): string {
  let quoted = false;
  for (let i = 0; i < line.length; ++i) {
    const ch = line[i];
    if (ch === "\"") {
      quoted = !quoted;
    } else if (ch === "#" && !quoted) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseNumber(value: string): number | undefined {
  const parsed = Number(unquote(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function stringList(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter(entry => typeof entry === "string") : [...fallback];
}

export function parseConverterRul(source: string): ConverterDefinition {
  const definition: ConverterDefinition = { offsets: {} };
  let inConverter = false;
  let section: "offsets" | ConverterListKey | "" = "";

  for (const rawLine of source.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) {
      continue;
    }
    if (line === "converter:") {
      inConverter = true;
      section = "";
      continue;
    }
    if (!inConverter) {
      continue;
    }

    const sectionMatch = /^([A-Za-z0-9_]+):\s*$/.exec(line);
    if (sectionMatch) {
      const key = sectionMatch[1];
      if (key === "offsets") {
        section = "offsets";
        definition.offsets ||= {};
      } else if (converterListKeys.has(key as ConverterListKey)) {
        section = key as ConverterListKey;
        definition[section] = [];
      } else {
        section = "";
      }
      continue;
    }

    if (section === "offsets") {
      const offsetMatch = /^([A-Za-z0-9_.]+):\s*(.+)$/.exec(line);
      if (!offsetMatch) {
        continue;
      }
      const offset = parseNumber(offsetMatch[2]);
      if (offset !== undefined) {
        definition.offsets![offsetMatch[1]] = offset;
      }
      continue;
    }

    if (section && line.startsWith("-")) {
      definition[section as ConverterListKey]?.push(unquote(line.slice(1)));
    }
  }
  return definition;
}

export class RuleConverter {
  private _offsets = new Map<string, number>();
  private _markers: string[] = [];
  private _countries: string[] = [];
  private _regions: string[] = [];
  private _facilities: string[] = [];
  private _items: string[] = [];
  private _crews: string[] = [];
  private _crafts: string[] = [];
  private _ufos: string[] = [];
  private _craftWeapons: string[] = [];
  private _missions: string[] = [];
  private _armor: string[] = [];
  private _alienRaces: string[] = [];
  private _alienRanks: string[] = [];
  private _research: string[] = [];
  private _manufacture: string[] = [];
  private _ufopaedia: string[] = [];

  load(node: ConverterDefinition): void {
    this._offsets = new Map(Object.entries(node.offsets || {}).map(([key, value]) => [key, Math.trunc(value)]));
    this._markers = stringList(node.markers, this._markers);
    this._countries = stringList(node.countries, this._countries);
    this._regions = stringList(node.regions, this._regions);
    this._facilities = stringList(node.facilities, this._facilities);
    this._items = stringList(node.items, this._items);
    this._crews = stringList(node.crews, this._crews);
    this._crafts = stringList(node.crafts, this._crafts);
    this._ufos = stringList(node.ufos, this._ufos);
    this._craftWeapons = stringList(node.craftWeapons, this._craftWeapons);
    this._missions = stringList(node.missions, this._missions);
    this._armor = stringList(node.armor, this._armor);
    this._alienRaces = stringList(node.alienRaces, this._alienRaces);
    this._alienRanks = stringList(node.alienRanks, this._alienRanks);
    this._research = stringList(node.research, this._research);
    this._manufacture = stringList(node.manufacture, this._manufacture);
    this._ufopaedia = stringList(node.ufopaedia, this._ufopaedia);
  }

  getOffset(id: string): number { return this._offsets.get(id) || 0; }
  getMarkers(): string[] { return this._markers; }
  getCountries(): string[] { return this._countries; }
  getRegions(): string[] { return this._regions; }
  getFacilities(): string[] { return this._facilities; }
  getItems(): string[] { return this._items; }
  getCrews(): string[] { return this._crews; }
  getCrafts(): string[] { return this._crafts; }
  getUfos(): string[] { return this._ufos; }
  getCraftWeapons(): string[] { return this._craftWeapons; }
  getMissions(): string[] { return this._missions; }
  getArmor(): string[] { return this._armor; }
  getAlienRaces(): string[] { return this._alienRaces; }
  getAlienRanks(): string[] { return this._alienRanks; }
  getResearch(): string[] { return this._research; }
  getManufacture(): string[] { return this._manufacture; }
  getUfopaedia(): string[] { return this._ufopaedia; }
}
