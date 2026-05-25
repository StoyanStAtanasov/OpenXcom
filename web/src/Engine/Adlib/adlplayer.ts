/*
 * Source-shaped TypeScript translation of src/Engine/Adlib/adlplayer.cpp/.h.
 * The OPL register API is preserved. The browser port keeps the synthesis
 * backend as a separate boundary.
 */

import {
  OPLCreate,
  OPLDestroy,
  OPLRead,
  OPLResetChip,
  OPLWrite,
  type FM_OPL,
} from "./fmopl.ts";

type BytePointer = {
  data: Uint8Array;
  offset: number;
};

interface StrucAdlibChannels {
  cur_note: number;
  cur_instrument: number;
  cur_sample: number;
  cur_freq: number;
  hifreq: number;
  cur_volume: number;
  duration: number;
  pan: number;
}

interface StrucInstruments {
  sample_id: number;
  prev_cmd: number;
  volume: number;
  cur_pitchbend: number;
  cur_delay: number;
  cur_address: BytePointer | null;
  start_address: BytePointer | null;
  return_address: BytePointer | null;
}

interface StrucSample {
  reg20_op1: number;
  reg20_op2: number;
  reg40_op1: number;
  reg40_op2: number;
  reg60_op1: number;
  reg60_op2: number;
  reg80_op1: number;
  reg80_op2: number;
  regE0_op1: number;
  regE0_op2: number;
  regC0: number;
}

const adl_gv_freq_table = [
  0x0B5,0x0C0,0x0CC,0x0D8,0x0E5,0x0F2,0x101,0x110,0x120,0x131,0x143,0x157,
  0x16B,0x181,0x198,0x1B0,0x1CA,0x1E5,0x202,0x220,0x241,0x263,0x287,0x2AE,
  0x16B,0x181,0x198,0x1B0,0x1CA,0x1E5,0x202,0x220,0x241,0x263,0x287,0x2AE,
  0x16B,0x181,0x198,0x1B0,0x1CA,0x1E5,0x202,0x220,0x241,0x263,0x287,0x2AE,
  0x16B,0x181,0x198,0x1B0,0x1CA,0x1E5,0x202,0x220,0x241,0x263,0x287,0x2AE,
  0x16B,0x181,0x198,0x1B0,0x1CA,0x1E5,0x202,0x220,0x241,0x263,0x287,0x2AE,
  0x16B,0x181,0x198,0x1B0,0x1CA,0x1E5,0x202,0x220,0x241,0x263,0x287,0x2AE,
  0x16B,0x181,0x198,0x1B0,0x1CA,0x1E5,0x202,0x220,0x241,0x263,0x287,0x2AE,
  0x16B,0x181,0x198,0x1B0,0x1CA,0x1E5,0x202,0x220,0x241,0x263,0x287,0x2AE,
];

const adl_gv_octave_table = [
  0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,
  1,1,1,1,1,1,1,1,1,1,1,1,
  2,2,2,2,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,3,3,3,3,
  4,4,4,4,4,4,4,4,4,4,4,4,
  5,5,5,5,5,5,5,5,5,5,5,5,
  6,6,6,6,6,6,6,6,6,6,6,6,
  7,7,7,7,7,7,7,7,7,7,7,7,
];

const adl_gv_detune_table = [
  3,3,3,3,4,4,4,4,4,5,5,5,
  3,3,3,3,4,4,4,4,4,5,5,5,
  3,3,3,3,4,4,4,4,4,5,5,5,
  3,3,3,3,4,4,4,4,4,5,5,5,
  3,3,3,3,4,4,4,4,4,5,5,5,
  3,3,3,3,4,4,4,4,4,5,5,5,
  3,3,3,3,4,4,4,4,4,5,5,5,
  3,3,3,3,4,4,4,4,4,5,5,5,
  3,3,3,3,4,4,4,4,4,5,5,5,
];

