export class CordPolar {
  lon: number;
  lat: number;

  constructor(lon = 0, lat = 0) {
    this.lon = lon;
    this.lat = lat;
  }

  static fromCord(cord: Cord): CordPolar {
    const inv = 1 / cord.norm();
    return new CordPolar(Math.atan2(cord.x, cord.z), Math.asin(cord.y * inv));
  }
}

export class Cord {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static fromPolar(pol: CordPolar): Cord {
    return new Cord(
      Math.sin(pol.lon) * Math.cos(pol.lat),
      Math.sin(pol.lat),
      Math.cos(pol.lon) * Math.cos(pol.lat)
    );
  }

  positive(): Cord {
    return new Cord(this.x, this.y, this.z);
  }

  negative(): Cord {
    return new Cord(-this.x, -this.y, -this.z);
  }

  multiplyAssign(d: number): this {
    this.x *= d;
    this.y *= d;
    this.z *= d;
    return this;
  }

  divideAssign(d: number): this {
    const re = 1 / d;
    this.x *= re;
    this.y *= re;
    this.z *= re;
    return this;
  }

  addAssign(cord: Cord): this {
    this.x += cord.x;
    this.y += cord.y;
    this.z += cord.z;
    return this;
  }

  subtractAssign(cord: Cord): this {
    this.x -= cord.x;
    this.y -= cord.y;
    this.z -= cord.z;
    return this;
  }

  equals(cord: Cord): boolean {
    return areSame(this.x, cord.x) && areSame(this.y, cord.y) && areSame(this.z, cord.z);
  }

  norm(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
}

function areSame(left: number, right: number): boolean {
  return Math.abs(left - right) <= Number.EPSILON;
}
