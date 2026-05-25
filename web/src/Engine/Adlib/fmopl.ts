/*
 * Source-shaped TypeScript translation of src/Engine/Adlib/fmopl.h/.cpp.
 *
 * The register/state API is preserved for the browser port. The heavy DSP
 * mixer remains an explicit browser boundary for now.
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
  AR: INT32[];
  DR: INT32[];
  SL: INT32;
  RR: INT32[];
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
  wavetable: INT32[][];
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
  AR_TABLE: INT32[];
  DR_TABLE: INT32[];
  FN_TABLE: UINT32[];
  ams_table: INT32[];
  vib_table: INT32[];
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

function createSlot(): OPL_SLOT {
  return {
    TL: 0,
    TLL: 0,
    KSR: 0,
    AR: new Array(75).fill(0),
    DR: new Array(75).fill(0),
    SL: 0,
    RR: new Array(75).fill(0),
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
    wavetable: [],
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
    AR_TABLE: new Array(75).fill(0),
    DR_TABLE: new Array(75).fill(0),
    FN_TABLE: new Array(1024).fill(0),
    ams_table: new Array(AMS_ENT * 2).fill(0),
    vib_table: new Array(VIB_ENT * 2).fill(0),
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
  slot.evm = 2;
  slot.evs = slot.evsa;
  slot.evc = EG_AST;
  slot.eve = EG_AED;
}

function oplKeyOff(slot: OPL_SLOT): void {
  if (slot.evm > 0) {
    slot.evm = 0;
    if (!(slot.evc & EG_DST)) {
      slot.evc = ((slot.evc >> ENV_BITS) << ENV_BITS) + EG_DST;
    }
    slot.eve = EG_OFF;
    slot.evs = slot.evsr;
  }
}

function oplCalcSlot(slot: OPL_SLOT): number {
  if ((slot.evc += slot.evs) >= slot.eve) {
    switch (slot.evm) {
      case 2:
        slot.evm = 1;
        slot.evc = EG_DST;
        slot.eve = slot.SL;
        slot.evs = slot.evsd;
        break;
      case 1:
        slot.evc = slot.SL;
        slot.eve = EG_OFF;
        if (slot.eg_typ) {
          slot.evs = 0;
        } else {
          slot.evm = 0;
          slot.evs = slot.evsr;
        }
        break;
      case 0:
        slot.evc = EG_OFF;
        slot.eve = EG_OFF + 1;
        slot.evs = 0;
        break;
    }
  }
  return slot.TLL;
}

function setAlgorithm(ch: OPL_CH): void {
  ch.connect1 = ch.CON ? [0] : [0];
  ch.connect2 = [0];
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
  slot.TL = (value & 0x3f) * (0.75 / EG_STEP);
  if (!(opl.mode & 0x80)) {
    slot.TLL = slot.TL + (ch.ksl_base >> slot.ksl);
  }
}

function setArDr(opl: FM_OPL, slotIndex: number, value: number): void {
  const ch = opl.P_CH[slotIndex / 2 | 0];
  const slot = ch.SLOT[slotIndex & 1];
  const ar = value >> 4;
  const dr = value & 0x0f;
  slot.AR = ar ? opl.AR_TABLE : new Array(75).fill(0);
  slot.evsa = slot.AR[slot.ksr] ?? 0;
  if (slot.evm === 2) {
    slot.evs = slot.evsa;
  }
  slot.DR = dr ? opl.DR_TABLE : new Array(75).fill(0);
  slot.evsd = slot.DR[slot.ksr] ?? 0;
  if (slot.evm === 1) {
    slot.evs = slot.evsd;
  }
}

function setSlRr(opl: FM_OPL, slotIndex: number, value: number): void {
  const ch = opl.P_CH[slotIndex / 2 | 0];
  const slot = ch.SLOT[slotIndex & 1];
  const sl = value >> 4;
  const rr = value & 0x0f;
  slot.SL = sl;
  if (slot.evm === 1) {
    slot.eve = slot.SL;
  }
  slot.RR = opl.DR_TABLE;
  slot.evsr = slot.RR[slot.ksr] ?? 0;
  if (slot.evm === 0) {
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
  opl.freqbase = opl.rate ? (opl.clock / opl.rate) / 72 : 0;
  opl.TimerBase = 1.0 / (opl.clock / 72.0);
  for (let fn = 0; fn < 1024; fn += 1) {
    opl.FN_TABLE[fn] = Math.trunc(opl.freqbase * fn * FREQ_RATE * (1 << 7) / 2);
  }
  opl.amsIncr = opl.rate ? Math.trunc((AMS_ENT * (1 << AMS_SHIFT) / opl.rate) * 3.7 * (opl.clock / 3600000)) : 0;
  opl.vibIncr = opl.rate ? Math.trunc((VIB_ENT * (1 << VIB_SHIFT) / opl.rate) * 6.4 * (opl.clock / 3600000)) : 0;
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
  opl.ams_table = new Array(AMS_ENT * 2).fill(0);
  opl.vib_table = new Array(VIB_ENT * 2).fill(0);
  for (let i = 0; i < AMS_ENT; i += 1) {
    const pom = (1.0 + Math.sin(2 * PI * i / AMS_ENT)) / 2;
    opl.ams_table[i] = Math.trunc((1.0 / EG_STEP) * pom);
    opl.ams_table[AMS_ENT + i] = Math.trunc((4.8 / EG_STEP) * pom);
  }
  for (let i = 0; i < VIB_ENT; i += 1) {
    const pom = VIB_RATE * 0.06 * Math.sin(2 * PI * i / VIB_ENT);
    opl.vib_table[i] = Math.trunc(VIB_RATE + (pom * 0.07));
    opl.vib_table[VIB_ENT + i] = Math.trunc(VIB_RATE + (pom * 0.14));
  }
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
        opl.ams_table = opl.ams_table.slice(v & 0x80 ? AMS_ENT : 0);
        opl.vib_table = opl.vib_table.slice(v & 0x40 ? VIB_ENT : 0);
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
        ch.SLOT[slot & 1].wavetable = [];
      }
      return;
  }
}

export function OPLCreate(type: number, clock: number, rate: number): FM_OPL {
  const opl = createOpl(type, clock, rate, 12);
  oplInitialize(opl);
  OPLResetChip(opl);
  return opl;
}

export function OPLDestroy(_opl: FM_OPL | null): void {}

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
      slot.wavetable = [];
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

export function YM3812UpdateOne(_opl: FM_OPL, buffer: Int16Array, length: number, stripe: number, volume: number): void {
  void stripe;
  void volume;
  for (let i = 0; i < length; i += 1) {
    buffer[i] = 0;
  }
}

export function Y8950UpdateOne(opl: FM_OPL, buffer: Int16Array, length: number): void {
  YM3812UpdateOne(opl, buffer, length, 1, 1.0);
}

const globalScope = globalThis as typeof globalThis & { opl?: Array<FM_OPL | null> };
globalScope.opl ??= [null, null];
export const opl = globalScope.opl;
