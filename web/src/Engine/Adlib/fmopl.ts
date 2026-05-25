/*
 * Source-shaped TypeScript translation of src/Engine/Adlib/fmopl.h/.cpp.
 * The register state and YM3812 mixer are translated from the original
 * MAME-derived OpenXcom source; browser audio output is handled by callers.
 */

export type UINT8 = number;
export type UINT16 = number;
export type UINT32 = number;
export type INT8 = number;
export type INT16 = number;
export type INT32 = number;
export type OPLSAMPLE = number;

export type OPL_TIMERHANDLER = (channel: number, intervalSec: number) => void;
export type OPL_IRQHANDLER = (param: number, irq: number) => void;
export type OPL_UPDATEHANDLER = (param: number, minIntervalUs: number) => void;
export type OPL_PORTHANDLER_W = (param: number, data: number) => void;
export type OPL_PORTHANDLER_R = (param: number) => number;

export const OPL_TYPE_WAVESEL = 0x01;
export const OPL_TYPE_ADPCM = 0x02;
export const OPL_TYPE_KEYBOARD = 0x04;
export const OPL_TYPE_IO = 0x08;

export const OPL_TYPE_YM3526 = 0;
export const OPL_TYPE_YM3812 = OPL_TYPE_WAVESEL;
export const OPL_TYPE_Y8950 = OPL_TYPE_ADPCM | OPL_TYPE_KEYBOARD | OPL_TYPE_IO;

export interface OPL_SLOT {
  TL: INT32;
  TLL: INT32;
  KSR: UINT8;
  AR: Int32Array;
  DR: Int32Array;
  SL: INT32;
  RR: Int32Array;
  ksl: UINT8;
  ksr: UINT8;
  mul: UINT32;
  Cnt: UINT32;
  Incr: UINT32;
  eg_typ: UINT8;
  evm: UINT8;
  evc: INT32;
  eve: INT32;
  evs: INT32;
  evsa: INT32;
  evsd: INT32;
  evsr: INT32;
  ams: UINT8;
  vib: UINT8;
  wavetable: Int32Array;
}

export interface OPL_CH {
  SLOT: [OPL_SLOT, OPL_SLOT];
  CON: UINT8;
  FB: UINT8;
  connect1: INT32[] | null;
  connect2: INT32[] | null;
  op1_out: [INT32, INT32];
  block_fnum: UINT32;
  kcode: UINT8;
  fc: UINT32;
  ksl_base: UINT32;
  keyon: UINT8;
}

export interface FM_OPL {
  type: UINT8;
  clock: number;
  rate: number;
  freqbase: number;
  TimerBase: number;
  address: UINT8;
  status: UINT8;
  statusmask: UINT8;
  mode: UINT8;
  T: [number, number];
  st: [UINT8, UINT8];
  P_CH: OPL_CH[];
  max_ch: number;
  rythm: UINT8;
  portDirection: UINT8;
  portLatch: UINT8;
  porthandler_r: OPL_PORTHANDLER_R | null;
  porthandler_w: OPL_PORTHANDLER_W | null;
  port_param: number;
  keyboardhandler_r: OPL_PORTHANDLER_R | null;
  keyboardhandler_w: OPL_PORTHANDLER_W | null;
  keyboard_param: number;
  AR_TABLE: Int32Array;
  DR_TABLE: Int32Array;
  FN_TABLE: Uint32Array;
  ams_table: Int32Array;
  vib_table: Int32Array;
  amsCnt: INT32;
  amsIncr: INT32;
  vibCnt: INT32;
  vibIncr: INT32;
  wavesel: UINT8;
  TimerHandler: OPL_TIMERHANDLER | null;
  TimerParam: number;
  IRQHandler: OPL_IRQHANDLER | null;
  IRQParam: number;
  UpdateHandler: OPL_UPDATEHANDLER | null;
  UpdateParam: number;
  deltat?: never;
}

const PI = Math.PI;
const FREQ_BITS = 24;
const FREQ_RATE = 1 << (FREQ_BITS - 20);
const TL_BITS = FREQ_BITS + 2;
const OPL_OUTSB = TL_BITS + 1 - 16;
const OPL_MAXOUT = 0x7fff << OPL_OUTSB;
const OPL_MINOUT = -(0x8000 << OPL_OUTSB);
const SIN_ENT = 2048;
const ENV_BITS = 16;
const EG_ENT = 4096;
const EG_OFF = (2 * EG_ENT) << ENV_BITS;
const EG_DED = EG_OFF;
const EG_DST = EG_ENT << ENV_BITS;
const EG_AED = EG_DST;
const EG_AST = 0;
const EG_STEP = 96.0 / EG_ENT;
const VIB_ENT = 512;
const VIB_SHIFT = 32 - 9;
const AMS_ENT = 512;
const AMS_SHIFT = 32 - 9;
const VIB_RATE = 256;
const SLOT1 = 0;
const SLOT2 = 1;
const LOG_LEVEL = 3;
const ENV_MOD_RR = 0x00;
const ENV_MOD_DR = 0x01;
const ENV_MOD_AR = 0x02;
const TL_MAX = EG_ENT * 2;
const WHITE_NOISE_DB = 6.0;

