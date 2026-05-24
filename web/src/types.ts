export type PaletteColor = { r: number; g: number; b: number; a?: number };
export type Rect = { x: number; y: number; w: number; h: number };

export const SDL_QUIT = "SDL_QUIT";
export const SDL_KEYDOWN = "SDL_KEYDOWN";
export const SDL_KEYUP = "SDL_KEYUP";
export const SDL_MOUSEMOTION = "SDL_MOUSEMOTION";
export const SDL_MOUSEBUTTONDOWN = "SDL_MOUSEBUTTONDOWN";
export const SDL_MOUSEBUTTONUP = "SDL_MOUSEBUTTONUP";
export const SDL_VIDEORESIZE = "SDL_VIDEORESIZE";

export const SDL_BUTTON_LEFT = 1;
export const SDL_BUTTON_MIDDLE = 2;
export const SDL_BUTTON_RIGHT = 3;
export const SDL_BUTTON_WHEELUP = 4;
export const SDL_BUTTON_WHEELDOWN = 5;
export const SDL_BUTTON_X1 = 6;
export const SDL_BUTTON_X2 = 7;

export const KMOD_CTRL = 1 << 0;
export const KMOD_ALT = 1 << 1;
export const KMOD_SHIFT = 1 << 2;

export type SdlEventType =
  | typeof SDL_QUIT
  | typeof SDL_KEYDOWN
  | typeof SDL_KEYUP
  | typeof SDL_MOUSEMOTION
  | typeof SDL_MOUSEBUTTONDOWN
  | typeof SDL_MOUSEBUTTONUP
  | typeof SDL_VIDEORESIZE;

export type SdlEvent = {
  type: SdlEventType;
  motion?: { x: number; y: number };
  button?: { x: number; y: number; button: number };
  key?: { keysym: { sym: string; mod: number } };
  resize?: { w: number; h: number };
};
