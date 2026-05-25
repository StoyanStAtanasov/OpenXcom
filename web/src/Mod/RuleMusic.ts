export type RuleMusicNode = {
  type: string;
  name?: string;
  catPos?: number;
  normalization?: number;
};

export class RuleMusic {
  private _name = "";
  private _catPos = Number.MAX_SAFE_INTEGER;
  private _normalization = 0.76;

  constructor(private _type: string) {}

  load(node: RuleMusicNode): void {
    this._name = node.name ?? this._name;
    this._catPos = node.catPos ?? this._catPos;
    this._normalization = node.normalization ?? this._normalization;
  }

  getType(): string {
    return this._type;
  }

  getName(): string {
    if (!this._name) {
      return this._type;
    }
    return this._name;
  }

  getCatPos(): number {
    return this._catPos;
  }

  getNormalization(): number {
    return this._normalization;
  }
}

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

function setMusicProp(target: RuleMusicNode, key: string, value: string): void {
  switch (key) {
    case "type":
      target.type = unquote(value);
      break;
    case "name":
      target.name = unquote(value);
      break;
    case "catPos":
    case "normalization": {
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

export function parseMusicRul(source: string): RuleMusicNode[] {
  const definitions: RuleMusicNode[] = [];
  let inMusics = false;
  let current: RuleMusicNode | null = null;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw).trim();
    if (!line) {
      continue;
    }
    if (line === "musics:") {
      inMusics = true;
      continue;
    }
    if (!inMusics) {
      continue;
    }

    const item = /^-\s*(?:(\w+):\s*(.*))?$/.exec(line);
    if (item) {
      current = { type: "" };
      definitions.push(current);
      if (item[1]) {
        setMusicProp(current, item[1], item[2] ?? "");
      }
      continue;
    }

    if (!current) {
      continue;
    }
    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (prop) {
      setMusicProp(current, prop[1], prop[2]);
    }
  }

  return definitions.filter(definition => definition.type);
}
