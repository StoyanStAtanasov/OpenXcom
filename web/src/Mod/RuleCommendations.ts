export type KillCriteria = Array<Array<[number, string[]]>>;

export type RuleCommendationsNode = {
  type?: string;
  description?: string;
  criteria?: Record<string, number[]> | Map<string, number[]>;
  sprite?: number;
  killCriteria?: KillCriteria;
};

export class RuleCommendations {
  private _criteria = new Map<string, number[]>();
  private _killCriteria: KillCriteria = [];
  private _description = "";
  private _sprite = 0;

  load(node: RuleCommendationsNode): void {
    this._description = node.description ?? this._description;
    if (node.criteria instanceof Map) {
      this._criteria = sortedStringMap(node.criteria);
    } else if (node.criteria) {
      this._criteria = sortedStringMap(new Map(Object.entries(node.criteria)));
    }
    this._sprite = node.sprite ?? this._sprite;
    this._killCriteria = node.killCriteria ?? this._killCriteria;
  }

  getDescription(): string { return this._description; }
  getCriteria(): Map<string, number[]> { return this._criteria; }
  getKillCriteria(): KillCriteria { return this._killCriteria; }
  getSprite(): number { return this._sprite; }
}

function sortedStringMap<T>(map: Map<string, T>): Map<string, T> {
  return new Map([...map.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
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

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let quote = "";
  let start = 0;
  for (let i = 0; i < value.length; ++i) {
    const ch = value[i];
    if ((ch === "\"" || ch === "'") && (i === 0 || value[i - 1] !== "\\")) {
      if (!quoted) {
        quoted = true;
        quote = ch;
      } else if (quote === ch) {
        quoted = false;
      }
      continue;
    }
    if (quoted) {
      continue;
    }
    if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
    } else if (ch === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(part => part.length > 0);
}

function parseInlineListValue(value: string): unknown[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inside = trimmed.slice(1, -1).trim();
  if (!inside) {
    return [];
  }
  return splitTopLevel(inside).map(part => {
    const nested = parseInlineListValue(part);
    if (nested) {
      return nested;
    }
    const number = parseNumber(part);
    return number == null ? unquote(part) : number;
  });
}

function parseNumberList(value: string): number[] | null {
  const parsed = parseInlineListValue(value);
  if (!parsed) {
    return null;
  }
  const numbers = parsed
    .map(item => typeof item === "number" ? Math.trunc(item) : Number.NaN)
    .filter(Number.isFinite);
  return numbers.length === parsed.length ? numbers : null;
}

function isPair(value: unknown): value is [number, string[]] {
  return Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Array.isArray(value[1]) &&
    value[1].every(item => typeof item === "string" || typeof item === "number");
}

function toPair(value: unknown): [number, string[]] | null {
  if (!isPair(value)) {
    return null;
  }
  return [Math.trunc(value[0]), value[1].map(item => String(item))];
}

function normalizeKillCriteriaValue(value: unknown): KillCriteria {
  const pair = toPair(value);
  if (pair) {
    return [[pair]];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const pairs = value.map(toPair);
  if (pairs.every(item => item !== null)) {
    return [pairs as Array<[number, string[]]>];
  }
  const blocks: KillCriteria = [];
  for (const block of value) {
    if (!Array.isArray(block)) {
      continue;
    }
    const blockPairs = block.map(toPair).filter((item): item is [number, string[]] => item !== null);
    if (blockPairs.length > 0) {
      blocks.push(blockPairs);
    }
  }
  return blocks;
}

function parseKillCriteriaBlock(lines: string[]): KillCriteria {
  const result: KillCriteria = [];
  let current: Array<[number, string[]]> | null = null;

  const flush = (): void => {
    if (current && current.length > 0) {
      result.push(current);
    }
    current = null;
  };

  for (const raw of lines) {
    const indent = raw.search(/\S|$/);
    let trimmed = raw.trim();
    if (!trimmed.startsWith("-")) {
      continue;
    }
    let payload = trimmed.replace(/^-\s*/, "").trim();
    if (!payload) {
      flush();
      current = [];
      continue;
    }
    while (payload.startsWith("- ")) {
      payload = payload.slice(2).trim();
    }
    const parsed = parseInlineListValue(payload);
    const normalized = parsed ? normalizeKillCriteriaValue(parsed) : [];
    if (normalized.length === 0) {
      continue;
    }
    if (indent <= 6 || current === null) {
      flush();
      if (normalized.length === 1) {
        current = [...normalized[0]];
      } else {
        for (const block of normalized) {
          result.push(block);
        }
        current = null;
      }
    } else {
      current.push(...normalized.flat());
    }
  }
  flush();
  return result;
}

function parseCommendationBlock(lines: string[]): RuleCommendationsNode | null {
  const definition: RuleCommendationsNode = { criteria: {} };
  const killCriteriaLines: string[] = [];
  let section = "";
  let currentCriteria = "";

  for (const raw of lines) {
    const indent = raw.search(/\S|$/);
    const trimmed = raw.trim();
    const itemProp = /^-\s*(?:([A-Za-z0-9_]+):\s*(.*))?$/.exec(trimmed);
    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    const key = itemProp?.[1] || prop?.[1] || "";
    const value = itemProp?.[2] ?? prop?.[2] ?? "";

    if ((indent === 2 && itemProp?.[1]) || (indent === 4 && prop)) {
      if (key !== "killCriteria") {
        section = "";
      }
      switch (key) {
        case "type":
          definition.type = unquote(value);
          break;
        case "description":
          definition.description = unquote(value);
          break;
        case "sprite": {
          const sprite = parseNumber(value);
          if (sprite != null) {
            definition.sprite = Math.trunc(sprite);
          }
          break;
        }
        case "criteria": {
          section = "criteria";
          const inline = parseInlineListValue(value);
          if (inline && inline.length > 0) {
            // OpenXcom rules normally use a mapping block. Inline maps are not
            // common, so this only keeps already-parsed block criteria intact.
            definition.criteria ??= {};
          }
          break;
        }
        case "killCriteria": {
          section = "killCriteria";
          const parsed = parseInlineListValue(value);
          if (parsed) {
            definition.killCriteria = normalizeKillCriteriaValue(parsed);
          }
          break;
        }
        default:
          break;
      }
      continue;
    }

    if (section === "criteria") {
      const criteriaProp = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
      if (indent === 6 && criteriaProp) {
        currentCriteria = criteriaProp[1];
        const values = parseNumberList(criteriaProp[2]);
        if (values) {
          (definition.criteria as Record<string, number[]>)[currentCriteria] = values;
        }
        continue;
      }
      const criteriaEntry = /^-\s+(.+)$/.exec(trimmed);
      if (indent === 8 && criteriaEntry && currentCriteria) {
        const valueNumber = parseNumber(criteriaEntry[1]);
        if (valueNumber != null) {
          ((definition.criteria as Record<string, number[]>)[currentCriteria] ??= []).push(Math.trunc(valueNumber));
        }
      }
    } else if (section === "killCriteria" && indent >= 6) {
      killCriteriaLines.push(raw);
    }
  }

  if (killCriteriaLines.length > 0) {
    definition.killCriteria = parseKillCriteriaBlock(killCriteriaLines);
  }
  return definition.type ? definition : null;
}

export function parseCommendationsRul(source: string): RuleCommendationsNode[] {
  const definitions: RuleCommendationsNode[] = [];
  let inCommendations = false;
  let block: string[] = [];

  const flush = (): void => {
    if (block.length > 0) {
      const definition = parseCommendationBlock(block);
      if (definition) {
        definitions.push(definition);
      }
      block = [];
    }
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const indent = line.search(/\S|$/);
    if (indent === 0) {
      if (trimmed === "commendations:") {
        flush();
        inCommendations = true;
        continue;
      }
      if (inCommendations) {
        flush();
        inCommendations = false;
      }
    }
    if (!inCommendations) {
      continue;
    }
    if (indent === 2 && trimmed.startsWith("-")) {
      flush();
      block = [line];
    } else if (block.length > 0) {
      block.push(line);
    }
  }
  flush();
  return definitions;
}
