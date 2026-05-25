export const M_PI = Math.PI;
export const M_PI_2 = Math.PI / 2;
export const M_PI_4 = Math.PI / 4;

export function AreSame(left: number, right: number): boolean {
  return Math.abs(left - right) <= Number.EPSILON * Math.max(1.0, Math.abs(left), Math.abs(right));
}

export function Round(x: number): number {
  return x < 0 ? Math.ceil(x - 0.5) : Math.floor(x + 0.5);
}

export function Sqr<T extends number>(x: T): number {
  return x * x;
}

export function Sign<T extends number>(x: T): number {
  return (x > 0 ? 1 : 0) - (x < 0 ? 1 : 0);
}

export function Clamp<T extends number>(x: T, min: T, max: T): T {
  return Math.min(Math.max(x, min), max) as T;
}

export function Deg2Rad(deg: number): number {
  return deg * M_PI / 180.0;
}

export function Rad2Deg(rad: number): number {
  return rad / M_PI * 180.0;
}

export function Xcom2Rad(deg: number): number {
  return deg * 0.125 * M_PI / 180.0;
}

export function Nautical(x: number): number {
  return x * (1 / 60.0) * (M_PI / 180.0);
}