const slotArray = new Int8Array([
  0, 2, 4, 1, 3, 5, -1, -1,
  6, 8, 10, 7, 9, 11, -1, -1,
  12, 14, 16, 13, 15, 17, -1, -1,
  18, 20, 22, 19, 21, 23, -1, -1,
]);

const KSL_TABLE = new Uint32Array([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 72, 96, 120, 144, 168, 192,
  0, 0, 0, 0, 0, 72, 120, 168, 192, 240, 264, 288, 312, 336, 360, 384,
  0, 0, 0, 120, 192, 264, 312, 360, 384, 432, 456, 480, 504, 528, 552, 576,
  0, 0, 192, 312, 384, 456, 504, 552, 576, 624, 648, 672, 696, 720, 744, 768,
  0, 192, 384, 504, 576, 648, 696, 744, 768, 816, 840, 864, 888, 912, 936, 960,
  0, 384, 576, 696, 768, 840, 888, 936, 960, 1008, 1032, 1056, 1080, 1104, 1128, 1152,
  0, 576, 768, 888, 960, 1032, 1080, 1128, 1152, 1200, 1224, 1248, 1272, 1296, 1320, 1344,
]);

const MUL_TABLE = new Uint32Array([
  1, 2, 4, 6, 8, 10, 12, 14,
  16, 18, 20, 20, 24, 24, 30, 30,
]);

const SL_TABLE = new Int32Array([
  0, 1, 2, 3, 4, 5, 6, 7,
  8, 9, 10, 11, 12, 13, 14, 31,
].map(db => Math.trunc(db * ((3 / EG_STEP) * (1 << ENV_BITS)) + EG_DST)));
const RATE_0 = new Int32Array(16);
const TL_TABLE = new Int32Array(TL_MAX * 2);
const SIN_TABLE = new Int32Array(SIN_ENT * 4);
const ENV_CURVE = new Int32Array(2 * EG_ENT + 1);
const AMS_TABLE = new Int32Array(AMS_ENT * 2);
const VIB_TABLE = new Int32Array(VIB_ENT * 2);
let tablesInitialized = false;
let curChip: FM_OPL | null = null;
const outd = new Int32Array(1);
let ams = 0;
let vib = 0;
let feedback2 = 0;

function ensureCommonTables(): void {
  if (tablesInitialized) {
    return;
  }
  tablesInitialized = true;
  for (let t = 0; t < EG_ENT - 1; t += 1) {
    const rate = ((1 << TL_BITS) - 1) / Math.pow(10, EG_STEP * t / 20);
    TL_TABLE[t] = Math.trunc(rate);
    TL_TABLE[TL_MAX + t] = -TL_TABLE[t];
  }
  for (let t = EG_ENT - 1; t < TL_MAX; t += 1) {
    TL_TABLE[t] = 0;
    TL_TABLE[TL_MAX + t] = 0;
  }

  SIN_TABLE[0] = EG_ENT - 1;
  SIN_TABLE[SIN_ENT / 2] = EG_ENT - 1;
  for (let s = 1; s <= SIN_ENT / 4; s += 1) {
    const pom = 20 * Math.log10(1 / Math.sin(2 * PI * s / SIN_ENT));
    const j = Math.trunc(pom / EG_STEP);
    SIN_TABLE[s] = j;
    SIN_TABLE[SIN_ENT / 2 - s] = j;
    SIN_TABLE[SIN_ENT / 2 + s] = TL_MAX + j;
    SIN_TABLE[SIN_ENT - s] = TL_MAX + j;
  }
  for (let s = 0; s < SIN_ENT; s += 1) {
    SIN_TABLE[SIN_ENT + s] = s < SIN_ENT / 2 ? SIN_TABLE[s] : EG_ENT;
    SIN_TABLE[SIN_ENT * 2 + s] = SIN_TABLE[s % (SIN_ENT / 2)];
    SIN_TABLE[SIN_ENT * 3 + s] = ((s / (SIN_ENT / 4)) & 1) ? EG_ENT : SIN_TABLE[SIN_ENT * 2 + s];
  }

  for (let i = 0; i < EG_ENT; i += 1) {
    ENV_CURVE[i] = Math.trunc(Math.pow((EG_ENT - 1 - i) / EG_ENT, 8) * EG_ENT);
    ENV_CURVE[(EG_DST >> ENV_BITS) + i] = i;
  }
  ENV_CURVE[EG_OFF >> ENV_BITS] = EG_ENT - 1;

  for (let i = 0; i < AMS_ENT; i += 1) {
    const pom = (1.0 + Math.sin(2 * PI * i / AMS_ENT)) / 2;
    AMS_TABLE[i] = Math.trunc((1.0 / EG_STEP) * pom);
    AMS_TABLE[AMS_ENT + i] = Math.trunc((4.8 / EG_STEP) * pom);
  }
  for (let i = 0; i < VIB_ENT; i += 1) {
    const pom = VIB_RATE * 0.06 * Math.sin(2 * PI * i / VIB_ENT);
    VIB_TABLE[i] = Math.trunc(VIB_RATE + (pom * 0.07));
    VIB_TABLE[VIB_ENT + i] = Math.trunc(VIB_RATE + (pom * 0.14));
  }
}

