import { CatFile } from "./CatFile.ts";
import { Sound } from "./Sound.ts";

export class SoundSet {
  private _sounds = new Map<number, Sound>();
  private _sharedSounds = Number.MAX_SAFE_INTEGER;

  loadCat(filename: string, wav = true): void {
    const sndFile = new CatFile(filename);
    for (let i = 0; i < sndFile.getAmount(); ++i) {
      const sound = sndFile.load(i);
      const size = sndFile.getObjectSize(i);
      const s = new Sound();
      if (!sound || size === 0) {
        this._sounds.set(i, s);
        continue;
      }

      if (!wav) {
        this.loadRawCatSound(s, sound, size);
      } else {
        this.loadWavCatSound(s, sound, size);
      }
      this._sounds.set(i, s);
    }
  }

  getSound(i: number): Sound | null {
    return this._sounds.get(i) || null;
  }

  addSound(i: number): Sound {
    const sound = new Sound();
    this._sounds.set(i, sound);
    return sound;
  }

  setMaxSharedSounds(i: number): void {
    this._sharedSounds = i >= 0 ? i : 0;
  }

  getMaxSharedSounds(): number {
    return this._sharedSounds;
  }

  getTotalSounds(): number {
    return this._sounds.size;
  }

  loadCatbyIndex(filename: string, index: number): void {
    const sndFile = new CatFile(filename);
    if (index >= sndFile.getAmount()) {
      throw new Error(`${filename} does not contain ${index} sound files.`);
    }

    const sound = sndFile.load(index);
    const size = sndFile.getObjectSize(index);
    const s = new Sound();
    if (!sound || size === 0) {
      this._sounds.set(this.getTotalSounds(), s);
      return;
    }

    const headerSize = 44;
    let adjusted = sound.slice();
    let adjustedSize = size;
    if (adjustedSize > 5) {
      adjustedSize -= 5;
    }
    if (adjustedSize > 0) {
      adjustedSize--;
    }
    if (adjustedSize === 0) {
      this._sounds.set(this.getTotalSounds(), s);
      return;
    }

    const header = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
      0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x11, 0x2b, 0x00, 0x00, 0x11, 0x2b, 0x00, 0x00,
      0x01, 0x00, 0x08, 0x00, 0x64, 0x61, 0x74, 0x61,
      0x00, 0x00, 0x00, 0x00
    ]);
    const headersize = adjustedSize + 36;
    const soundsize = adjustedSize;
    new DataView(header.buffer).setUint32(4, headersize, true);
    new DataView(header.buffer).setUint32(40, soundsize, true);

    const newsound = new Uint8Array(headerSize + adjustedSize);
    newsound.set(header, 0);
    for (let n = 0; n < adjustedSize; ++n) {
      adjusted[5 + n] = (adjusted[5 + n] * 4) & 0xff;
    }
    newsound.set(adjusted.subarray(5, 5 + adjustedSize), headerSize);
    const newsize = this.convertSampleRate(adjusted.subarray(5, 5 + adjustedSize), adjustedSize, newsound.subarray(headerSize));
    new DataView(newsound.buffer).setUint32(4, newsize + 36, true);
    new DataView(newsound.buffer).setUint32(40, newsize, true);
    s.load(newsound.subarray(0, newsize + headerSize));
    this._sounds.set(this.getTotalSounds(), s);
  }

  private convertSampleRate(oldsound: Uint8Array, oldsize: number, newsound: Uint8Array): number {
    const step16 = Math.trunc((8000 << 16) / 11025);
    let newsize = 0;
    for (let offset16 = 0; (offset16 >> 16) < oldsize; offset16 += step16, ++newsize) {
      newsound[newsize] = oldsound[offset16 >> 16];
    }
    return newsize;
  }

  private loadRawCatSound(sound: Sound, raw: Uint8Array, size: number): void {
    let adjustedSize = size;
    if (adjustedSize > 5) {
      adjustedSize -= 5;
    }
    if (adjustedSize > 0) {
      adjustedSize--;
    }
    if (adjustedSize === 0) {
      sound.load(new Uint8Array(0));
      return;
    }

    const header = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
      0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x11, 0x2b, 0x00, 0x00, 0x11, 0x2b, 0x00, 0x00,
      0x01, 0x00, 0x08, 0x00, 0x64, 0x61, 0x74, 0x61,
      0x00, 0x00, 0x00, 0x00
    ]);
    const newsound = new Uint8Array(44 + adjustedSize * 2);
    new DataView(header.buffer).setUint32(4, adjustedSize + 36, true);
    new DataView(header.buffer).setUint32(40, adjustedSize, true);
    newsound.set(header, 0);
    newsound.set(raw.subarray(5, 5 + adjustedSize), 44);
    const newsize = this.convertSampleRate(raw.subarray(5, 5 + adjustedSize), adjustedSize, newsound.subarray(44));
    sound.load(newsound.subarray(0, newsize + 44));
  }

  private loadWavCatSound(sound: Sound, raw: Uint8Array, size: number): void {
    if (size > 0x1f + 1 + 0x18 && raw[0x18] === 0x40 && raw[0x19] === 0x1f && raw[0x1a] === 0x00 && raw[0x1b] === 0x00) {
      const sound2 = new Uint8Array(size * 2);
      sound2.set(raw, 0);
      sound2[0x18] = 0x11;
      sound2[0x19] = 0x2b;
      sound2[0x1c] = 0x11;
      sound2[0x1d] = 0x2b;
      const newsize = this.convertSampleRate(raw.subarray(44), size - 44, sound2.subarray(44));
      new DataView(sound2.buffer).setUint32(0x28, newsize, true);
      sound.load(sound2.subarray(0, newsize + 44));
      return;
    }
    sound.load(raw);
  }
}
