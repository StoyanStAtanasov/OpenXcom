type NumberRef = { value: number };

export class FastLineClip {
  private FC_xn = 0;
  private FC_yn = 0;
  private FC_xk = 0;
  private FC_yk = 0;
  Wxlef: number;
  Wxrig: number;
  Wytop: number;
  Wybot: number;

  constructor(Wxl: number, Wxr: number, Wyt: number, Wyb: number) {
    this.Wxlef = Wxl;
    this.Wxrig = Wxr;
    this.Wytop = Wyt;
    this.Wybot = Wyb;
  }

  private Clip0_Bottom(): void {
    this.FC_xn = this.FC_xn + (this.FC_xk - this.FC_xn) * (this.Wybot - this.FC_yn) / (this.FC_yk - this.FC_yn);
    this.FC_yn = this.Wybot;
  }

  private Clip0_Top(): void {
    this.FC_xn = this.FC_xn + (this.FC_xk - this.FC_xn) * (this.Wytop - this.FC_yn) / (this.FC_yk - this.FC_yn);
    this.FC_yn = this.Wytop;
  }

  private Clip0_Right(): void {
    this.FC_yn = this.FC_yn + (this.FC_yk - this.FC_yn) * (this.Wxrig - this.FC_xn) / (this.FC_xk - this.FC_xn);
    this.FC_xn = this.Wxrig;
  }

  private Clip0_Left(): void {
    this.FC_yn = this.FC_yn + (this.FC_yk - this.FC_yn) * (this.Wxlef - this.FC_xn) / (this.FC_xk - this.FC_xn);
    this.FC_xn = this.Wxlef;
  }

  private Clip1_Bottom(): void {
    this.FC_xk = this.FC_xk + (this.FC_xn - this.FC_xk) * (this.Wybot - this.FC_yk) / (this.FC_yn - this.FC_yk);
    this.FC_yk = this.Wybot;
  }

  private Clip1_Top(): void {
    this.FC_xk = this.FC_xk + (this.FC_xn - this.FC_xk) * (this.Wytop - this.FC_yk) / (this.FC_yn - this.FC_yk);
    this.FC_yk = this.Wytop;
  }

  private Clip1_Right(): void {
    this.FC_yk = this.FC_yk + (this.FC_yn - this.FC_yk) * (this.Wxrig - this.FC_xk) / (this.FC_xn - this.FC_xk);
    this.FC_xk = this.Wxrig;
  }

  private Clip1_Left(): void {
    this.FC_yk = this.FC_yk + (this.FC_yn - this.FC_yk) * (this.Wxlef - this.FC_xk) / (this.FC_xn - this.FC_xk);
    this.FC_xk = this.Wxlef;
  }

