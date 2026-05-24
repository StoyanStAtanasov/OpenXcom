export class Polygon {
  private _lon: number[];
  private _lat: number[];
  private _texture = 0;

  constructor(points: number) {
    this._lon = Array(points).fill(0);
    this._lat = Array(points).fill(0);
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
