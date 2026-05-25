export class Polyline {
  private _lat: number[];
  private _lon: number[];

  constructor(private _points: number) {
    this._lat = new Array(_points).fill(0);
    this._lon = new Array(_points).fill(0);
  }

  load(node: number[]): void {
    this._points = Math.trunc(node.length / 2);
    this._lat = new Array(this._points).fill(0);
    this._lon = new Array(this._points).fill(0);
    for (let i = 0; i < node.length; i += 2) {
      const j = Math.trunc(i / 2);
      this._lon[j] = deg2Rad(node[i]);
      this._lat[j] = deg2Rad(node[i + 1]);
    }
  }

  getLatitude(i: number): number {
    return this._lat[i];
  }

  setLatitude(i: number, lat: number): void {
    this._lat[i] = lat;
  }

  getLongitude(i: number): number {
    return this._lon[i];
  }

  setLongitude(i: number, lon: number): void {
    this._lon[i] = lon;
  }

  getPoints(): number {
    return this._points;
  }
}

function deg2Rad(value: number): number {
  return value * Math.PI / 180.0;
}