function createSlot(): OPL_SLOT {
  ensureCommonTables();
  return {
    TL: 0,
    TLL: 0,
    KSR: 0,
    AR: RATE_0,
    DR: RATE_0,
    SL: 0,
    RR: RATE_0,
    ksl: 31,
    ksr: 0,
    mul: 1,
    Cnt: 0,
    Incr: 0,
    eg_typ: 0,
    evm: 0,
    evc: EG_OFF,
    eve: EG_OFF + 1,
    evs: 0,
    evsa: 0,
    evsd: 0,
    evsr: 0,
    ams: 0,
    vib: 0,
    wavetable: SIN_TABLE.subarray(0, SIN_ENT),
  };
}

function createChannel(): OPL_CH {
  return {
    SLOT: [createSlot(), createSlot()],
    CON: 0,
    FB: 0,
    connect1: null,
    connect2: null,
    op1_out: [0, 0],
    block_fnum: 0,
    kcode: 0,
    fc: 0,
    ksl_base: 0,
    keyon: 0,
  };
}

function createOpl(type: number, clock: number, rate: number, maxCh = 12): FM_OPL {
  const ch = Array.from({ length: maxCh }, () => createChannel());
  return {
    type,
    clock,
    rate,
    freqbase: 0,
    TimerBase: 0,
    address: 0,
    status: 0,
    statusmask: 0,
    mode: 0,
    T: [0, 0],
    st: [0, 0],
    P_CH: ch,
    max_ch: maxCh,
    rythm: 0,
    portDirection: 0,
    portLatch: 0,
    porthandler_r: null,
    porthandler_w: null,
    port_param: 0,
    keyboardhandler_r: null,
    keyboardhandler_w: null,
    keyboard_param: 0,
    AR_TABLE: new Int32Array(75),
    DR_TABLE: new Int32Array(75),
    FN_TABLE: new Uint32Array(1024),
    ams_table: AMS_TABLE.subarray(0, AMS_ENT),
    vib_table: VIB_TABLE.subarray(0, VIB_ENT),
    amsCnt: 0,
    amsIncr: 0,
    vibCnt: 0,
    vibIncr: 0,
    wavesel: 0,
    TimerHandler: null,
    TimerParam: 0,
    IRQHandler: null,
    IRQParam: 0,
    UpdateHandler: null,
    UpdateParam: 0,
  };
}

function limit(val: number, max: number, min: number): number {
  if (val > max) {
    return max;
  }
  if (val < min) {
    return min;
  }
  return val;
}

function oplStatusSet(opl: FM_OPL, flag: number): void {
  opl.status |= flag;
  if (!(opl.status & 0x80) && (opl.status & opl.statusmask)) {
    opl.status |= 0x80;
    opl.IRQHandler?.(opl.IRQParam, 1);
  }
}

function oplStatusReset(opl: FM_OPL, flag: number): void {
  opl.status &= ~flag;
  if (opl.status & 0x80) {
    if (!(opl.status & opl.statusmask)) {
      opl.status &= 0x7f;
      opl.IRQHandler?.(opl.IRQParam, 0);
    }
  }
}

function oplStatusMaskSet(opl: FM_OPL, flag: number): void {
  opl.statusmask = flag;
  oplStatusSet(opl, 0);
  oplStatusReset(opl, 0);
}

function oplKeyOn(slot: OPL_SLOT): void {
  slot.Cnt = 0;
  slot.evm = ENV_MOD_AR;
  slot.evs = slot.evsa;
  slot.evc = EG_AST;
  slot.eve = EG_AED;
}

function oplKeyOff(slot: OPL_SLOT): void {
  if (slot.evm > ENV_MOD_RR) {
    slot.evm = ENV_MOD_RR;
    if (!(slot.evc & EG_DST)) {
      slot.evc = (ENV_CURVE[slot.evc >> ENV_BITS] << ENV_BITS) + EG_DST;
    }
    slot.eve = EG_DED;
    slot.evs = slot.evsr;
  }
}