const adl_gv_instr_order = [0,1,2,3,4,5,6,7,8,10,11,12,13,14,15,9];
const adl_gv_operators1 = [0,1,2,8,9,10,16,17,18,24,25,26];
const slot_array = [
  0,2,4,1,3,5,-1,-1,
  6,8,10,7,9,11,-1,-1,
  12,14,16,13,15,17,-1,-1,
  18,20,22,19,21,23,-1,-1,
];

const adlib_channels: StrucAdlibChannels[] = Array.from({ length: 12 }, () => ({
  cur_note: 0,
  cur_instrument: 0,
  cur_sample: 0xff,
  cur_freq: 0,
  hifreq: 0,
  cur_volume: 0,
  duration: 0,
  pan: 0,
}));

const instruments: StrucInstruments[] = Array.from({ length: 16 }, () => ({
  sample_id: 0,
  prev_cmd: 0,
  volume: 127,
  cur_pitchbend: 0,
  cur_delay: 0,
  cur_address: null,
  start_address: null,
  return_address: null,
}));

const saved_instruments: StrucInstruments[][] = Array.from({ length: 2 }, () =>
  Array.from({ length: 16 }, () => ({
    sample_id: 0,
    prev_cmd: 0,
    volume: 127,
    cur_pitchbend: 0,
    cur_delay: 0,
    cur_address: null,
    start_address: null,
    return_address: null,
  })),
);

const iFMReg = new Uint8Array(256);
const iTweakedFMReg = new Uint8Array(256);
const iCurrentTweakedBlock = new Uint8Array(12);
const iCurrentFNum = new Uint16Array(12);
const adl_gv_chorus_instruments = new Uint8Array(16);

let adl_gv_master_music_volume = 127;
let adl_gv_tmp_music_volume = 127;
let adl_gv_want_fade = false;
let adl_gv_music_playing = false;
let adl_gv_tempo = 120;
let adl_gv_tempo_run = 60;
let adl_gv_tempo_inc = 70;
let adl_gv_samples_addr: BytePointer | null = null;
const adl_gv_subtracks: Array<BytePointer | null> = new Array(128).fill(null);
let adl_gv_instruments_count = 0;
let adl_gv_subtracks_count = 0;
let adl_gv_polyphony_level = 0;
let adl_gv_FORMAT = 0;

export const opl: Array<FM_OPL | null> = [null, null];
const globalScope = globalThis as typeof globalThis & { opl?: Array<FM_OPL | null> };
globalScope.opl = opl;

function peekU16(ptr: BytePointer): number {
  const lo = ptr.data[ptr.offset] ?? 0;
  const hi = ptr.data[ptr.offset + 1] ?? 0;
  return lo | (hi << 8);
}

function clonePointer(ptr: BytePointer | null): BytePointer | null {
  return ptr ? { data: ptr.data, offset: ptr.offset } : null;
}

function cloneInstrument(src: StrucInstruments): StrucInstruments {
  return {
    sample_id: src.sample_id,
    prev_cmd: src.prev_cmd,
    volume: src.volume,
    cur_pitchbend: src.cur_pitchbend,
    cur_delay: src.cur_delay,
    cur_address: clonePointer(src.cur_address),
    start_address: clonePointer(src.start_address),
    return_address: clonePointer(src.return_address),
  };
}

function readByte(ptr: BytePointer): number {
  const value = ptr.data[ptr.offset] ?? 0;
  ptr.offset += 1;
  return value;
}

function getSample(base: BytePointer, sampleId: number): StrucSample {
  const offset = base.offset + sampleId * 24;
  const data = base.data;
  return {
    reg20_op1: data[offset] ?? 0,
    reg20_op2: data[offset + 1] ?? 0,
    reg40_op1: data[offset + 2] ?? 0,
    reg40_op2: data[offset + 3] ?? 0,
    reg60_op1: data[offset + 4] ?? 0,
    reg60_op2: data[offset + 5] ?? 0,
    reg80_op1: data[offset + 6] ?? 0,
    reg80_op2: data[offset + 7] ?? 0,
    regE0_op1: data[offset + 8] ?? 0,
    regE0_op2: data[offset + 9] ?? 0,
    regC0: data[offset + 10] ?? 0,
  };
}

