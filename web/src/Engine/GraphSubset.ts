export type GraphRange = [number, number];

export class GraphSubset {
  beg_x: number;
  end_x: number;
  beg_y: number;
  end_y: number;

  constructor(max_x: number, max_y: number);
  constructor(range_x: GraphRange, range_y: GraphRange);
  constructor(range_x: number | GraphRange, range_y: number | GraphRange) {
    if (Array.isArray(range_x) && Array.isArray(range_y)) {
      this.beg_x = range_x[0];
      this.end_x = range_x[1];
      this.beg_y = range_y[0];
      this.end_y = range_y[1];
      return;
    }
    this.beg_x = 0;
    this.end_x = Number(range_x);
    this.beg_y = 0;
    this.end_y = Number(range_y);
  }

  offset(x: number, y: number): GraphSubset {
    return new GraphSubset([this.beg_x + x, this.end_x + x], [this.beg_y + y, this.end_y + y]);
  }

  size_x(): number {
    return this.end_x - this.beg_x;
  }

  size_y(): number {
    return this.end_y - this.beg_y;
  }

  static intersection_range(begin_a: number, end_a: number, begin_b: number, end_b: number): GraphRange {
    if (begin_a >= end_b || begin_b >= end_a) {
      return [begin_a, begin_a];
    }
    return [Math.max(begin_a, begin_b), Math.min(end_a, end_b)];
  }

  static intersection(a: GraphSubset, b: GraphSubset): GraphSubset;
  static intersection(a: GraphSubset, b: GraphSubset, c: GraphSubset): GraphSubset;
  static intersection(a: GraphSubset, b: GraphSubset, c: GraphSubset, d: GraphSubset): GraphSubset;
  static intersection(...args: GraphSubset[]): GraphSubset {
    const ret = new GraphSubset([args[0].beg_x, args[0].end_x], [args[0].beg_y, args[0].end_y]);
    for (let i = 1; i < args.length; ++i) {
      const next = args[i];
      [ret.beg_x, ret.end_x] = GraphSubset.intersection_range(ret.beg_x, ret.end_x, next.beg_x, next.end_x);
      [ret.beg_y, ret.end_y] = GraphSubset.intersection_range(ret.beg_y, ret.end_y, next.beg_y, next.end_y);
    }
    return ret;
  }
}