function oplCalcSlot(slot: OPL_SLOT): number {
  if ((slot.evc += slot.evs) >= slot.eve) {
    switch (slot.evm) {
      case ENV_MOD_AR:
        slot.evm = ENV_MOD_DR;
        slot.evc = EG_DST;
        slot.eve = slot.SL;
        slot.evs = slot.evsd;
        break;
      case ENV_MOD_DR:
        slot.evc = slot.SL;
        slot.eve = EG_DED;
        if (slot.eg_typ) {
          slot.evs = 0;
        } else {
          slot.evm = ENV_MOD_RR;
          slot.evs = slot.evsr;
        }
        break;
      case ENV_MOD_RR:
        slot.evc = EG_OFF;
        slot.eve = EG_OFF + 1;
        slot.evs = 0;
        break;
    }
  }
  return slot.TLL + ENV_CURVE[slot.evc >> ENV_BITS] + (slot.ams ? ams : 0);
}

function setAlgorithm(ch: OPL_CH): void {
  ch.connect1 = null;
  ch.connect2 = null;
}

function opOut(slot: OPL_SLOT, env: number, con: number): number {
  const phase = Math.trunc(((slot.Cnt + con) >>> 0) / (0x1000000 / SIN_ENT)) & (SIN_ENT - 1);
  const base = slot.wavetable[phase] ?? EG_ENT - 1;
  return TL_TABLE[base + Math.trunc(env)] ?? 0;
}

function advanceSlot(slot: OPL_SLOT, multiplier = 1): void {
  const incr = slot.vib
    ? Math.trunc(multiplier * slot.Incr * vib / VIB_RATE)
    : Math.trunc(multiplier * slot.Incr);
  slot.Cnt = (slot.Cnt + incr) >>> 0;
}

function oplCalcCh(ch: OPL_CH): void {
  feedback2 = 0;
  let slot = ch.SLOT[SLOT1];
  let envOut = oplCalcSlot(slot);
  if (envOut < EG_ENT - 1) {
    advanceSlot(slot);
    if (ch.FB) {
      const feedback1 = (ch.op1_out[0] + ch.op1_out[1]) >> ch.FB;
      ch.op1_out[1] = ch.op1_out[0];
      ch.op1_out[0] = opOut(slot, envOut, feedback1);
      if (ch.CON) {
        outd[0] += ch.op1_out[0];
      } else {
        feedback2 += ch.op1_out[0];
      }
    } else {
      const value = opOut(slot, envOut, 0);
      if (ch.CON) {
        outd[0] += value;
      } else {
        feedback2 += value;
      }
    }
  } else {
    ch.op1_out[1] = ch.op1_out[0];
    ch.op1_out[0] = 0;
  }

  slot = ch.SLOT[SLOT2];
  envOut = oplCalcSlot(slot);
  if (envOut < EG_ENT - 1) {
    advanceSlot(slot);
    outd[0] += opOut(slot, envOut, feedback2);
  }
}

function oplCalcRh(channels: OPL_CH[]): void {
  const whitenoise = (Math.random() < 0.5 ? 0 : Math.trunc(WHITE_NOISE_DB / EG_STEP));
  feedback2 = 0;
  let slot = channels[6].SLOT[SLOT1];
  let envOut = oplCalcSlot(slot);
  if (envOut < EG_ENT - 1) {
    advanceSlot(slot);
    if (channels[6].FB) {
      const feedback1 = (channels[6].op1_out[0] + channels[6].op1_out[1]) >> channels[6].FB;
      channels[6].op1_out[1] = channels[6].op1_out[0];
      feedback2 = channels[6].op1_out[0] = opOut(slot, envOut, feedback1);
    } else {
      feedback2 = opOut(slot, envOut, 0);
    }
  } else {
    feedback2 = 0;
    channels[6].op1_out[1] = channels[6].op1_out[0];
    channels[6].op1_out[0] = 0;
  }

  slot = channels[6].SLOT[SLOT2];
  envOut = oplCalcSlot(slot);
  if (envOut < EG_ENT - 1) {
    advanceSlot(slot);
    outd[0] += opOut(slot, envOut, feedback2) * 2;
  }

  const slot7_1 = channels[7].SLOT[SLOT1];
  const slot7_2 = channels[7].SLOT[SLOT2];
  const slot8_1 = channels[8].SLOT[SLOT1];
  const slot8_2 = channels[8].SLOT[SLOT2];
  const envSd = oplCalcSlot(slot7_2) + whitenoise;
  const envTam = oplCalcSlot(slot8_1);
  const envTop = oplCalcSlot(slot8_2);
  const envHh = oplCalcSlot(slot7_1) + whitenoise;

  advanceSlot(slot7_1, 2);
  slot7_2.Cnt = (slot7_2.Cnt + (slot7_2.vib
    ? Math.trunc((channels[7].fc * 8) * vib / VIB_RATE)
    : Math.trunc(channels[7].fc * 8))) >>> 0;
  advanceSlot(slot8_1);
  slot8_2.Cnt = (slot8_2.Cnt + (slot8_2.vib
    ? Math.trunc((channels[8].fc * 48) * vib / VIB_RATE)
    : Math.trunc(channels[8].fc * 48))) >>> 0;

  const tone8 = opOut(slot8_2, whitenoise, 0);
  if (envSd < EG_ENT - 1) outd[0] += opOut(slot7_1, envSd, 0) * 8;
  if (envTam < EG_ENT - 1) outd[0] += opOut(slot8_1, envTam, 0) * 2;
  if (envTop < EG_ENT - 1) outd[0] += opOut(slot7_2, envTop, tone8) * 2;
  if (envHh < EG_ENT - 1) outd[0] += opOut(slot7_2, envHh, tone8) * 2;
}