function transpose(reg: number, val: number): { value2: number; additionalReg: number; additionalValue: number } {
  let iChannel = -1;
  let iRegister = reg;
  let iValue = val;
  let additionalReg = -1;
  let additionalValue = 0;

  if ((iRegister >> 4 === 0xA) || (iRegister >> 4 === 0xB)) {
    iChannel = iRegister & 0x0f;
  }

  iFMReg[iRegister] = iValue;

  if (iChannel >= 0 && iChannel < 12) {
    const iBlock = (iFMReg[0xB0 + iChannel] >> 2) & 0x07;
    const iFNum = ((iFMReg[0xB0 + iChannel] & 0x03) << 8) | iFMReg[0xA0 + iChannel];
    const dbOriginalFreq = 49716.0 * iFNum / Math.pow(2, 20 - iBlock);
    let iNewBlock = iBlock;
    let iNewFNum: number;
    const calcFNum = () => (dbOriginalFreq + (dbOriginalFreq / 128.0)) / (49716.0 / Math.pow(2.0, 20 - iNewBlock));
    const dbNewFNum = calcFNum();

    if (dbNewFNum > 1023 - 32) {
      if (iNewBlock > 6) {
        iNewBlock = iBlock;
        iNewFNum = iFNum;
      } else {
        iNewBlock += 1;
        iNewFNum = Math.trunc(calcFNum());
      }
    } else if (dbNewFNum < 32) {
      if (iNewBlock === 0) {
        iNewBlock = iBlock;
        iNewFNum = iFNum;
      } else {
        iNewBlock -= 1;
        iNewFNum = Math.trunc(calcFNum());
      }
    } else {
      iNewFNum = Math.trunc(dbNewFNum);
    }

    if (iNewFNum > 1023) {
      iNewBlock = iBlock;
      iNewFNum = iFNum;
    }

    if (iRegister >= 0xB0 && iRegister <= 0xBC) {
      iValue = (iValue & ~0x1f) | (iNewBlock << 2) | ((iNewFNum >> 8) & 0x03);
      iCurrentTweakedBlock[iChannel] = iNewBlock;
      iCurrentFNum[iChannel] = iNewFNum;
      if (iTweakedFMReg[0xA0 + iChannel] !== (iNewFNum & 0xff)) {
        additionalReg = 0xA0 + iChannel;
        additionalValue = iNewFNum & 0xff;
        iTweakedFMReg[additionalReg] = additionalValue;
      }
    } else if (iRegister >= 0xA0 && iRegister <= 0xAC) {
      iValue = iNewFNum & 0xff;
      const iNewB0Value = (iFMReg[0xB0 + iChannel] & ~0x1f) | (iNewBlock << 2) | ((iNewFNum >> 8) & 0x03);
      if ((iNewB0Value & 0x20) && iTweakedFMReg[0xB0 + iChannel] !== iNewB0Value) {
        additionalReg = 0xB0 + iChannel;
        additionalValue = iNewB0Value;
        iTweakedFMReg[additionalReg] = additionalValue;
      }
    }
  }

  iTweakedFMReg[iRegister] = iValue;
  return { value2: iValue, additionalReg, additionalValue };
}

function adlibReg(i: number, v: number): void {
  const primary = opl[0];
  const secondary = opl[1];
  if (!primary || !secondary) {
    return;
  }
  const transposed = transpose(i, v);
  const v2 = transposed.value2;
  OPLWrite(primary, 0, i);
  OPLWrite(primary, 1, v);
  OPLWrite(secondary, 0, i);
  let second = v2;
  if (i >= 0x20 && i <= 0x3f) {
    second &= 0x3f;
  }
  if (i >= 0xE0 && i <= 0xFC) {
    if ((slot_array[i & 0x1f] & 1) === 1) {
      second &= 0x02;
    }
  }
  OPLWrite(secondary, 1, second);
  if (transposed.additionalReg !== -1) {
    OPLWrite(secondary, 0, transposed.additionalReg);
    OPLWrite(secondary, 1, transposed.additionalValue);
  }
}

