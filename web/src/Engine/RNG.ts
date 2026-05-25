export class RNG {
  private static _x = BigInt(Math.max(1, Math.trunc(Date.now() / 1000)));
  private static UINT64_MASK = (1n << 64n) - 1n;

  static getSeed(): bigint {
    return RNG._x;
  }

  static setSeed(n: bigint | number): void {
    const seed = typeof n === "bigint" ? n : BigInt(Math.trunc(n));
    RNG._x = seed === 0n ? 1n : seed & RNG.UINT64_MASK;
  }

  static next(): bigint {
    let x = RNG._x;
    x ^= x >> 12n;
    x ^= (x << 25n) & RNG.UINT64_MASK;
    x ^= x >> 27n;
    RNG._x = x & RNG.UINT64_MASK;
    return (RNG._x * 2685821657736338717n) & RNG.UINT64_MASK;
  }

  static generate(min: number, max: number): number {
    if (max < min) {
      return min;
    }
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      return Number(RNG.next()) / Number(RNG.UINT64_MASK) * (max - min) + min;
    }
    const range = BigInt(max - min + 1);
    return Number(RNG.next() % range) + min;
  }

  static seedless(min: number, max: number): number {
    if (max < min) {
      return min;
    }
    return Math.trunc(Math.random() * (max - min + 1)) + min;
  }

  static percent(value: number): boolean {
    return RNG.generate(0, 99) < value;
  }

  static shuffle<T>(list: T[]): void {
    for (let i = list.length - 1; i > 0; --i) {
      const j = RNG.generate(0, i);
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
  }
}
