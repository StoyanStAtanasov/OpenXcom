export type ResearchDefinition = {
  name: string;
  lookup?: string;
  cutscene?: string;
  cost?: number;
  points?: number;
  dependencies: string[];
  unlocks: string[];
  getOneFree: string[];
  requires: string[];
  needItem?: boolean;
  destroyItem?: boolean;
  listOrder?: number;
  unlockFinalMission?: boolean;
};

function stripComment(line: string): string {
  let quoted = false;
  let quote = "";
  for (let i = 0; i < line.length; ++i) {
    const ch = line[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || line[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
    }
    if (ch === "#" && !quoted) {
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

function parseBool(value: string): boolean {
  return value.trim() === "true";
}

function parseNumber(value: string): number | undefined {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : undefined;
}

function setResearchProp(target: ResearchDefinition, key: string, value: string): void {
  switch (key) {
    case "lookup":
    case "cutscene":
      target[key] = unquote(value);
      break;
    case "cost":
    case "points":
    case "listOrder": {
      const n = parseNumber(value);
      if (n != null) {
        target[key] = n;
      }
      break;
    }
    case "needItem":
    case "destroyItem":
    case "unlockFinalMission":
      target[key] = parseBool(value);
      break;
    default:
      break;
  }
}

export class RuleResearch {
  private _lookup = "";
  private _cutscene = "";
  private _cost = 0;
  private _points = 0;
  private _dependencies: string[] = [];
  private _unlocks: string[] = [];
  private _getOneFree: string[] = [];
  private _requires: string[] = [];
  private _needItem = false;
  private _destroyItem = false;
  private _listOrder = 0;

  constructor(private _name: string) {}

  load(node: ResearchDefinition, listOrder = 0): void {
    this._name = node.name || this._name;
    this._lookup = node.lookup ?? this._lookup;
    this._cutscene = node.cutscene ?? this._cutscene;
    this._cost = node.cost ?? this._cost;
    this._points = node.points ?? this._points;
    this._dependencies = [...(node.dependencies || [])];
    this._unlocks = [...(node.unlocks || [])];
    this._getOneFree = [...(node.getOneFree || [])];
    this._requires = [...(node.requires || [])];
    this._needItem = node.needItem ?? this._needItem;
    this._destroyItem = node.destroyItem ?? this._destroyItem;
    this._listOrder = node.listOrder ?? this._listOrder;
    if (!this._listOrder) {
      this._listOrder = listOrder;
    }
    if (this._requires.length > 0 && this._cost !== 0) {
      throw new Error(`Research topic ${this._name} has requirements, but the cost is not zero. Sorry, this is not allowed!`);
    }
  }

  getCost(): number {
    return this._cost;
  }

  getName(): string {
    return this._name;
  }

  getDependencies(): string[] {
    return this._dependencies;
  }

  needItem(): boolean {
    return this._needItem;
  }

  destroyItem(): boolean {
    return this._destroyItem;
  }

  getUnlocked(): string[] {
    return this._unlocks;
  }

  getPoints(): number {
    return this._points;
  }

  getGetOneFree(): string[] {
    return this._getOneFree;
  }

  getLookup(): string {
    return this._lookup;
  }

  getRequirements(): string[] {
    return this._requires;
  }

  getListOrder(): number {
    return this._listOrder;
  }

  getCutscene(): string {
    return this._cutscene;
  }
}

export function parseResearchRul(source: string): ResearchDefinition[] {
  const definitions: ResearchDefinition[] = [];
  let current: ResearchDefinition | null = null;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("research:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const researchStart = /^-\s+name:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && researchStart) {
      current = { name: unquote(researchStart[1]), dependencies: [], unlocks: [], getOneFree: [], requires: [] };
      definitions.push(current);
      section = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      section = ["dependencies", "unlocks", "getOneFree", "requires"].includes(prop[1]) ? prop[1] : "";
      setResearchProp(current, prop[1], prop[2]);
      continue;
    }

    const entry = /^-\s+(.+)$/.exec(trimmed);
    if (indent === 6 && entry && (section === "dependencies" || section === "unlocks" || section === "getOneFree" || section === "requires")) {
      current[section].push(unquote(entry[1]));
    }
  }

  return definitions;
}
