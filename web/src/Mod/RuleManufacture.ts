export type ManufactureDefinition = {
  name: string;
  category?: string;
  requires: string[];
  space?: number;
  time?: number;
  cost?: number;
  requiredItems: Record<string, number>;
  producedItems?: Record<string, number>;
  listOrder?: number;
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

function parseNumber(value: string): number | undefined {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : undefined;
}

function setManufactureProp(target: ManufactureDefinition, key: string, value: string): void {
  switch (key) {
    case "category":
      target.category = unquote(value);
      break;
    case "space":
    case "time":
    case "cost":
    case "listOrder": {
      const n = parseNumber(value);
      if (n != null) {
        target[key] = n;
      }
      break;
    }
    default:
      break;
  }
}

export class RuleManufacture {
  private _category = "";
  private _requires: string[] = [];
  private _space = 0;
  private _time = 0;
  private _cost = 0;
  private _requiredItems = new Map<string, number>();
  private _producedItems = new Map<string, number>();
  private _listOrder = 0;

  constructor(private _name: string) {
    this._producedItems.set(_name, 1);
  }

  load(node: ManufactureDefinition, listOrder = 0): void {
    const same = this._producedItems.size === 1 && this._producedItems.has(this._name);
    const oldValue = this._producedItems.get(this._name) || 1;
    this._name = node.name || this._name;
    if (same) {
      this._producedItems.clear();
      this._producedItems.set(this._name, oldValue);
    }
    this._category = node.category ?? this._category;
    this._requires = [...(node.requires || [])];
    this._space = node.space ?? this._space;
    this._time = node.time ?? this._time;
    this._cost = node.cost ?? this._cost;
    this._requiredItems = new Map(Object.entries(node.requiredItems || {}));
    if (node.producedItems) {
      this._producedItems = new Map(Object.entries(node.producedItems));
    }
    this._listOrder = node.listOrder ?? this._listOrder;
    if (!this._listOrder) {
      this._listOrder = listOrder;
    }
  }

  getName(): string {
    return this._name;
  }

  getCategory(): string {
    return this._category;
  }

  getRequirements(): string[] {
    return this._requires;
  }

  getRequiredSpace(): number {
    return this._space;
  }

  getManufactureTime(): number {
    return this._time;
  }

  getManufactureCost(): number {
    return this._cost;
  }

  haveEnoughMoneyForOneMoreUnit(funds: number): boolean {
    return funds >= this._cost || this._cost <= 0;
  }

  getRequiredItems(): Map<string, number> {
    return this._requiredItems;
  }

  getProducedItems(): Map<string, number> {
    return this._producedItems;
  }

  getListOrder(): number {
    return this._listOrder;
  }
}

export function parseManufactureRul(source: string): ManufactureDefinition[] {
  const definitions: ManufactureDefinition[] = [];
  let current: ManufactureDefinition | null = null;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("manufacture:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const manufactureStart = /^-\s+name:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && manufactureStart) {
      current = { name: unquote(manufactureStart[1]), requires: [], requiredItems: {} };
      definitions.push(current);
      section = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      section = ["requires", "requiredItems", "producedItems"].includes(prop[1]) ? prop[1] : "";
      if (prop[1] === "producedItems" && !current.producedItems) {
        current.producedItems = {};
      }
      setManufactureProp(current, prop[1], prop[2]);
      continue;
    }

    const entry = /^-\s+(.+)$/.exec(trimmed);
    if (indent === 6 && entry && section === "requires") {
      current.requires.push(unquote(entry[1]));
      continue;
    }

    const item = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 6 && item && (section === "requiredItems" || section === "producedItems")) {
      const n = parseNumber(item[2]);
      if (n != null) {
        if (section === "requiredItems") {
          current.requiredItems[unquote(item[1])] = n;
        } else {
          current.producedItems![unquote(item[1])] = n;
        }
      }
    }
  }

  return definitions;
}
