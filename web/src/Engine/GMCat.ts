import { CatFile } from "./CatFile.ts";
import { Music } from "./Music.ts";

type Seq = {
  size: number;
  data: Uint8Array;
};

type Track = {
  seq: Seq;
  channel: number;
};

type GMStream = {
  tempo: number;
  nsubs: number;
  ntracks: number;
  subs: Seq[];
  tracks: Track[];
};

type OutputStatus = {
  delta: number;
  patch: number;
  prevcmd: number;
};

const volume = [
  100,100,100,100,100, 90,100,100,100,100,100, 90,100,100,100,100,
  100,100, 85,100,100,100,100,100,100,100,100,100, 90,90, 110, 80,
  100,100,100, 90, 70,100,100,100,100,100,100,100,100,100,100,100,
  100,100, 90,100,100,100,100,100,100,120,100,100,100,120,100,127,
  100,100, 90,100,100,100,100,100,100, 95,100,100,100,100,100,100,
  100,100,100,100,100,100,100,115,100,100,100,100,100,100,100,100,
  100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,
  100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100
];

function readUint32LE(data: Uint8Array, offset: number): number {
  return (data[offset] || 0) +
    ((data[offset + 1] || 0) << 8) +
    ((data[offset + 2] || 0) << 16) +
    ((data[offset + 3] || 0) << 24);
}

function gmextReadStream(stream: GMStream, n: number, data: Uint8Array): number {
  let left = n;
  let pos = 0;
  if (!left--) {
    return -1;
  }
  stream.tempo = data[pos++] || 0;
  if (!left--) {
    return -1;
  }
  stream.nsubs = data[pos++] || 0;
  stream.subs = new Array(256);
  stream.tracks = new Array(256);
  for (let i = 0; i < stream.nsubs; ++i) {
    if (left < 4) {
      return -1;
    }
    const s = readUint32LE(data, pos);
    if (s < 4 || pos + s > data.length) {
      return -1;
    }
    stream.subs[i] = { size: s - 4, data: data.subarray(pos + 4, pos + s) };
    left -= s;
    pos += s;
  }
  if (!left--) {
    return -1;
  }
  stream.ntracks = data[pos++] || 0;
  for (let i = 0; i < stream.ntracks; ++i) {
    if (left-- < 5) {
      return -1;
    }
    const channel = data[pos++] || 0;
    const s = readUint32LE(data, pos);
    if (s < 4 || pos + s > data.length) {
      return -1;
    }
    stream.tracks[i] = { channel, seq: { size: s - 4, data: data.subarray(pos + 4, pos + s) } };
    left -= s;
    pos += s;
  }
  return left ? -1 : 0;
}

function gmextWriteInt16(midi: number[], n: number): void {
  midi.push((n >> 8) & 0xff, n & 0xff);
}

function gmextWriteDelta(midi: number[], delta: number): void {
  const data = new Array<number>(4);
  let i = 0;
  delta &= ((1 << 28) - 1);
  do {
    data[i++] = delta & 0x7f;
    delta >>= 7;
  } while (delta > 0 && i <= 3);
  while (--i) {
    midi.push((data[i] | 0x80) & 0xff);
  }
  midi.push(data[0] & 0xff);
}

