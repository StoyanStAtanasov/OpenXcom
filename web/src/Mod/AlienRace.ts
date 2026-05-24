export enum AlienRank {
  AR_HUMAN = -1,
  AR_COMMANDER,
  AR_LEADER,
  AR_ENGINEER,
  AR_MEDIC,
  AR_NAVIGATOR,
  AR_SOLDIER,
  AR_TERRORIST,
  AR_TERRORIST2
}

export type AlienRaceDefinition = {
  id: string;
  members: string[];
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

export class AlienRace {
  private _members: string[] = [];

  constructor(private _id: string) {}

  load(node: AlienRaceDefinition): void {
    this._id = node.id || this._id;
    this._members = [...(node.members || [])];
  }

  getId(): string {
    return this._id;
  }

  getMember(id: number): string {
    return this._members[id] || "";
  }

  getMembers(): string[] {
    return this._members;
  }
}

export function parseAlienRacesRul(source: string): AlienRaceDefinition[] {
  const definitions: AlienRaceDefinition[] = [];
  let current: AlienRaceDefinition | null = null;
  let inMembers = false;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("alienRaces:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const start = /^-\s+id:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && start) {
      current = { id: unquote(start[1]), members: [] };
      definitions.push(current);
      inMembers = false;
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      inMembers = prop[1] === "members";
      continue;
    }

    if (inMembers && indent === 6) {
      const member = /^-\s+(.+)$/.exec(trimmed);
      if (member) {
        current.members.push(unquote(member[1]));
      }
    }
  }

  return definitions;
}
