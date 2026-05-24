import { RNG } from "../Engine/RNG.ts";
import { MapBlockType, type MapBlock } from "./MapBlock.ts";
import type { RuleTerrain } from "./RuleTerrain.ts";

export enum MapDirection {
  MD_NONE,
  MD_VERTICAL,
  MD_HORIZONTAL,
  MD_BOTH
}

export enum MapScriptCommand {
  MSC_UNDEFINED = -1,
  MSC_ADDBLOCK,
  MSC_ADDLINE,
  MSC_ADDCRAFT,
  MSC_ADDUFO,
  MSC_DIGTUNNEL,
  MSC_FILLAREA,
  MSC_CHECKBLOCK,
  MSC_REMOVE,
  MSC_RESIZE
}

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MCDReplacement = {
  set: number;
  entry: number;
};

export type TunnelDataDefinition = {
  level?: number;
  MCDReplacements?: Array<{ type: string } & Partial<MCDReplacement>>;
};

export type MapScriptCommandDefinition = {
  type: string;
  rects?: Rect[];
  tunnelData?: TunnelDataDefinition;
  conditionals?: number[];
  size?: number | number[];
  groups?: number[];
  blocks?: number[];
  freqs?: number[];
  maxUses?: number[];
  direction?: string;
  executionChances?: number;
  executions?: number;
  UFOName?: string;
  label?: number;
};

export type MapScriptsDefinition = {
  type: string;
  delete?: string;
  commands: MapScriptCommandDefinition[];
};

export class TunnelData {
  replacements = new Map<string, MCDReplacement>();
  level = 0;

  getMCDReplacement(type: string): MCDReplacement | null {
    return this.replacements.get(type) || null;
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

function parseNumberList(value: string): number[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }
  const inside = trimmed.slice(1, -1).trim();
  if (!inside) {
    return [];
  }
  const numbers = inside.split(",").map(part => parseNumber(part));
  return numbers.every(number => number != null) ? numbers as number[] : null;
}

function parseNumberVector(value: string): number[] | null {
  const list = parseNumberList(value);
  if (list) {
    return list;
  }
  const n = parseNumber(value);
  return n == null ? null : [n];
}

function parseRect(value: string): Rect | null {
  const list = parseNumberList(value);
  if (!list || list.length < 4) {
    return null;
  }
  return { x: list[0], y: list[1], w: list[2], h: list[3] };
}

function setCommandProp(target: MapScriptCommandDefinition, key: string, value: string): string {
  if (key === "rects") {
    target.rects ||= [];
    return "rects";
  }
  if (key === "tunnelData") {
    target.tunnelData ||= {};
    return "tunnelData";
  }
  if (key === "conditionals" || key === "groups" || key === "blocks" || key === "freqs" || key === "maxUses") {
    const list = parseNumberVector(value);
    if (list) {
      (target as Record<string, unknown>)[key] = list;
    }
    return "";
  }
  if (key === "size") {
    const list = parseNumberList(value);
    if (list) {
      target.size = list;
    } else {
      const n = parseNumber(value);
      if (n != null) {
        target.size = n;
      }
    }
    return "";
  }
  if (key === "executionChances" || key === "executions" || key === "label") {
    const n = parseNumber(value);
    if (n != null) {
      (target as Record<string, unknown>)[key] = n;
    }
    return "";
  }
  if (key === "direction" || key === "UFOName") {
    (target as Record<string, unknown>)[key] = unquote(value);
  }
  return "";
}

export class MapScript {
  private _type = MapScriptCommand.MSC_UNDEFINED;
  private _rects: Rect[] = [];
  private _groups: number[] = [];
  private _blocks: number[] = [];
  private _frequencies: number[] = [];
  private _maxUses: number[] = [];
  private _conditionals: number[] = [];
  private _groupsTemp: number[] = [];
  private _blocksTemp: number[] = [];
  private _frequenciesTemp: number[] = [];
  private _maxUsesTemp: number[] = [];
  private _sizeX = 1;
  private _sizeY = 1;
  private _sizeZ = 0;
  private _executionChances = 100;
  private _executions = 1;
  private _cumulativeFrequency = 0;
  private _label = 0;
  private _direction = MapDirection.MD_NONE;
  private _tunnelData: TunnelData | null = null;
  private _ufoName = "";

