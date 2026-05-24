import { Position, type PositionLike } from "../Battlescape/Position.ts";

export enum NodeRank {
  NR_SCOUT = 0,
  NR_XCOM,
  NR_SOLDIER,
  NR_NAVIGATOR,
  NR_LEADER,
  NR_ENGINEER,
  NR_MISC1,
  NR_MEDIC,
  NR_MISC2
}

export type NodeSave = {
  id?: number;
  position?: [number, number, number] | number[] | PositionLike;
  type?: number;
  rank?: number;
  flags?: number;
  reserved?: number;
  priority?: number;
  allocated?: boolean;
  links?: number[];
  dummy?: boolean;
};

export class Node {
  static CRAFTSEGMENT = 1000;
  static UFOSEGMENT = 2000;
  static TYPE_FLYING = 0x01;
  static TYPE_SMALL = 0x02;
  static TYPE_DANGEROUS = 0x04;
  static nodeRank = [
    [4, 3, 5, 8, 7, 2, 0],
    [4, 3, 5, 8, 7, 2, 0],
    [5, 4, 3, 2, 7, 8, 0],
    [7, 6, 2, 8, 3, 4, 0],
    [3, 4, 5, 2, 7, 8, 0],
    [2, 5, 3, 4, 6, 8, 0],
    [2, 5, 3, 4, 6, 8, 0],
    [2, 5, 3, 4, 6, 8, 0]
  ];

  private _nodeLinks: number[] = [];
  private _allocated = false;
  private _dummy = false;

  constructor(
    private _id = 0,
    private _pos = new Position(),
    private _segment = 0,
    private _type = 0,
    private _rank = 0,
    private _flags = 0,
    private _reserved = 0,
    private _priority = 0
  ) {}

  load(node: NodeSave): void {
    this._id = node.id ?? this._id;
    this._pos = Position.from(node.position);
    this._type = node.type ?? this._type;
    this._rank = node.rank ?? this._rank;
    this._flags = node.flags ?? this._flags;
    this._reserved = node.reserved ?? this._reserved;
    this._priority = node.priority ?? this._priority;
    this._allocated = node.allocated ?? this._allocated;
    this._nodeLinks = [...(node.links || this._nodeLinks)];
    this._dummy = node.dummy ?? this._dummy;
  }

  save(): NodeSave {
    return {
      id: this._id,
      position: this._pos.toArray(),
      type: this._type,
      rank: this._rank,
      flags: this._flags,
      reserved: this._reserved,
      priority: this._priority,
      allocated: this._allocated,
      links: [...this._nodeLinks],
      dummy: this._dummy
    };
  }

  getID(): number {
    return this._id;
  }

  getNodeLinks(): number[] {
    return this._nodeLinks;
  }

  getRank(): NodeRank {
    return this._rank as NodeRank;
  }

  getPriority(): number {
    return this._priority;
  }

  getPosition(): Position {
    return this._pos;
  }

  getSegment(): number {
    return this._segment;
  }

  getType(): number {
    return this._type;
  }

  setType(type: number): void {
    this._type = type;
  }

  getFlags(): number {
    return this._flags;
  }

  isAllocated(): boolean {
    return this._allocated;
  }

  allocateNode(): void {
    this._allocated = true;
  }

  freeNode(): void {
    this._allocated = false;
  }

  isTarget(): boolean {
    return this._reserved === 5;
  }

  setDummy(dummy: boolean): void {
    this._dummy = dummy;
  }

  isDummy(): boolean {
    return this._dummy;
  }
}