function calcFCSlot(ch: OPL_CH, slot: OPL_SLOT): void {
  const ksr = ch.kcode >> slot.KSR;
  slot.Incr = ch.fc * slot.mul;
  if (slot.ksr !== ksr) {
    slot.ksr = ksr;
    slot.evsa = slot.AR[ksr] ?? 0;
    slot.evsd = slot.DR[ksr] ?? 0;
    slot.evsr = slot.RR[ksr] ?? 0;
  }
  slot.TLL = slot.TL + (ch.ksl_base >> slot.ksl);
}

function setMul(opl: FM_OPL, slotIndex: number, value: number): void {
  const ch = opl.P_CH[slotIndex / 2 | 0];
  const slot = ch.SLOT[slotIndex & 1];
  slot.mul = MUL_TABLE[value & 0x0f] ?? 1;
  slot.KSR = (value & 0x10) ? 0 : 2;
  slot.eg_typ = (value & 0x20) >> 5;
  slot.vib = value & 0x40;
  slot.ams = value & 0x80;
  calcFCSlot(ch, slot);
}

function setKslTl(opl: FM_OPL, slotIndex: number, value: number): void {
  const ch = opl.P_CH[slotIndex / 2 | 0];
  const slot = ch.SLOT[slotIndex & 1];
  const ksl = value >> 6;
  slot.ksl = ksl ? 3 - ksl : 31;
  slot.TL = Math.trunc((value & 0x3f) * (0.75 / EG_STEP));
  if (!(opl.mode & 0x80)) {
    slot.TLL = slot.TL + (ch.ksl_base >> slot.ksl);
  }
}

function setArDr(opl: FM_OPL, slotIndex: number, value: number): void {
  const ch = opl.P_CH[slotIndex / 2 | 0];
  const slot = ch.SLOT[slotIndex & 1];
  const ar = value >> 4;
  const dr = value & 0x0f;
  slot.AR = ar ? opl.AR_TABLE.subarray(ar << 2) : RATE_0;
  slot.evsa = slot.AR[slot.ksr] ?? 0;
  if (slot.evm === ENV_MOD_AR) {
    slot.evs = slot.evsa;
  }
  slot.DR = dr ? opl.DR_TABLE.subarray(dr << 2) : RATE_0;
  slot.evsd = slot.DR[slot.ksr] ?? 0;
  if (slot.evm === ENV_MOD_DR) {
    slot.evs = slot.evsd;
  }
}

function setSlRr(opl: FM_OPL, slotIndex: number, value: number): void {
  const ch = opl.P_CH[slotIndex / 2 | 0];
  const slot = ch.SLOT[slotIndex & 1];
  const sl = value >> 4;
  const rr = value & 0x0f;
  slot.SL = SL_TABLE[sl] ?? EG_DED;
  if (slot.evm === ENV_MOD_DR) {
    slot.eve = slot.SL;
  }
  slot.RR = opl.DR_TABLE.subarray(rr << 2);
  slot.evsr = slot.RR[slot.ksr] ?? 0;
  if (slot.evm === ENV_MOD_RR) {
    slot.evs = slot.evsr;
  }
}

function csmKeyControl(ch: OPL_CH): void {
  const slot1 = ch.SLOT[SLOT1];
  const slot2 = ch.SLOT[SLOT2];
  oplKeyOff(slot1);
  oplKeyOff(slot2);
  slot1.TLL = slot1.TL + (ch.ksl_base >> slot1.ksl);
  slot1.TLL = slot1.TL + (ch.ksl_base >> slot1.ksl);
  ch.op1_out[0] = ch.op1_out[1] = 0;
  oplKeyOn(slot1);
  oplKeyOn(slot2);
}

