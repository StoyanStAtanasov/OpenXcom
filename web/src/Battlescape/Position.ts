export type PositionLike = {
  x: number;
  y: number;
  z: number;
};

export class Position {
  constructor(public x = 0, public y = 0, public z = 0) {}

  static from(value: PositionLike | [number, number, number] | number[] | undefined | null): Position {
    if (!value) {
      return new Position();
    }
    if (Array.isArray(value)) {
      return new Position(value[0] || 0, value[1] || 0, value[2] || 0);
    }
    return new Position(value.x, value.y, value.z);
  }

  clone(): Position {
    return new Position(this.x, this.y, this.z);
  }

  add(pos: PositionLike): Position {
    return new Position(this.x + pos.x, this.y + pos.y, this.z + pos.z);
  }

  subtract(pos: PositionLike): Position {
    return new Position(this.x - pos.x, this.y - pos.y, this.z - pos.z);
  }

  multiply(value: PositionLike | number): Position {
    if (typeof value === "number") {
      return new Position(this.x * value, this.y * value, this.z * value);
    }
    return new Position(this.x * value.x, this.y * value.y, this.z * value.z);
  }

  divide(value: PositionLike | number): Position {
    if (typeof value === "number") {
      return new Position(Math.trunc(this.x / value), Math.trunc(this.y / value), Math.trunc(this.z / value));
    }
    return new Position(Math.trunc(this.x / value.x), Math.trunc(this.y / value.y), Math.trunc(this.z / value.z));
  }

  equals(pos: PositionLike): boolean {
    return this.x === pos.x && this.y === pos.y && this.z === pos.z;
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toString(): string {
    return `(${this.x},${this.y},${this.z})`;
  }
}
