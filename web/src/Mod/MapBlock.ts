export enum MapBlockType {
  MT_UNDEFINED = -1,
  MT_DEFAULT,
  MT_LANDINGZONE,
  MT_EWROAD,
  MT_NSROAD,
  MT_CROSSING
}

export type Position = {
  x: number;
  y: number;
  z: number;
};

export type MapBlockDefinition = {
  name: string;
  width?: number;
  length?: number;
  height?: number;
  groups?: number[];
  revealedFloors?: number[];
  items?: Record<string, Position[]>;
};

export class MapBlock {
  private _sizeX = 10;
  private _sizeY = 10;
  private _sizeZ = 4;
  private _groups: number[] = [0];
  private _revealedFloors: number[] = [];
  private _items = new Map<string, Position[]>();

  constructor(private _name: string) {}

  load(node: MapBlockDefinition): void {
    this._name = node.name || this._name;
    this._sizeX = node.width ?? this._sizeX;
    this._sizeY = node.length ?? this._sizeY;
    this._sizeZ = node.height ?? this._sizeZ;
    if (this._sizeX % 10 !== 0 || this._sizeY % 10 !== 0) {
      throw new Error(`Error: MapBlock ${this._name}: Size must be divisible by ten`);
    }
    if (node.groups) {
      this._groups = [...node.groups];
    }
    if (node.revealedFloors) {
      this._revealedFloors = [...node.revealedFloors];
    }
    this._items.clear();
    for (const [type, positions] of Object.entries(node.items || {})) {
      this._items.set(type, positions.map(position => ({ ...position })));
    }
  }

  getName(): string {
    return this._name;
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

  setSizeZ(sizeZ: number): void {
    this._sizeZ = sizeZ;
  }

  isInGroup(group: number): boolean {
    return this._groups.includes(group);
  }

  isFloorRevealed(floor: number): boolean {
    return this._revealedFloors.includes(floor);
  }

  getItems(): Map<string, Position[]> {
    return this._items;
  }
}