function adlibInit(): void {
  for (let i = 1; i < 0xf5; i += 1) {
    adlibReg(i, 0);
  }
  adlibReg(0x04, 0x60);
  adlibReg(0x04, 0x80);
  adlibReg(0x01, 0x20);
  adlibReg(0xa8, 0x01);
  adlibReg(0x08, 0x40);
  adlibReg(0xbd, 0xC0);
}

function adlibSetAmplitude(channel: number, value: number): void {
  adlibReg(0x43 + adl_gv_operators1[channel], (~(value >> 1)) & 0x3f);
}

function clearChannels(): void {
  for (const channel of adlib_channels) {
    channel.cur_sample = 0xff;
    channel.cur_note = 0;
  }
}

function adlibResetChannels(): void {
  clearChannels();
  for (let i = 0; i < 12; i += 1) {
    adlibReg(0xB0 + i, 0);
    adlibSetAmplitude(i, 0);
  }
}

function getPitchedFreqInstr(note: number, instrument: number): number {
  const pitch = instruments[instrument].cur_pitchbend;
  if (pitch === 0) {
    return adl_gv_freq_table[note] ?? 0;
  }
  if (pitch > 0) {
    return (adl_gv_freq_table[note] ?? 0) + ((adl_gv_detune_table[note] ?? 0) * pitch);
  }
  return (adl_gv_freq_table[note] ?? 0) + ((adl_gv_detune_table[Math.max(note - 1, 0)] ?? 0) * pitch);
}

function adlibSetInstrumentPitch(instrument: number, pitch: number): void {
  instruments[instrument].cur_pitchbend = pitch;
  for (let i = 0; i < 12; i += 1) {
    const note = adlib_channels[i].cur_note;
    if (note !== 0 && adlib_channels[i].cur_instrument === instrument) {
      const freq = getPitchedFreqInstr(note, instrument);
      adlib_channels[i].cur_freq = freq;
      adlibReg(0xA0 + i, freq & 0xff);
      const hf = ((freq >> 8) & 0x03) | (adl_gv_octave_table[note] << 2);
      adlib_channels[i].hifreq = hf;
      adlibReg(0xB0 + i, hf | 0x20);
    }
  }
}

function adlibGetUnusedChannel(sampleId: number, sameSample: { value: boolean }): number {
  let maxchan = 0;
  let maxdur = 0;
  for (let i = 0; i < 12; i += 1) {
    adlib_channels[i].duration += 1;
  }
  for (let i = 0; i < 12; i += 1) {
    if (adlib_channels[i].duration > maxdur) {
      maxdur = adlib_channels[i].duration;
      maxchan = i;
    }
    if (adlib_channels[i].cur_note === 0) {
      maxchan = i;
      break;
    }
  }
  sameSample.value = adlib_channels[maxchan].cur_sample === sampleId;
  if (!sameSample.value) {
    adlib_channels[maxchan].cur_sample = sampleId;
  }
  adlib_channels[maxchan].duration = 0;
  return maxchan;
}