  LineClip(x0: NumberRef, y0: NumberRef, x1: NumberRef, y1: NumberRef): number {
    let Code = 0;
    let visible = 0;

    this.FC_xn = x0.value;
    this.FC_yn = y0.value;
    this.FC_xk = x1.value;
    this.FC_yk = y1.value;

    if (this.FC_yk > this.Wybot) Code |= 0x08;
    else if (this.FC_yk < this.Wytop) Code |= 0x04;
    if (this.FC_xk > this.Wxrig) Code |= 0x02;
    else if (this.FC_xk < this.Wxlef) Code |= 0x01;

    if (this.FC_yn > this.Wybot) Code |= 0x80;
    else if (this.FC_yn < this.Wytop) Code |= 0x40;
    if (this.FC_xn > this.Wxrig) Code |= 0x20;
    else if (this.FC_xn < this.Wxlef) Code |= 0x10;

    switch (Code) {
      case 0x00: ++visible; break;
      case 0x01: this.Clip1_Left(); ++visible; break;
      case 0x02: this.Clip1_Right(); ++visible; break;
      case 0x04: this.Clip1_Top(); ++visible; break;
      case 0x05: this.Clip1_Left(); if (this.FC_yk < this.Wytop) this.Clip1_Top(); ++visible; break;
      case 0x06: this.Clip1_Right(); if (this.FC_yk < this.Wytop) this.Clip1_Top(); ++visible; break;
      case 0x08: this.Clip1_Bottom(); ++visible; break;
      case 0x09: this.Clip1_Left(); if (this.FC_yk > this.Wybot) this.Clip1_Bottom(); ++visible; break;
      case 0x0A: this.Clip1_Right(); if (this.FC_yk > this.Wybot) this.Clip1_Bottom(); ++visible; break;

      case 0x10: this.Clip0_Left(); ++visible;
      case 0x11: break;
      case 0x12: this.Clip0_Left(); this.Clip1_Right(); ++visible; break;
      case 0x14: this.Clip0_Left(); if (this.FC_yn < this.Wytop) break; this.Clip1_Top(); ++visible;
      case 0x15: break;
      case 0x16: this.Clip0_Left(); if (this.FC_yn < this.Wytop) break; this.Clip1_Top(); if (this.FC_xk > this.Wxrig) this.Clip1_Right(); ++visible; break;
      case 0x18: this.Clip0_Left(); if (this.FC_yn > this.Wybot) break; this.Clip1_Bottom(); ++visible;
      case 0x19: break;
      case 0x1A: this.Clip0_Left(); if (this.FC_yn > this.Wybot) break; this.Clip1_Bottom(); if (this.FC_xk > this.Wxrig) this.Clip1_Right(); ++visible; break;

      case 0x20: this.Clip0_Right(); ++visible; break;
      case 0x21: this.Clip0_Right(); this.Clip1_Left(); ++visible;
      case 0x22: break;
      case 0x24: this.Clip0_Right(); if (this.FC_yn < this.Wytop) break; this.Clip1_Top(); ++visible; break;
      case 0x25: this.Clip0_Right(); if (this.FC_yn < this.Wytop) break; this.Clip1_Top(); if (this.FC_xk < this.Wxlef) this.Clip1_Left(); ++visible;
      case 0x26: break;
      case 0x28: this.Clip0_Right(); if (this.FC_yn > this.Wybot) break; this.Clip1_Bottom(); ++visible; break;
      case 0x29: this.Clip0_Right(); if (this.FC_yn > this.Wybot) break; this.Clip1_Bottom(); if (this.FC_xk < this.Wxlef) this.Clip1_Left(); ++visible;
      case 0x2A: break;

      case 0x40: this.Clip0_Top(); ++visible; break;
      case 0x41: this.Clip0_Top(); if (this.FC_xn < this.Wxlef) break; this.Clip1_Left(); if (this.FC_yk < this.Wytop) this.Clip1_Top(); ++visible; break;
      case 0x42: this.Clip0_Top(); if (this.FC_xn > this.Wxrig) break; this.Clip1_Right(); ++visible;
      case 0x44:
      case 0x45:
      case 0x46: break;
      case 0x48: this.Clip0_Top(); this.Clip1_Bottom(); ++visible; break;
      case 0x49: this.Clip0_Top(); if (this.FC_xn < this.Wxlef) break; this.Clip1_Left(); if (this.FC_yk > this.Wybot) this.Clip1_Bottom(); ++visible; break;
      case 0x4A: this.Clip0_Top(); if (this.FC_xn > this.Wxrig) break; this.Clip1_Right(); if (this.FC_yk > this.Wybot) this.Clip1_Bottom(); ++visible; break;

      case 0x50: this.Clip0_Left(); if (this.FC_yn < this.Wytop) this.Clip0_Top(); ++visible;
      case 0x51: break;
      case 0x52: this.Clip1_Right(); if (this.FC_yk < this.Wytop) break; this.Clip0_Top(); if (this.FC_xn < this.Wxlef) this.Clip0_Left(); ++visible;
      case 0x54:
      case 0x55:
      case 0x56: break;
      case 0x58: this.Clip1_Bottom(); if (this.FC_xk < this.Wxlef) break; this.Clip0_Top(); if (this.FC_xn < this.Wxlef) this.Clip0_Left(); ++visible;
      case 0x59: break;
      case 0x5A: this.Clip0_Left(); if (this.FC_yn > this.Wybot) break; this.Clip1_Right(); if (this.FC_yk < this.Wytop) break; if (this.FC_yn < this.Wytop) this.Clip0_Top(); if (this.FC_yk > this.Wybot) this.Clip1_Bottom(); ++visible; break;

      case 0x60: this.Clip0_Right(); if (this.FC_yn < this.Wytop) this.Clip0_Top(); ++visible; break;
      case 0x61: this.Clip1_Left(); if (this.FC_yk < this.Wytop) break; this.Clip0_Top(); if (this.FC_xn > this.Wxrig) this.Clip0_Right(); ++visible;
      case 0x62:
      case 0x64:
      case 0x65:
      case 0x66: break;
      case 0x68: this.Clip1_Bottom(); if (this.FC_xk > this.Wxrig) break; this.Clip0_Right(); if (this.FC_yn < this.Wytop) this.Clip0_Top(); ++visible; break;
      case 0x69: this.Clip1_Left(); if (this.FC_yk < this.Wytop) break; this.Clip0_Right(); if (this.FC_yn > this.Wybot) break; if (this.FC_yk > this.Wybot) this.Clip1_Bottom(); if (this.FC_yn < this.Wytop) this.Clip0_Top(); ++visible;
      case 0x6A: break;

      case 0x80: this.Clip0_Bottom(); ++visible; break;
      case 0x81: this.Clip0_Bottom(); if (this.FC_xn < this.Wxlef) break; this.Clip1_Left(); ++visible; break;
      case 0x82: this.Clip0_Bottom(); if (this.FC_xn > this.Wxrig) break; this.Clip1_Right(); ++visible; break;
      case 0x84: this.Clip0_Bottom(); this.Clip1_Top(); ++visible; break;
      case 0x85: this.Clip0_Bottom(); if (this.FC_xn < this.Wxlef) break; this.Clip1_Left(); if (this.FC_yk < this.Wytop) this.Clip1_Top(); ++visible; break;
      case 0x86: this.Clip0_Bottom(); if (this.FC_xn > this.Wxrig) break; this.Clip1_Right(); if (this.FC_yk < this.Wytop) this.Clip1_Top(); ++visible;
      case 0x88:
      case 0x89:
      case 0x8A: break;

      case 0x90: this.Clip0_Left(); if (this.FC_yn > this.Wybot) this.Clip0_Bottom(); ++visible;
      case 0x91: break;
      case 0x92: this.Clip1_Right(); if (this.FC_yk > this.Wybot) break; this.Clip0_Bottom(); if (this.FC_xn < this.Wxlef) this.Clip0_Left(); ++visible; break;
      case 0x94: this.Clip1_Top(); if (this.FC_xk < this.Wxlef) break; this.Clip0_Left(); if (this.FC_yn > this.Wybot) this.Clip0_Bottom(); ++visible;
      case 0x95: break;
      case 0x96: this.Clip0_Left(); if (this.FC_yn < this.Wytop) break; this.Clip1_Right(); if (this.FC_yk > this.Wybot) break; if (this.FC_yn > this.Wybot) this.Clip0_Bottom(); if (this.FC_yk < this.Wytop) this.Clip1_Top(); ++visible;
      case 0x98:
      case 0x99:
      case 0x9A: break;

      case 0xA0: this.Clip0_Right(); if (this.FC_yn > this.Wybot) this.Clip0_Bottom(); ++visible; break;
      case 0xA1: this.Clip1_Left(); if (this.FC_yk > this.Wybot) break; this.Clip0_Bottom(); if (this.FC_xn > this.Wxrig) this.Clip0_Right(); ++visible;
      case 0xA2: break;
      case 0xA4: this.Clip1_Top(); if (this.FC_xk > this.Wxrig) break; this.Clip0_Right(); if (this.FC_yn > this.Wybot) this.Clip0_Bottom(); ++visible; break;
      case 0xA5: this.Clip1_Left(); if (this.FC_yk > this.Wybot) break; this.Clip0_Right(); if (this.FC_yn < this.Wytop) break; if (this.FC_yk < this.Wytop) this.Clip1_Top(); if (this.FC_yn > this.Wybot) this.Clip0_Bottom(); ++visible;
      case 0xA6:
      case 0xA8:
      case 0xA9:
      case 0xAA: break;

      default:
        visible = -1;
        break;
    }

    if (visible > 0) {
      x0.value = this.FC_xn;
      y0.value = this.FC_yn;
      x1.value = this.FC_xk;
      y1.value = this.FC_yk;
    }
    return visible;
  }
}
