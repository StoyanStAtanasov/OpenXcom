import { Surface } from "./Surface.ts";
import { GraphSubset } from "./GraphSubset.ts";

export type PixelBuffer = number[] | Uint8Array;

export class Nothing {}

export class Scalar<T = number> {
  constructor(public ref: T) {}
}

export class Offset {
  constructor(public x: number, public y: number) {}
}

export class ShaderBase<Pixel extends number = number> {
  protected _orgin: PixelBuffer;
  protected _range_base: GraphSubset;
  protected _range_domain: GraphSubset;
  protected _pitch: number;

  constructor(source: ShaderBase<Pixel> | Surface | PixelBuffer, max_x?: number, max_y?: number) {
    if (source instanceof ShaderBase) {
      this._orgin = source.ptr();
      this._range_base = new GraphSubset([source.getBaseDomain().beg_x, source.getBaseDomain().end_x], [source.getBaseDomain().beg_y, source.getBaseDomain().end_y]);
      this._range_domain = new GraphSubset([source.getDomain().beg_x, source.getDomain().end_x], [source.getDomain().beg_y, source.getDomain().end_y]);
      this._pitch = source.pitch();
      return;
    }
    if (source instanceof Surface) {
      this._orgin = (source as unknown as { _pixels: PixelBuffer })._pixels;
      this._range_base = new GraphSubset(source.getWidth(), source.getHeight());
      this._range_domain = new GraphSubset(source.getWidth(), source.getHeight());
      this._pitch = source.getWidth();
      return;
    }
    if (max_x == null || max_y == null) {
      throw new Error("ShaderBase requires dimensions for raw pixel buffers.");
    }
    this._orgin = source;
    this._range_base = new GraphSubset(max_x, max_y);
    this._range_domain = new GraphSubset(max_x, max_y);
    this._pitch = max_x;
  }

  ptr(): PixelBuffer {
    return this._orgin;
  }

  pitch(): number {
    return this._pitch;
  }

  setDomain(g: GraphSubset): void {
    this._range_domain = GraphSubset.intersection(g, this._range_base);
  }

  getDomain(): GraphSubset {
    return this._range_domain;
  }

  getBaseDomain(): GraphSubset {
    return this._range_base;
  }

  getImage(): GraphSubset {
    return this._range_domain;
  }
}

type ControlKind = "base" | "repeat" | "scalar" | "offset" | "nothing";

function cloneRange(range: GraphSubset): GraphSubset {
  return new GraphSubset([range.beg_x, range.end_x], [range.beg_y, range.end_y]);
}

function clampMod(value: number, size: number): number {
  if (size === 0) {
    return 0;
  }
  const mod = value % size;
  return mod < 0 ? mod + size : mod;
}

export class controler_base<Pixel extends number = number> {
  readonly data: PixelBuffer;
  readonly range: GraphSubset;
  start_x = 0;
  start_y = 0;
  ptr_pos_y = 0;
  ptr_pos_x = 0;

  constructor(base: PixelBuffer, d: GraphSubset, r: GraphSubset, readonly step: [number, number]) {
    this.data = base;
    this.range = cloneRange(r);
  }

  get_range(): GraphSubset {
    return this.range;
  }

  mod_range(g: GraphSubset): void {
    const ret = GraphSubset.intersection(this.range, g);
    g.beg_x = ret.beg_x;
    g.end_x = ret.end_x;
    g.beg_y = ret.beg_y;
    g.end_y = ret.end_y;
  }

  set_range(g: GraphSubset): void {
    this.start_x = g.beg_x - this.range.beg_x;
    this.start_y = g.beg_y - this.range.beg_y;
  }

  mod_y(_begin: number, _end: number): void {
    this.ptr_pos_y = this.step[0] * this.start_x + this.step[1] * this.start_y;
  }

  set_y(begin: number, _end: number): void {
    this.ptr_pos_y += this.step[1] * begin;
  }

  inc_y(): void {
    this.ptr_pos_y += this.step[1];
  }

  mod_x(_begin: number, _end: number): void {
    this.ptr_pos_x = this.ptr_pos_y;
  }

  set_x(begin: number, _end: number): void {
    this.ptr_pos_x += this.step[0] * begin;
  }

  inc_x(): void {
    this.ptr_pos_x += this.step[0];
  }

  get_ref(): Pixel {
    return this.data[this.ptr_pos_x] as Pixel;
  }

  set_ref(value: Pixel): void {
    this.data[this.ptr_pos_x] = value;
  }
}

export class controler<SurfaceType = unknown> {
  private readonly kind: ControlKind;
  private readonly scalar?: Scalar;
  private readonly offset?: Offset;
  private readonly base?: controler_base;
  private readonly repeat?: {
    base: PixelBuffer;
    range_domain: GraphSubset;
    range_image: GraphSubset;
    off_x: number;
    off_y: number;
    size_x: number;
    size_y: number;
    curr_x: number;
    curr_y: number;
    pitch: number;
    ptr_curr_x: number;
    ptr_curr_y: number;
  };