  load(node: MapScriptCommandDefinition): void {
    const command = node.type || "";
    if (command === "addBlock") {
      this._type = MapScriptCommand.MSC_ADDBLOCK;
    } else if (command === "addLine") {
      this._type = MapScriptCommand.MSC_ADDLINE;
    } else if (command === "addCraft") {
      this._type = MapScriptCommand.MSC_ADDCRAFT;
      this._groups.push(1);
    } else if (command === "addUFO") {
      this._type = MapScriptCommand.MSC_ADDUFO;
      this._groups.push(1);
    } else if (command === "digTunnel") {
      this._type = MapScriptCommand.MSC_DIGTUNNEL;
    } else if (command === "fillArea") {
      this._type = MapScriptCommand.MSC_FILLAREA;
    } else if (command === "checkBlock") {
      this._type = MapScriptCommand.MSC_CHECKBLOCK;
    } else if (command === "removeBlock") {
      this._type = MapScriptCommand.MSC_REMOVE;
    } else if (command === "resize") {
      this._type = MapScriptCommand.MSC_RESIZE;
      this._sizeX = 0;
      this._sizeY = 0;
    } else {
      throw new Error(`Unknown command: ${command}`);
    }

    this._rects = (node.rects || []).map(rect => ({ ...rect }));

    if (node.tunnelData) {
      this._tunnelData = new TunnelData();
      this._tunnelData.level = node.tunnelData.level ?? 0;
      for (const replacement of node.tunnelData.MCDReplacements || []) {
        this._tunnelData.replacements.set(replacement.type, {
          set: replacement.set ?? -1,
          entry: replacement.entry ?? -1
        });
      }
    }

    if (node.conditionals) {
      this._conditionals = [...node.conditionals];
    }

    if (Array.isArray(node.size)) {
      const sizes: Array<(value: number) => void> = [
        value => { this._sizeX = value; },
        value => { this._sizeY = value; },
        value => { this._sizeZ = value; }
      ];
      for (let i = 0; i < node.size.length && i < sizes.length; ++i) {
        sizes[i](node.size[i]);
      }
    } else if (node.size != null) {
      this._sizeX = node.size;
      this._sizeY = this._sizeX;
    }

    if (node.groups) {
      this._groups = [...node.groups];
    }
    let selectionSize = this._groups.length;
    if (node.blocks) {
      this._groups = [];
      this._blocks = [...node.blocks];
      selectionSize = this._blocks.length;
    }

    this._frequencies = Array.from({ length: selectionSize }, () => 1);
    this._maxUses = Array.from({ length: selectionSize }, () => -1);

    if (node.freqs) {
      for (let i = 0; i < node.freqs.length && i < selectionSize; ++i) {
        this._frequencies[i] = node.freqs[i];
      }
    }
    if (node.maxUses) {
      for (let i = 0; i < node.maxUses.length && i < selectionSize; ++i) {
        this._maxUses[i] = node.maxUses[i];
      }
    }

    if (node.direction) {
      const dir = node.direction[0]?.toUpperCase() || "";
      if (dir === "V") {
        this._direction = MapDirection.MD_VERTICAL;
      } else if (dir === "H") {
        this._direction = MapDirection.MD_HORIZONTAL;
      } else if (dir === "B") {
        this._direction = MapDirection.MD_BOTH;
      } else {
        throw new Error(`direction must be [V]ertical, [H]orizontal, or [B]oth, what does ${node.direction} mean?`);
      }
    }

    if (this._direction === MapDirection.MD_NONE &&
      (this._type === MapScriptCommand.MSC_DIGTUNNEL || this._type === MapScriptCommand.MSC_ADDLINE)) {
      throw new Error(`no direction defined for ${command} command, must be [V]ertical, [H]orizontal, or [B]oth`);
    }

    this._executionChances = node.executionChances ?? this._executionChances;
    this._executions = node.executions ?? this._executions;
    this._ufoName = node.UFOName ?? this._ufoName;
    this._label = Math.abs(node.label ?? this._label);
  }

  init(): void {
    this._cumulativeFrequency = 0;
    this._blocksTemp = [];
    this._groupsTemp = [];
    this._frequenciesTemp = [];
    this._maxUsesTemp = [];

    for (const frequency of this._frequencies) {
      this._cumulativeFrequency += frequency;
    }
    this._blocksTemp = [...this._blocks];
    this._groupsTemp = [...this._groups];
    this._frequenciesTemp = [...this._frequencies];
    this._maxUsesTemp = [...this._maxUses];
  }

  getType(): MapScriptCommand {
    return this._type;
  }

  getRects(): Rect[] {
    return this._rects;
  }

  getSizeX(): number {
    return this._sizeX;
  }

  getSizeY(): number {
    return this._sizeY;
  }

  getSizeZ(): number {
    return this._sizeZ;
  }

  getChancesOfExecution(): number {
    return this._executionChances;
  }

  getLabel(): number {
    return this._label;
  }

  getExecutions(): number {
    return this._executions;
  }

  getConditionals(): number[] {
    return this._conditionals;
  }

  getGroups(): number[] {
    return this._groups;
  }

  getBlocks(): number[] {
    return this._blocks;
  }

  getDirection(): MapDirection {
    return this._direction;
  }

  getTunnelData(): TunnelData | null {
    return this._tunnelData;
  }

