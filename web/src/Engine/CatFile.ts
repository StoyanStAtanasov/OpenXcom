export class CatFile {
  private _amount = 0;
  private _offset: number[] = [];
  private _size: number[] = [];
  private _data: Uint8Array | null = null;

  constructor(path: string) {
    const response = this.loadBinary(path);
    this._data = response;
    if (this._data.length < 4) {
      return;
    }

    const view = new DataView(this._data.buffer, this._data.byteOffset, this._data.byteLength);
    this._amount = Math.trunc(view.getUint32(0, true) / (2 * 4));
    this._offset = new Array(this._amount);
    this._size = new Array(this._amount);

    for (let i = 0; i < this._amount; ++i) {
      const base = i * 8;
      if (base + 8 > this._data.length) {
        this._amount = i;
        this._offset.length = i;
        this._size.length = i;
        break;
      }
      this._offset[i] = view.getUint32(base, true);
      this._size[i] = view.getUint32(base + 4, true);
    }
  }

  getAmount(): number {
    return this._amount;
  }

  getObjectSize(i: number): number {
    return i < this._amount ? this._size[i] : 0;
  }

  load(i: number, name = false): Uint8Array | null {
    if (!this._data || i >= this._amount) {
      return null;
    }

    let offset = this._offset[i];
    let size = this._size[i];
    if (offset >= this._data.length) {
      return null;
    }

    const namesize = this._data[offset];
    if (namesize <= 56) {
      if (!name) {
        offset += namesize + 1;
        size = Math.max(0, size - (namesize + 1));
      } else {
        size += namesize + 1;
      }
    }

    const end = Math.min(this._data.length, offset + size);
    return this._data.slice(offset, end);
  }

  private loadBinary(path: string): Uint8Array {
    const request = new XMLHttpRequest();
    request.open("GET", path, false);
    request.overrideMimeType("text/plain; charset=x-user-defined");
    try {
      request.send();
    } catch (error) {
      throw new Error(`CAT ${path}: ${error instanceof Error ? error.message : "failed to load"}`);
    }
    if (request.status !== 200 && request.status !== 0) {
      throw new Error(`CAT ${path}: HTTP ${request.status}`);
    }
    const response = request.responseText;
    if (typeof response !== "string") {
      throw new Error(`CAT ${path}: no data`);
    }
    const bytes = new Uint8Array(response.length);
    for (let i = 0; i < response.length; ++i) {
      bytes[i] = response.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
}