  constructor(private readonly source: SurfaceType) {
    if (source instanceof Scalar) {
      this.kind = "scalar";
      this.scalar = source;
      return;
    }
    if (source instanceof Offset) {
      this.kind = "offset";
      this.offset = source;
      return;
    }
    if (source instanceof Nothing) {
      this.kind = "nothing";
      return;
    }
    if (source instanceof ShaderBase) {
      const raw = source as ShaderBase;
      if (typeof (raw as unknown as { _off_x?: number })._off_x === "number") {
        const repeatSource = raw as unknown as ShaderBase & { _off_x: number; _off_y: number };
        this.kind = "repeat";
        this.repeat = {
          base: repeatSource.ptr(),
          range_domain: cloneRange(repeatSource.getDomain()),
          range_image: cloneRange(repeatSource.getImage()),
          off_x: repeatSource._off_x,
          off_y: repeatSource._off_y,
          size_x: repeatSource.getDomain().size_x(),
          size_y: repeatSource.getDomain().size_y(),
          curr_x: 0,
          curr_y: 0,
          pitch: repeatSource.pitch(),
          ptr_curr_x: 0,
          ptr_curr_y: 0
        };
        return;
      }
      this.kind = "base";
      this.base = new controler_base(raw.ptr(), raw.getDomain(), raw.getImage(), [1, raw.pitch()]);
      return;
    }
    this.kind = "nothing";
  }

  get_range(): GraphSubset {
    if (this.kind === "base") {
      return this.base!.get_range();
    }
    if (this.kind === "repeat") {
      return cloneRange(this.repeat!.range_image);
    }
    return new GraphSubset(0, 0);
  }

  mod_range(g: GraphSubset): void {
    if (this.kind === "base") {
      this.base!.mod_range(g);
      return;
    }
    if (this.kind === "repeat") {
      const ret = GraphSubset.intersection(this.repeat!.range_image, g);
      g.beg_x = ret.beg_x;
      g.end_x = ret.end_x;
      g.beg_y = ret.beg_y;
      g.end_y = ret.end_y;
    }
  }

  set_range(g: GraphSubset): void {
    if (this.kind === "base") {
      this.base!.set_range(g);
      return;
    }
    if (this.kind === "repeat") {
      this.repeat!.range_image = cloneRange(g);
    }
  }

  mod_y(begin: number, end: number): void {
    if (this.kind === "base") {
      this.base!.mod_y(begin, end);
      return;
    }
    if (this.kind === "repeat") {
      const rep = this.repeat!;
      rep.curr_y = clampMod(rep.range_image.beg_y - rep.off_y, rep.size_y);
      rep.ptr_curr_y = rep.range_domain.beg_y * rep.pitch;
      rep.ptr_curr_y += rep.curr_y * rep.pitch;
    }
  }

  set_y(begin: number, end: number): void {
    if (this.kind === "base") {
      this.base!.set_y(begin, end);
      return;
    }
    if (this.kind === "repeat") {
      const rep = this.repeat!;
      rep.curr_y = clampMod(rep.curr_y + begin, rep.size_y);
      rep.ptr_curr_y += rep.range_domain.beg_y * rep.pitch;
      rep.ptr_curr_y += rep.curr_y * rep.pitch;
    }
  }

  inc_y(): void {
    if (this.kind === "base") {
      this.base!.inc_y();
      return;
    }
    if (this.kind === "repeat") {
      const rep = this.repeat!;
      ++rep.curr_y;
      rep.ptr_curr_y += rep.pitch;
      if (rep.curr_y === rep.size_y) {
        rep.curr_y = 0;
        rep.ptr_curr_y -= rep.size_y * rep.pitch;
      }
    }
  }

  mod_x(begin: number, end: number): void {
    if (this.kind === "base") {
      this.base!.mod_x(begin, end);
      return;
    }
    if (this.kind === "repeat") {
      const rep = this.repeat!;
      rep.curr_x = clampMod(rep.range_image.beg_x - rep.off_x, rep.size_x);
      rep.ptr_curr_x = rep.ptr_curr_y;
    }
  }

  set_x(begin: number, end: number): void {
    if (this.kind === "base") {
      this.base!.set_x(begin, end);
      return;
    }
    if (this.kind === "repeat") {
      const rep = this.repeat!;
      rep.curr_x = clampMod(rep.curr_x + begin, rep.size_x);
      rep.ptr_curr_x += rep.range_domain.beg_x + rep.curr_x;
    }
  }

  inc_x(): void {
    if (this.kind === "base") {
      this.base!.inc_x();
      return;
    }
    if (this.kind === "repeat") {
      const rep = this.repeat!;
      ++rep.curr_x;
      ++rep.ptr_curr_x;
      if (rep.curr_x === rep.size_x) {
        rep.curr_x = 0;
        rep.ptr_curr_x -= rep.size_x;
      }
    }
  }

  get_ref(): unknown {
    if (this.kind === "base") {
      return this.base!.get_ref();
    }
    if (this.kind === "repeat") {
      return this.repeat!.base[this.repeat!.ptr_curr_x];
    }
    if (this.kind === "scalar") {
      return this.scalar!.ref;
    }
    if (this.kind === "offset") {
      return new Offset(this.offset!.x, this.offset!.y);
    }
    return 0;
  }

  set_ref(value: unknown): void {
    if (this.kind === "base") {
      this.base!.set_ref(value as never);
      return;
    }
    if (this.kind === "repeat") {
      this.repeat!.base[this.repeat!.ptr_curr_x] = value as never;
    }
  }
}