function oplInitialize(opl: FM_OPL): void {
  ensureCommonTables();
  opl.freqbase = opl.rate ? (opl.clock / opl.rate) / 72 : 0;
  opl.TimerBase = 1.0 / (opl.clock / 72.0);
  for (let i = 0; i < 75; i += 1) {
    opl.AR_TABLE[i] = 0;
    opl.DR_TABLE[i] = 0;
  }
  for (let i = 4; i <= 60; i += 1) {
    let rate = opl.freqbase;
    if (i < 60) {
      rate *= 1.0 + (i & 3) * 0.25;
    }
    rate *= 1 << ((i >> 2) - 1);
    rate *= (EG_ENT << ENV_BITS);
    opl.AR_TABLE[i] = Math.trunc(rate / 141280);
    opl.DR_TABLE[i] = Math.trunc(rate / 1956000);
  }
  for (let i = 60; i < 75; i += 1) {
    opl.AR_TABLE[i] = EG_AED - 1;
    opl.DR_TABLE[i] = opl.DR_TABLE[60] ?? 0;
  }
  for (let fn = 0; fn < 1024; fn += 1) {
    opl.FN_TABLE[fn] = Math.trunc(opl.freqbase * fn * FREQ_RATE * (1 << 7) / 2);
  }
  opl.amsIncr = opl.rate ? Math.trunc((AMS_ENT * (1 << AMS_SHIFT) / opl.rate) * 3.7 * (opl.clock / 3600000)) : 0;
  opl.vibIncr = opl.rate ? Math.trunc((VIB_ENT * (1 << VIB_SHIFT) / opl.rate) * 6.4 * (opl.clock / 3600000)) : 0;
  opl.ams_table = AMS_TABLE.subarray(0, AMS_ENT);
  opl.vib_table = VIB_TABLE.subarray(0, VIB_ENT);
}

