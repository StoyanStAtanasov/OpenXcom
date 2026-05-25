import { Logger, LOG_ERROR } from "./Logger.ts";
import { Surface } from "./Surface.ts";

export function strGLError(glErr: number): string {
  switch (glErr) {
    case 0x0500: return "GL_INVALID_ENUM";
    case 0x0501: return "GL_INVALID_VALUE";
    case 0x0502: return "GL_INVALID_OPERATION";
    case 0x0503: return "GL_STACK_OVERFLOW";
    case 0x0504: return "GL_STACK_UNDERFLOW";
    case 0x0505: return "GL_OUT_OF_MEMORY";
    case 0: return "No error! How did you even reach this code?";
    default: return "Unknown error code!";
  }
}

export class OpenGL {
  gltexture = 0;
  glprogram = 0;
  linear = false;
  shader_support = false;
  buffer: Uint32Array | null = null;
  buffer_surface: Surface | null = null;
  iwidth = 0;
  iheight = 0;
  iformat = 0;
  ibpp = 32;

  static checkErrors = true;

  resize(width: number, height: number): void {
    this.iwidth = width;
    this.iheight = height;
    this.buffer_surface = new Surface(width, height, 0, 0, this.ibpp);
    this.buffer = new Uint32Array(width * height);
  }

  lock(data: { value: Uint32Array | null }, pitch: { value: number }): boolean {
    pitch.value = this.iwidth * this.ibpp;
    data.value = this.buffer;
    return !!this.buffer;
  }

  clear(): void {
    this.buffer?.fill(0);
    this.buffer_surface?.clear();
  }

  refresh(
    _smooth: boolean,
    _inwidth: number,
    _inheight: number,
    _outwidth: number,
    _outheight: number,
    _topBlackBand: number,
    _bottomBlackBand: number,
    _leftBlackBand: number,
    _rightBlackBand: number
  ): void {
    // The browser port presents through Canvas2D Screen.flip(); this keeps the
    // OpenGL output object source-shaped without doing native GL work.
  }

  set_shader(source: string | null): boolean {
    if (!source) {
      this.glprogram = 0;
      return false;
    }
    Logger.log(LOG_ERROR, `OpenGL shader ${source} is a browser boundary.`);
    this.glprogram = 0;
    return false;
  }

  set_fragment_shader(_source: string): void {}

  set_vertex_shader(_source: string): void {}

  init(width: number, height: number): void {
    this.shader_support = false;
    this.resize(width, height);
  }

  term(): void {
    this.gltexture = 0;
    this.glprogram = 0;
    this.buffer = null;
    this.buffer_surface = null;
    this.iwidth = 0;
    this.iheight = 0;
  }

  setVSync(_sync: boolean): void {}
}
