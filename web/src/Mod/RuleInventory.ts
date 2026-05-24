import type { RuleItem } from "./RuleItem.ts";

export type RuleSlot = {
  x: number;
  y: number;
};

export enum InventoryType {
  INV_SLOT = 0,
  INV_HAND,
  INV_GROUND
}

export type RuleInventoryDefinition = {
  id: string;
  x?: number;
  y?: number;
  type?: number;
  slots: RuleSlot[];
  costs: Record<string, number>;
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

function parseSlot(value: string): RuleSlot | null {
  const match = /^\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return { x: Number(match[1]), y: Number(match[2]) };
}

function setInventoryProp(target: RuleInventoryDefinition, key: string, value: string): void {
  switch (key) {
    case "id":
      target.id = unquote(value);
      break;
    case "x":
    case "y":
    case "type":
    case "listOrder": {
      const n = parseNumber(value);
      if (n != null) {
        (target as Record<string, unknown>)[key] = n;
      }
      break;
    }
    default:
      break;
  }
}

export class RuleInventory {
  static SLOT_W = 16;
  static SLOT_H = 16;
  static HAND_W = 2;
  static HAND_H = 3;

  private _x = 0;
  private _y = 0;
  private _type = InventoryType.INV_SLOT;
  private _slots: RuleSlot[] = [];
  private _costs = new Map<string, number>();
  private _listOrder = 0;

  constructor(private _id: string) {}

  load(node: RuleInventoryDefinition, listOrder = 0): void {
    this._id = node.id || this._id;
    this._x = node.x ?? this._x;
    this._y = node.y ?? this._y;
    this._type = node.type ?? this._type;
    this._slots = node.slots.map(slot => ({ ...slot }));
    this._costs = new Map(Object.entries(node.costs || {}));
    this._listOrder = node.listOrder ?? listOrder;
  }

  getId(): string {
    return this._id;
  }

  getX(): number {
    return this._x;
  }

  getY(): number {
    return this._y;
  }

  getType(): InventoryType {
    return this._type;
  }

  getSlots(): RuleSlot[] {
    return this._slots;
  }

  checkSlotInPosition(xRef: { value: number }, yRef: { value: number }): boolean {
    const mouseX = xRef.value;
    const mouseY = yRef.value;
    if (this._type === InventoryType.INV_HAND) {
      for (let xx = 0; xx < RuleInventory.HAND_W; ++xx) {
        for (let yy = 0; yy < RuleInventory.HAND_H; ++yy) {
          if (
            mouseX >= this._x + xx * RuleInventory.SLOT_W &&
            mouseX < this._x + (xx + 1) * RuleInventory.SLOT_W &&
            mouseY >= this._y + yy * RuleInventory.SLOT_H &&
            mouseY < this._y + (yy + 1) * RuleInventory.SLOT_H
          ) {
            xRef.value = 0;
            yRef.value = 0;
            return true;
          }
        }
      }
    } else if (this._type === InventoryType.INV_GROUND) {
      if (mouseX >= this._x && mouseX < 320 && mouseY >= this._y && mouseY < 200) {
        xRef.value = Math.floor((mouseX - this._x) / RuleInventory.SLOT_W);
        yRef.value = Math.floor((mouseY - this._y) / RuleInventory.SLOT_H);
        return true;
      }
    } else {
      for (const slot of this._slots) {
        if (
          mouseX >= this._x + slot.x * RuleInventory.SLOT_W &&
          mouseX < this._x + (slot.x + 1) * RuleInventory.SLOT_W &&
          mouseY >= this._y + slot.y * RuleInventory.SLOT_H &&
          mouseY < this._y + (slot.y + 1) * RuleInventory.SLOT_H
        ) {
          xRef.value = slot.x;
          yRef.value = slot.y;
          return true;
        }
      }
    }
    return false;
  }

  fitItemInSlot(item: RuleItem, x: number, y: number): boolean {
    if (this._type === InventoryType.INV_HAND) {
      return true;
    }
    if (this._type === InventoryType.INV_GROUND) {
      const width = Math.floor((320 - this._x) / RuleInventory.SLOT_W);
      const height = Math.floor((200 - this._y) / RuleInventory.SLOT_H);
      let xOffset = 0;
      while (x >= xOffset + width) {
        xOffset += width;
      }
      for (let xx = x; xx < x + item.getInventoryWidth(); ++xx) {
        for (let yy = y; yy < y + item.getInventoryHeight(); ++yy) {
          if (!(xx >= xOffset && xx < xOffset + width && yy >= 0 && yy < height)) {
            return false;
          }
        }
      }
      return true;
    }

    const totalSlots = item.getInventoryWidth() * item.getInventoryHeight();
    let foundSlots = 0;
    for (const slot of this._slots) {
      if (slot.x >= x && slot.x < x + item.getInventoryWidth() && slot.y >= y && slot.y < y + item.getInventoryHeight()) {
        ++foundSlots;
      }
      if (foundSlots >= totalSlots) {
        break;
      }
    }
    return foundSlots === totalSlots;
  }

  getCost(slot: RuleInventory): number {
    if (slot === this) {
      return 0;
    }
    const cost = this._costs.get(slot.getId());
    if (cost == null) {
      throw new Error(`Inventory cost ${this._id} -> ${slot.getId()} not found.`);
    }
    return cost;
  }

  getListOrder(): number {
    return this._listOrder;
  }
}

export function parseInventoriesRul(source: string): RuleInventoryDefinition[] {
  const definitions: RuleInventoryDefinition[] = [];
  let current: RuleInventoryDefinition | null = null;
  let section = "";

  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line.trim() || line.trim().startsWith("invs:")) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    const start = /^-\s+id:\s*(.+)$/.exec(trimmed);
    if (indent === 2 && start) {
      current = { id: unquote(start[1]), slots: [], costs: {} };
      definitions.push(current);
      section = "";
      continue;
    }

    if (!current) {
      continue;
    }

    const prop = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (indent === 4 && prop) {
      if (prop[1] === "slots" || prop[1] === "costs") {
        section = prop[1];
      } else {
        section = "";
        setInventoryProp(current, prop[1], prop[2]);
      }
      continue;
    }

    if (section === "slots" && indent === 6) {
      const entry = /^-\s+(.+)$/.exec(trimmed);
      if (entry) {
        const slot = parseSlot(entry[1]);
        if (slot) {
          current.slots.push(slot);
        }
      }
      continue;
    }

    if (section === "costs" && indent === 6 && prop) {
      const n = parseNumber(prop[2]);
      if (n != null) {
        current.costs[prop[1]] = n;
      }
    }
  }

  return definitions;
}