function oplWriteReg(opl: FM_OPL, r: number, v: number): void {
  let ch: OPL_CH | undefined;
  let slot: number;
  switch (r & 0xe0) {
    case 0x00:
      switch (r & 0x1f) {
        case 0x01:
          if (opl.type & OPL_TYPE_WAVESEL) {
            opl.wavesel = v & 0x20;
            if (!opl.wavesel) {
              for (let c = 0; c < opl.max_ch; c += 1) {
                opl.P_CH[c].SLOT[SLOT1].wavetable = SIN_TABLE.subarray(0, SIN_ENT);
                opl.P_CH[c].SLOT[SLOT2].wavetable = SIN_TABLE.subarray(0, SIN_ENT);
              }
            }
          }
          return;
        case 0x02:
          opl.T[0] = (256 - v) * 4;
          return;
        case 0x03:
          opl.T[1] = (256 - v) * 16;
          return;
        case 0x04:
          if (v & 0x80) {
            oplStatusReset(opl, 0x7f);
          } else {
            const st1 = v & 1;
            const st2 = (v >> 1) & 1;
            oplStatusReset(opl, v & 0x78);
            oplStatusMaskSet(opl, ((~v) & 0x78) | 0x01);
            if (opl.st[1] !== st2) {
              opl.st[1] = st2;
              opl.TimerHandler?.(opl.TimerParam + 1, st2 ? opl.T[1] * opl.TimerBase : 0);
            }
            if (opl.st[0] !== st1) {
              opl.st[0] = st1;
              opl.TimerHandler?.(opl.TimerParam + 0, st1 ? opl.T[0] * opl.TimerBase : 0);
            }
          }
          return;
      }
      break;
    case 0x20:
      slot = slotArray[r & 0x1f];
      if (slot === -1) {
        return;
      }
      setMul(opl, slot, v);
      return;
    case 0x40:
      slot = slotArray[r & 0x1f];
      if (slot === -1) {
        return;
      }
      setKslTl(opl, slot, v);
      return;
    case 0x60:
      slot = slotArray[r & 0x1f];
      if (slot === -1) {
        return;
      }
      setArDr(opl, slot, v);
      return;
    case 0x80:
      slot = slotArray[r & 0x1f];
      if (slot === -1) {
        return;
      }
      setSlRr(opl, slot, v);
      return;
    case 0xa0:
      if (r === 0xbd) {
        const rkey = opl.rythm ^ v;
        opl.ams_table = AMS_TABLE.subarray(v & 0x80 ? AMS_ENT : 0);
        opl.vib_table = VIB_TABLE.subarray(v & 0x40 ? VIB_ENT : 0);
        opl.rythm = v & 0x3f;
        if (opl.rythm & 0x20) {
          if (rkey & 0x10) {
            if (v & 0x10) {
              opl.P_CH[6].op1_out[0] = opl.P_CH[6].op1_out[1] = 0;
              oplKeyOn(opl.P_CH[6].SLOT[SLOT1]);
              oplKeyOn(opl.P_CH[6].SLOT[SLOT2]);
            } else {
              oplKeyOff(opl.P_CH[6].SLOT[SLOT1]);
              oplKeyOff(opl.P_CH[6].SLOT[SLOT2]);
            }
          }
          if (rkey & 0x08) {
            if (v & 0x08) oplKeyOn(opl.P_CH[7].SLOT[SLOT2]);
            else oplKeyOff(opl.P_CH[7].SLOT[SLOT2]);
          }
          if (rkey & 0x04) {
            if (v & 0x04) oplKeyOn(opl.P_CH[8].SLOT[SLOT1]);
            else oplKeyOff(opl.P_CH[8].SLOT[SLOT1]);
          }
          if (rkey & 0x02) {
            if (v & 0x02) oplKeyOn(opl.P_CH[8].SLOT[SLOT2]);
            else oplKeyOff(opl.P_CH[8].SLOT[SLOT2]);
          }
          if (rkey & 0x01) {
            if (v & 0x01) oplKeyOn(opl.P_CH[7].SLOT[SLOT1]);
            else oplKeyOff(opl.P_CH[7].SLOT[SLOT1]);
          }
        }
        return;
      }
      if ((r & 0x0f) > 11) {
        return;
      }
      ch = opl.P_CH[r & 0x0f];
      if (!(r & 0x10)) {
        ch.block_fnum = (ch.block_fnum & 0x1f00) | v;
      } else {
        const keyon = (v >> 5) & 1;
        const blockFnum = ((v & 0x1f) << 8) | (ch.block_fnum & 0xff);
        if (ch.keyon !== keyon) {
          ch.keyon = keyon;
          if (ch.keyon) {
            ch.op1_out[0] = ch.op1_out[1] = 0;
            oplKeyOn(ch.SLOT[SLOT1]);
            oplKeyOn(ch.SLOT[SLOT2]);
          } else {
            oplKeyOff(ch.SLOT[SLOT1]);
            oplKeyOff(ch.SLOT[SLOT2]);
          }
        }
        if (ch.block_fnum !== blockFnum) {
          ch.block_fnum = blockFnum;
          const blockRv = 7 - (blockFnum >> 10);
          const fnum = blockFnum & 0x3ff;
          ch.ksl_base = KSL_TABLE[blockFnum >> 6] ?? 0;
          ch.fc = opl.FN_TABLE[fnum] >> blockRv;
          ch.kcode = ch.block_fnum >> 9;
          if ((opl.mode & 0x40) && (ch.block_fnum & 0x100)) {
            ch.kcode |= 1;
          }
          calcFCSlot(ch, ch.SLOT[SLOT1]);
          calcFCSlot(ch, ch.SLOT[SLOT2]);
        }
      }
      return;
    case 0xc0:
      if ((r & 0x0f) > 11) {
        return;
      }
      ch = opl.P_CH[r & 0x0f];
      ch.FB = ((v >> 1) & 7) ? (8 + 1) - ((v >> 1) & 7) : 0;
      ch.CON = v & 1;
      setAlgorithm(ch);
      return;
    case 0xe0:
      slot = slotArray[r & 0x1f];
      if (slot === -1) {
        return;
      }
      ch = opl.P_CH[(slot / 2) | 0];
      if (opl.wavesel) {
        const wave = v & 0x03;
        ch.SLOT[slot & 1].wavetable = SIN_TABLE.subarray(wave * SIN_ENT, (wave + 1) * SIN_ENT);
      }
      return;
  }
}

export function OPLCreate(type: number, clock: number, rate: number): FM_OPL {
  ensureCommonTables();
  const opl = createOpl(type, clock, rate, 12);
  oplInitialize(opl);
  OPLResetChip(opl);
  return opl;
}

export function OPLDestroy(opl: FM_OPL | null): void {
  if (curChip === opl) {
    curChip = null;
  }
}

export function OPLSetTimerHandler(opl: FM_OPL, timerHandler: OPL_TIMERHANDLER, channelOffset: number): void {
  opl.TimerHandler = timerHandler;
  opl.TimerParam = channelOffset;
}

export function OPLSetIRQHandler(opl: FM_OPL, irqHandler: OPL_IRQHANDLER, param: number): void {
  opl.IRQHandler = irqHandler;
  opl.IRQParam = param;
}

export function OPLSetUpdateHandler(opl: FM_OPL, updateHandler: OPL_UPDATEHANDLER, param: number): void {
  opl.UpdateHandler = updateHandler;
  opl.UpdateParam = param;
}