function adlibPlayNote(note: number, volume: number, instrument: number): void {
  const sampleId = instruments[instrument].sample_id;
  const sameSample = { value: false };
  let curSample: StrucSample;
  curSample = getSample(adl_gv_samples_addr ?? { data: new Uint8Array(0), offset: 0 }, sampleId);
  note -= 1;
  if (volume === 0) {
    for (let i = 0; i < 12; i += 1) {
      if (adlib_channels[i].cur_note === note && adlib_channels[i].cur_instrument === instrument) {
        adlib_channels[i].cur_note = 0;
        adlibReg(0xB0 + i, adlib_channels[i].hifreq);
      }
    }
    return;
  }
  if (volume > 127) {
    volume = 127;
  }
  const channel = adlibGetUnusedChannel(sampleId, sameSample);
  adlib_channels[channel].cur_volume = volume;
  adlib_channels[channel].cur_note = note;
  adlib_channels[channel].cur_instrument = instrument;
  const op1 = adl_gv_operators1[channel];
  if (!sameSample.value) {
    adlibReg(0x20 + op1, curSample.reg20_op1);
    adlibReg(0x23 + op1, curSample.reg20_op2);
    const ampl = curSample.reg40_op1;
    adlibReg(0x40 + op1, ((~ampl) & 0x3f) | (ampl & 0xc0));
  }
  adlibReg(0xB0 + channel, adlib_channels[channel].hifreq);
  adlibReg(0x43 + op1, (~((adl_gv_tmp_music_volume * volume) >> 8)) & 0x3f);
  if (!sameSample.value) {
    adlibReg(0x60 + op1, curSample.reg60_op1);
    adlibReg(0x63 + op1, curSample.reg60_op2);
    adlibReg(0x80 + op1, curSample.reg80_op1);
    adlibReg(0x83 + op1, curSample.reg80_op2);
    adlibReg(0xE0 + op1, curSample.regE0_op1);
    adlibReg(0xE3 + op1, curSample.regE0_op2);
    adlibReg(0xC0 + channel, curSample.regC0 ^ 0x01);
  }
  const freq = getPitchedFreqInstr(note, instrument);
  adlib_channels[channel].cur_freq = freq;
  adlibReg(0xA0 + channel, freq & 0xff);
  const hf = (freq >> 8) | (adl_gv_octave_table[note] << 2);
  adlib_channels[channel].hifreq = hf;
  adlibReg(0xB0 + channel, hf | 0x20);
}

function getNumSeq(musPtr: BytePointer): number {
  let c = 0;
  let v = 0;
  do {
    c = readByte(musPtr);
    v = (v << 7) + (c & 0x7f);
  } while (c & 0x80);
  return v;
}

export function func_mute(): void {
  adl_gv_polyphony_level = 0;
  adl_gv_music_playing = false;
  adlibResetChannels();
}

function fadeVolumeIfNeed(): void {
  if (!adl_gv_want_fade) {
    return;
  }
  adl_gv_tmp_music_volume -= 1;
  if (adl_gv_tmp_music_volume === 0) {
    func_mute();
    adl_gv_want_fade = false;
    adl_gv_tmp_music_volume = adl_gv_master_music_volume;
    return;
  }
  for (let i = 0; i < 12; i += 1) {
    adlibSetAmplitude(i, (adlib_channels[i].cur_volume * adl_gv_tmp_music_volume) >> 7);
  }
}

function freeChannelAvailable(): boolean {
  for (let i = 0; i < 12; i += 1) {
    if (adlib_channels[i].cur_note === 0) {
      return true;
    }
  }
  return false;
}

