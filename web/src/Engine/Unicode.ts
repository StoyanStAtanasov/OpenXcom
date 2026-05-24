export type UCode = number;
export type UString = UCode[];

export const TOK_NL_SMALL = 2;
export const TOK_COLOR_FLIP = 1;
export const TOK_NBSP = 0xa0;

export function isLinebreak(c: UCode): boolean {
  return c === 10 || c === TOK_NL_SMALL;
}

export function isSpace(c: UCode): boolean {
  return c === 32 || c === TOK_NBSP;
}

export function isSeparator(c: UCode): boolean {
  return c === 45 || c === 47;
}

export function isPrintable(c: UCode): boolean {
  return c > 32 && c !== TOK_NBSP;
}

export function convUtf8ToUtf32(src: string): UString {
  return Array.from(src).map(ch => ch.codePointAt(0) || 0);
}

export function convUtf32ToUtf8(src: UString): string {
  return String.fromCodePoint(...src);
}

export function replaceAll(str: string, find: string, replacement: string): string {
  return str.split(find).join(replacement);
}

export function formatNumber(value: number, currency = ""): string {
  const negative = value < 0;
  let s = String(Math.abs(Math.trunc(value)));
  for (let spacer = s.length - 3; spacer > 0; spacer -= 3) {
    s = `${s.slice(0, spacer)}${String.fromCharCode(TOK_NBSP)}${s.slice(spacer)}`;
  }
  if (currency) {
    s = `${currency}${s}`;
  }
  return negative ? `-${s}` : s;
}

export function formatFunding(funds: number): string {
  return formatNumber(funds, "$");
}

export function formatPercentage(value: number): string {
  return `${value}%`;
}