export function OPLSetPortHandler(opl: FM_OPL, portHandlerW: OPL_PORTHANDLER_W, portHandlerR: OPL_PORTHANDLER_R, param: number): void {
  opl.porthandler_w = portHandlerW;
  opl.porthandler_r = portHandlerR;
  opl.port_param = param;
}

export function OPLSetKeyboardHandler(opl: FM_OPL, keyboardHandlerW: OPL_PORTHANDLER_W, keyboardHandlerR: OPL_PORTHANDLER_R, param: number): void {
  opl.keyboardhandler_w = keyboardHandlerW;
  opl.keyboardhandler_r = keyboardHandlerR;
  opl.keyboard_param = param;
}

export function OPLResetChip(opl: FM_OPL): void {
  opl.mode = 0;
  oplStatusReset(opl, 0x7f);
  oplWriteReg(opl, 0x01, 0);
  oplWriteReg(opl, 0x02, 0);
  oplWriteReg(opl, 0x03, 0);
  oplWriteReg(opl, 0x04, 0);
  for (let i = 0xff; i >= 0x20; i -= 1) {
    oplWriteReg(opl, i, 0);
  }
  for (const ch of opl.P_CH) {
    for (const slot of ch.SLOT) {
      slot.wavetable = SIN_TABLE.subarray(0, SIN_ENT);
      slot.evc = EG_OFF;
      slot.eve = EG_OFF + 1;
      slot.evs = 0;
    }
  }
}

export function OPLWrite(opl: FM_OPL, a: number, v: number): number {
  if (!(a & 1)) {
    opl.address = v & 0xff;
  } else {
    opl.UpdateHandler?.(opl.UpdateParam, 0);
    oplWriteReg(opl, opl.address, v);
  }
  return opl.status >> 7;
}

export function OPLRead(opl: FM_OPL, a: number): number {
  if (!(a & 1)) {
    return opl.status & (opl.statusmask | 0x80);
  }
  switch (opl.address) {
    case 0x05:
      if (opl.type & OPL_TYPE_KEYBOARD) {
        return opl.keyboardhandler_r?.(opl.keyboard_param) ?? 0;
      }
      return 0;
    case 0x19:
      if (opl.type & OPL_TYPE_IO) {
        return opl.porthandler_r?.(opl.port_param) ?? 0;
      }
      return 0;
    case 0x1a:
      return 0;
    default:
      return 0;
  }
}

export function OPLTimerOver(opl: FM_OPL, c: number): number {
  if (c) {
    oplStatusSet(opl, 0x20);
  } else {
    oplStatusSet(opl, 0x40);
    if (opl.mode & 0x80) {
      opl.UpdateHandler?.(opl.UpdateParam, 0);
      for (let ch = 0; ch < 9; ch += 1) {
        csmKeyControl(opl.P_CH[ch]);
      }
    }
  }
  opl.TimerHandler?.(opl.TimerParam + c, opl.T[c] * opl.TimerBase);
  return opl.status >> 7;
}

export function YM3812UpdateOne(opl: FM_OPL, buffer: Int16Array, length: number, stripe: number, volume: number): void {
  if (curChip !== opl) {
    curChip = opl;
  }
  let amsCnt = opl.amsCnt >>> 0;
  let vibCnt = opl.vibCnt >>> 0;
  const rythm = opl.rythm & 0x20;
  const channels = opl.P_CH;
  const rhythmStart = rythm ? 6 : Math.min(9, channels.length);
  for (let i = 0; i < length; i += stripe) {
    amsCnt = (amsCnt + opl.amsIncr) >>> 0;
    vibCnt = (vibCnt + opl.vibIncr) >>> 0;
    ams = opl.ams_table[(amsCnt >>> AMS_SHIFT) & (AMS_ENT - 1)] ?? 0;
    vib = opl.vib_table[(vibCnt >>> VIB_SHIFT) & (VIB_ENT - 1)] ?? VIB_RATE;
    outd[0] = 0;
    for (let ch = 0; ch < rhythmStart; ch += 1) {
      oplCalcCh(channels[ch]);
    }
    if (rythm) {
      oplCalcRh(channels);
    }
    const sample = limit(Math.trunc(outd[0] * volume), OPL_MAXOUT, OPL_MINOUT);
    buffer[i] = sample >> OPL_OUTSB;
  }
  opl.amsCnt = amsCnt;
  opl.vibCnt = vibCnt;
}

export function Y8950UpdateOne(opl: FM_OPL, buffer: Int16Array, length: number): void {
  YM3812UpdateOne(opl, buffer, length, 1, 1.0);
}

const globalScope = globalThis as typeof globalThis & { opl?: Array<FM_OPL | null> };
globalScope.opl ??= [null, null];
export const opl = globalScope.opl;
