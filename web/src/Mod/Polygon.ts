export class Polygon {
  private _lon: number[];
  private _lat: number[];
  private _x: number[];
  private _y: number[];
  private _texture = 0;

  constructor(points: number) {
    this._lon = Array(points).fill(0);
    this._lat = Array(points).fill(0);
    this._x = Array(points).fill(0);
    this._y = Array(points).fill(0);
  }

  clone(): Polygon {
    const other = new Polygon(this.getPoints());
    for (let i = 0; i < this.getPoints(); ++i) {
      other.setLongitude(i, this._lon[i]);
      other.setLatitude(i, this._lat[i]);
      other.setX(i, this._x[i]);
      other.setY(i, this._y[i]);
    }
    other.setTexture(this._texture);
    return other;
  }

  load(node: number[]): void {
    const points = Math.trunc((node.length - 1) / 2);
    this._lon = Array(points).fill(0);
    this._lat = Array(points).fill(0);
    this._x = Array(points).fill(0);
    this._y = Array(points).fill(0);
    this._texture = Math.trunc(node[0] || 0);
    for (let i = 1; i + 1 < node.length; i += 2) {
      const point = Math.trunc((i - 1) / 2);
      this._lon[point] = deg2Rad(node[i]);
      this._lat[point] = deg2Rad(node[i + 1]);
    }
  }

  getPoints(): number {
    return this._lon.length;
  }

  setLongitude(point: number, lon: number): void {
    this._lon[point] = lon;
  }

  setLatitude(point: number, lat: number): void {
    this._lat[point] = lat;
  }

  getLongitude(point: number): number {
    return this._lon[point];
  }

  getLatitude(point: number): number {
    return this._lat[point];
  }

  setX(point: number, x: number): void {
    this._x[point] = Math.trunc(x);
  }

  getX(point: number): number {
    return this._x[point];
  }

  setY(point: number, y: number): void {
    this._y[point] = Math.trunc(y);
  }

  getY(point: number): number {
    return this._y[point];
  }

  setTexture(texture: number): void {
    this._texture = texture;
  }

  getTexture(): number {
    return this._texture;
  }

  getLongitudes(): number[] {
    return this._lon;
  }

  getLatitudes(): number[] {
    return this._lat;
  }
}

function deg2Rad(value: number): number {
  return value * Math.PI / 180.0;
}