  getNextBlock(terrain: RuleTerrain): MapBlock | null {
    if (this._blocks.length === 0) {
      return terrain.getRandomMapBlock(this._sizeX * 10, this._sizeY * 10, this.getGroupNumber());
    }
    const result = this.getBlockNumber();
    if (result < terrain.getMapBlocks().length && result !== MapBlockType.MT_UNDEFINED) {
      return terrain.getMapBlocks()[result];
    }
    return null;
  }

  getUFOName(): string {
    return this._ufoName;
  }

  private getGroupNumber(): number {
    if (this._groups.length === 0) {
      return MapBlockType.MT_DEFAULT;
    }
    if (this._cumulativeFrequency > 0) {
      let pick = RNG.generate(0, this._cumulativeFrequency - 1);
      for (let i = 0; i !== this._groupsTemp.length; ++i) {
        if (pick < this._frequenciesTemp[i]) {
          const retVal = this._groupsTemp[i];
          if (this._maxUsesTemp[i] > 0 && --this._maxUsesTemp[i] === 0) {
            this._groupsTemp.splice(i, 1);
            this._cumulativeFrequency -= this._frequenciesTemp[i];
            this._frequenciesTemp.splice(i, 1);
            this._maxUsesTemp.splice(i, 1);
          }
          return retVal;
        }
        pick -= this._frequenciesTemp[i];
      }
    }
    return MapBlockType.MT_UNDEFINED;
  }

  private getBlockNumber(): number {
    if (this._cumulativeFrequency > 0) {
      let pick = RNG.generate(0, this._cumulativeFrequency - 1);
      for (let i = 0; i !== this._blocksTemp.length; ++i) {
        if (pick < this._frequenciesTemp[i]) {
          const retVal = this._blocksTemp[i];
          if (this._maxUsesTemp[i] > 0 && --this._maxUsesTemp[i] === 0) {
            this._blocksTemp.splice(i, 1);
            this._cumulativeFrequency -= this._frequenciesTemp[i];
            this._frequenciesTemp.splice(i, 1);
            this._maxUsesTemp.splice(i, 1);
          }
          return retVal;
        }
        pick -= this._frequenciesTemp[i];
      }
    }
    return MapBlockType.MT_UNDEFINED;
  }
}

export function parseMapScriptsRul(source: string): MapScriptsDefinition[] {
  const definitions: MapScriptsDefinition[] = [];
  let current: MapScriptsDefinition | null = null;
  let command: MapScriptCommandDefinition | null = null;
  let section = "";
  let currentReplacement: ({ type: string } & Partial<MCDReplacement>) | null = null;

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("mapScripts:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const scriptStart = /^-\s+(type|delete):\s*(.+)$/.exec(trimmed);
    if (indent === 2 && scriptStart) {
      current = { type: "", commands: [] };
      if (scriptStart[1] === "type") {
        current.type = unquote(scriptStart[2]);
      } else {
        current.delete = unquote(scriptStart[2]);
        current.type = current.delete;
      }
      definitions.push(current);
      command = null;
      section = "";
      currentReplacement = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const commandStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
    if (indent === 4 && commandStart) {
      command = { type: unquote(commandStart[1]) };
      current.commands.push(command);
      section = "";
      currentReplacement = null;
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      if (prop[1] === "commands") {
        section = "commands";
      } else if (prop[1] === "delete") {
        current.delete = unquote(prop[2]);
      } else if (prop[1] === "type") {
        current.type = unquote(prop[2]);
      }
      continue;
    }

    if (!command) {
      continue;
    }

    if (section === "rects") {
      const rectLine = /^-\s+(\[.*\])$/.exec(trimmed);
      if (rectLine) {
        const rect = parseRect(rectLine[1]);
        if (rect) {
          (command.rects ||= []).push(rect);
        }
        continue;
      }
    }

    if (section === "MCDReplacements") {
      const replacementStart = /^-\s+type:\s*(.+)$/.exec(trimmed);
      if (replacementStart) {
        currentReplacement = { type: unquote(replacementStart[1]) };
        (command.tunnelData ||= {}).MCDReplacements ||= [];
        command.tunnelData.MCDReplacements.push(currentReplacement);
        continue;
      }
    }

    if (!prop) {
      continue;
    }

    if (section === "tunnelData" || section === "MCDReplacements") {
      if (prop[1] === "level") {
        const n = parseNumber(prop[2]);
        if (n != null) {
          (command.tunnelData ||= {}).level = n;
        }
        section = "tunnelData";
        continue;
      }
      if (prop[1] === "MCDReplacements") {
        (command.tunnelData ||= {}).MCDReplacements ||= [];
        section = "MCDReplacements";
        currentReplacement = null;
        continue;
      }
      if (currentReplacement && (prop[1] === "set" || prop[1] === "entry")) {
        const n = parseNumber(prop[2]);
        if (n != null) {
          (currentReplacement as Record<string, unknown>)[prop[1]] = n;
        }
        continue;
      }
    }

    if (indent >= 6) {
      section = setCommandProp(command, prop[1], prop[2]);
      currentReplacement = null;
    }
  }

  return definitions;
}