function decodeOp(instrument: number, anotherLoop: { value: boolean }): number {
  const instr1 = instruments[instrument];
  let instr2: StrucInstruments | undefined;
  let musicPtr = instr1.cur_address;
  let opcode = 0;
  let arg1 = 0;
  let arg2 = 0;
  let delay = 0;

  if (!musicPtr) {
    return 0;
  }

  do {
    opcode = readByte(musicPtr);
    if (opcode === 0xfe) {
      arg1 = readByte(musicPtr);
      instr1.return_address = { data: musicPtr.data, offset: musicPtr.offset };
      musicPtr = adl_gv_subtracks[arg1] ?? musicPtr;
    } else if (opcode === 0xfd) {
      if (instr1.return_address) {
        musicPtr = instr1.return_address;
        instr1.return_address = null;
      }
    } else if (opcode === 0xff) {
      adl_gv_music_playing = false;
      delay = 0;
      break;
    } else if (opcode >= 0x80) {
      instr1.prev_cmd = opcode;
      opcode = readByte(musicPtr);
    }

    if (opcode < 0x80) {
      arg1 = opcode;
      opcode = instr1.prev_cmd;
      switch (opcode & 0xf0) {
        case 0x80:
          arg2 = readByte(musicPtr);
          adlibPlayNote(arg1, 0, instrument);
          adl_gv_polyphony_level -= 1;
          if (adl_gv_chorus_instruments[instrument] !== 0) {
            adlibPlayNote(arg1, 0, adl_gv_chorus_instruments[instrument]);
            adl_gv_polyphony_level -= 1;
          }
          break;
        case 0x90:
          arg2 = readByte(musicPtr);
          if (arg2 === 0) {
            adlibPlayNote(arg1, 0, instrument);
            adl_gv_polyphony_level -= 1;
            if (adl_gv_chorus_instruments[instrument] !== 0) {
              adlibPlayNote(arg1, 0, adl_gv_chorus_instruments[instrument]);
              adl_gv_polyphony_level -= 1;
            }
          } else {
            const vol = (arg2 * instr1.volume) >> 7;
            if (adl_gv_chorus_instruments[instrument] !== 0) {
              if (freeChannelAvailable()) {
                instr2 = instruments[adl_gv_chorus_instruments[instrument]];
                instr2.sample_id = instr1.sample_id;
                instr2.cur_pitchbend = instr1.cur_pitchbend - 1;
                adlibPlayNote(arg1, vol, adl_gv_chorus_instruments[instrument]);
              }
              adl_gv_polyphony_level += 1;
            }
            adlibPlayNote(arg1, vol, instrument);
            adl_gv_polyphony_level += 1;
          }
          break;
        case 0xb0:
          arg2 = readByte(musicPtr);
          if (arg1 === 0 && arg2 !== 0) {
            adl_gv_tempo = arg2 * 0.8;
          } else if (arg1 === 7) {
            instr1.volume = arg2;
          } else if (arg1 === 0x7e) {
            adl_gv_chorus_instruments[instrument] = arg2 - 1;
          } else if (arg1 === 0x7f) {
            adl_gv_chorus_instruments[instrument] = 0;
          }
          break;
        case 0xc0:
          if (arg1 === 0x7e) {
            anotherLoop.value = true;
          } else {
            instr1.sample_id = arg1;
          }
          break;
        case 0xe0:
          instr1.cur_pitchbend = arg1 - 16;
          adlibSetInstrumentPitch(instrument, arg1 - 16);
          if (adl_gv_chorus_instruments[instrument] !== 0) {
            adlibSetInstrumentPitch(adl_gv_chorus_instruments[instrument], arg1 - 17);
          }
          break;
      }
    }
    delay = getNumSeq(musicPtr);
  } while (delay === 0);
  instr1.cur_address = musicPtr;
  return delay;
}

function initMusicData(musicPtr: Uint8Array, length: number): void {
  let i = 0;
  let toAdd = 0;
  let j = 0;
  for (i = 0; i < 16; i += 1) {
    instruments[i].start_address = null;
  }
  adl_gv_subtracks_count = 0;
  i = musicPtr[0] ?? 0;
  adl_gv_FORMAT = i > 56 ? 0 : 1;
  let cursor: BytePointer = { data: musicPtr, offset: 0 };
  if (adl_gv_FORMAT === 1) {
    cursor.offset += (musicPtr[0] ?? 0) + 1;
  }
  adl_gv_tempo = readByte(cursor);
  adl_gv_samples_addr = { data: musicPtr, offset: cursor.offset + 1 };
  cursor.offset += ((musicPtr[cursor.offset] ?? 0) * 24) + 1;
  adl_gv_subtracks_count = readByte(cursor);
  for (i = 0; i < adl_gv_subtracks_count; i += 1) {
    toAdd = peekU16(cursor);
    adl_gv_subtracks[i] = { data: cursor.data, offset: cursor.offset + 4 };
    cursor.offset += toAdd;
  }
  adl_gv_instruments_count = readByte(cursor);
  for (i = 0; i < adl_gv_instruments_count; i += 1) {
    toAdd = peekU16(cursor);
    if (adl_gv_FORMAT === 1) {
      j = cursor.data[cursor.offset + 4] ?? 0;
      if (j > 15) j = 15;
      instruments[j].start_address = { data: cursor.data, offset: cursor.offset + 5 };
    } else {
      j = i;
      instruments[j].start_address = { data: cursor.data, offset: cursor.offset + 4 };
    }
    cursor.offset += toAdd;
    if (cursor.offset >= length) {
      break;
    }
  }
}