function gmextWriteTempoEv(midi: number[], tempo: number): void {
  midi.push(0xff, 0x51, 3);
  tempo = Math.trunc(60000000 / tempo);
  midi.push((tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff);
}

function gmextWriteEndEv(midi: number[]): void {
  midi.push(0xff, 0x2f, 0x00);
}

function gmextWriteSequence(midi: number[], stream: GMStream, channel: number, seq: Seq, status: OutputStatus): number {
  const data = seq.data;
  let left = seq.size;
  let pos = 0;
  let cmd = 0xff;

  while (left) {
    let ndelta = 0;
    for (let i = 0; ; ) {
      const c = data[pos++] || 0;
      left--;
      ndelta += c & 0x7f;
      if (!(c & 0x80)) {
        break;
      }
      if ((++i === 4) || !left) {
        return -1;
      }
      ndelta <<= 7;
    }

    status.delta += ndelta;
    if (!left) {
      return -1;
    }

    if (data[pos] & 0x80) {
      cmd = data[pos++] || 0;
      left--;
      switch (cmd) {
        case 0xff:
        case 0xfd:
          return 0;
        case 0xfe:
          if (!left--) {
            return -1;
          }
          if ((data[pos] || 0) >= stream.nsubs) {
            return -1;
          }
          if (gmextWriteSequence(midi, stream, channel, stream.subs[data[pos++] || 0], status) === -1) {
            return -1;
          }
          cmd = 0;
          continue;
        default:
          cmd &= 0xf0;
      }
    } else if (cmd === 0) {
      return -1;
    }

    if (!left--) {
      return -1;
    }
    const data1 = data[pos++] || 0;

    switch (cmd) {
      case 0x80:
      case 0x90: {
        if (!left--) {
          return -1;
        }
        let data2 = data[pos++] || 0;
        if (data2) {
          data2 = Math.trunc((data2 * (channel === 9 ? 80 : volume[status.patch])) / 128);
        }
        gmextWriteDelta(midi, status.delta);
        midi.push(cmd | channel, data1, data2);
        break;
      }
      case 0xc0:
        if (data1 === 0x7e) {
          return 0;
        }
        status.patch = data1;
        gmextWriteDelta(midi, status.delta);
        midi.push(cmd | channel, (data1 === 0x57 || data1 === 0x3f) ? 0x3e : data1);
        break;
      case 0xb0: {
        if (!left--) {
          return -1;
        }
        let data2 = data[pos++] || 0;
        if (data1 === 0x7e) {
          continue;
        }
        if (!data1) {
          if (!data2) {
            continue;
          }
          gmextWriteDelta(midi, status.delta);
          gmextWriteTempoEv(midi, 2 * data2);
          break;
        }
        if (data1 === 0x5b) {
          data2 = 0x1e;
        }
        gmextWriteDelta(midi, status.delta);
        midi.push(cmd | channel, data1, data2);
        break;
      }
      case 0xe0: {
        if (!left--) {
          return -1;
        }
        const data2 = data[pos++] || 0;
        gmextWriteDelta(midi, status.delta);
        midi.push(cmd | channel, data1, data2);
        break;
      }
      default:
        return -1;
    }

    status.delta = 0;
  }

  return 0;
}

function gmextWriteMidi(stream: GMStream): Uint8Array | null {
  const midi: number[] = [];
  midi.push(0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06);
  gmextWriteInt16(midi, 1);
  gmextWriteInt16(midi, stream.ntracks + 1);
  gmextWriteInt16(midi, 24);

  midi.push(0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 0x0b);
  gmextWriteDelta(midi, 0);
  gmextWriteTempoEv(midi, stream.tempo);
  gmextWriteDelta(midi, 0);
  gmextWriteEndEv(midi);

  for (let j = 0; j < stream.ntracks; ++j) {
    midi.push(0x4d, 0x54, 0x72, 0x6b);
    const loffset = midi.length;
    midi.push(0, 0, 0, 0);
    const init = [0, 0xB0, 0x78, 0, 0, 0x79, 0, 0, 0x7B, 0];
    midi.push(0, 0xB0 | stream.tracks[j].channel, ...init);
    const status: OutputStatus = { delta: 0, patch: 0, prevcmd: 0 };
    if (gmextWriteSequence(midi, stream, stream.tracks[j].channel, stream.tracks[j].seq, status) === -1) {
      return null;
    }
    gmextWriteDelta(midi, status.delta);
    gmextWriteEndEv(midi);
    const length = midi.length - loffset - 4;
    midi[loffset] = (length >> 24) & 0xff;
    midi[loffset + 1] = (length >> 16) & 0xff;
    midi[loffset + 2] = (length >> 8) & 0xff;
    midi[loffset + 3] = length & 0xff;
  }

  return Uint8Array.from(midi);
}

export class GMCatFile extends CatFile {
  loadMIDI(i: number): Music {
    const music = new Music();
    const raw = this.load(i);
    if (!raw) {
      return music;
    }

    const stream: GMStream = { tempo: 0, nsubs: 0, ntracks: 0, subs: [], tracks: [] };
    if (gmextReadStream(stream, this.getObjectSize(i), raw) === -1) {
      return music;
    }

    const midi = gmextWriteMidi(stream);
    if (!midi) {
      return music;
    }

    music.load(midi);
    return music;
  }
}
