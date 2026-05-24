export const INT_MAX = 2147483647;

export type Element = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  color2: number;
  border: number;
  TFTDMode: boolean;
};

export type InterfaceDefinition = {
  type: string;
  palette?: string;
  parent?: string;
  music?: string;
  elements: Array<Partial<Element> & { id: string }>;
};

export class RuleInterface {
  private _palette = "";
  private _parent = "";
  private _music = "";
  private _elements = new Map<string, Element>();

  constructor(private _type: string) {}

  load(node: InterfaceDefinition): void {
    this._palette = node.palette ?? this._palette;
    this._parent = node.parent ?? this._parent;
    this._music = node.music ?? this._music;
    for (const source of node.elements || []) {
      const element: Element = {
        x: source.x ?? INT_MAX,
        y: source.y ?? INT_MAX,
        w: source.w ?? INT_MAX,
        h: source.h ?? INT_MAX,
        color: source.color ?? INT_MAX,
        color2: source.color2 ?? INT_MAX,
        border: source.border ?? INT_MAX,
        TFTDMode: source.TFTDMode ?? false
      };
      this._elements.set(source.id || "", element);
    }
  }

  getElement(id: string): Element | null {
    return this._elements.get(id) || null;
  }

  getPalette(): string {
    return this._palette;
  }

  getParent(): string {
    return this._parent;
  }

  getMusic(): string {
    return this._music;
  }

  getType(): string {
    return this._type;
  }
}

export function parseInterfacesRul(source: string): InterfaceDefinition[] {
  const definitions: InterfaceDefinition[] = [];
  let current: InterfaceDefinition | null = null;
  let inElements = false;
  let element: (Partial<Element> & { id: string }) | null = null;

  const stripComment = (line: string) => {
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
  };

  const setProp = (target: Record<string, unknown>, key: string, value: string) => {
    if (key === "pos" || key === "size") {
      const pair = parsePair(value);
      if (pair) {
        if (key === "pos") {
          target.x = pair[0];
          target.y = pair[1];
        } else {
          target.w = pair[0];
          target.h = pair[1];
        }
      }
      return;
    }
    if (key === "color" || key === "color2" || key === "border") {
      target[key] = Number(value);
      return;
    }
    if (key === "TFTDMode") {
      target[key] = value === "true";
      return;
    }
    target[key] = unquote(value);
  };

  for (const raw of source.split(/\r?\n/)) {
    const withoutComment = stripComment(raw);
    if (!withoutComment.trim() || withoutComment.trim() === "interfaces:") {
      continue;
    }
    const indent = withoutComment.search(/\S|$/);
    const trimmed = withoutComment.trim();

    const interfaceStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && interfaceStart) {
      current = { type: unquote(interfaceStart[1]), elements: [] };
      definitions.push(current);
      inElements = false;
      element = null;
      continue;
    }

    if (!current) {
      continue;
    }

    if (indent === 4 && trimmed === "elements:") {
      inElements = true;
      element = null;
      continue;
    }

    const elementStart = /^-\s+id:\s*(.*)$/.exec(trimmed);
    if (inElements && indent === 6 && elementStart) {
      element = { id: unquote(elementStart[1]) };
      current.elements.push(element);
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (!prop) {
      continue;
    }

    if (inElements && indent >= 8 && element) {
      setProp(element as Record<string, unknown>, prop[1], prop[2]);
    } else if (!inElements && indent === 4) {
      setProp(current as unknown as Record<string, unknown>, prop[1], prop[2]);
    }
  }
  return definitions;
}

function parsePair(value: string): [number, number] | null {
  const match = /^\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2])];
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