function initMusic(): void {
  for (let i = 0; i < 16; i += 1) {
    instruments[i].cur_pitchbend = 0;
    adl_gv_chorus_instruments[i] = 0;
    const startAddress = instruments[i].start_address;
    if (startAddress) {
      const curAddress = { data: startAddress.data, offset: startAddress.offset };
      instruments[i].cur_address = curAddress;
      instruments[i].cur_delay = getNumSeq(curAddress);
    } else {
      instruments[i].cur_address = null;
      instruments[i].cur_delay = 0;
    }
  }
}

export function func_save_music_state(i: number): void {
  for (let j = 0; j < instruments.length; j += 1) {
    saved_instruments[i][j] = cloneInstrument(instruments[j]);
  }
}

export function func_load_music_state(i: number): void {
  adlibResetChannels();
  for (let j = 0; j < instruments.length; j += 1) {
    instruments[j] = cloneInstrument(saved_instruments[i][j]);
  }
}

export function func_play_tick(): void {
  if (!adl_gv_music_playing) {
    return;
  }
  fadeVolumeIfNeed();
  adl_gv_tempo_run -= adl_gv_tempo;
  if (adl_gv_tempo_run > 0) {
    return;
  }
  adl_gv_tempo_run += adl_gv_tempo_inc;
  do {
    let anotherLoop = { value: false };
    for (let i = 0; i < 16; i += 1) {
      const instr = adl_gv_instr_order[i];
      if (!instruments[instr].cur_address) {
        continue;
      }
      if (instruments[instr].cur_delay === 0) {
        instruments[instr].cur_delay = decodeOp(instr, anotherLoop);
        if (!adl_gv_music_playing) {
          break;
        }
      }
      instruments[instr].cur_delay -= 1;
    }
    if (!anotherLoop.value && adl_gv_music_playing) {
      break;
    }
    initMusic();
    clearChannels();
  } while (true);
}

export function func_setup_music(musicPtr: Uint8Array, length: number): void {
  adl_gv_music_playing = false;
  func_mute();
  adl_gv_polyphony_level = 0;
  adl_gv_want_fade = false;
  adl_gv_tmp_music_volume = adl_gv_master_music_volume;
  initMusicData(musicPtr, length);
  initMusic();
  if (!opl[0]) {
    opl[0] = OPLCreate(0, 3579545, 44100);
  }
  if (!opl[1]) {
    opl[1] = OPLCreate(0, 3579545, 44100);
  }
  adlibInit();
  adlibResetChannels();
  adl_gv_tempo *= 0.4;
  adl_gv_tempo_run = adl_gv_tempo;
  adl_gv_music_playing = true;
}

export function func_fade(): void {
  if (adl_gv_tmp_music_volume === 0) {
    func_mute();
  } else {
    adl_gv_want_fade = true;
  }
}

export function func_is_music_playing(): boolean {
  return adl_gv_music_playing;
}

export function func_set_music_tempo(value: number): void {
  adl_gv_tempo_inc = value;
}

export function func_set_music_volume(value: number): void {
  adl_gv_master_music_volume = value;
  adl_gv_tmp_music_volume = adl_gv_master_music_volume;
  for (let i = 0; i < 12; i += 1) {
    adlibSetAmplitude(i, (adlib_channels[i].cur_volume * adl_gv_tmp_music_volume) >> 7);
  }
}

export function func_get_polyphony(): number {
  return adl_gv_polyphony_level;
}
