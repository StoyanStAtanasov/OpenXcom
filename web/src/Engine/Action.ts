import type { SdlEvent } from "../types.ts";

export class Action {
  private _mouseX = -1;
  private _mouseY = -1;
  private _surfaceX = -1;
  private _surfaceY = -1;
  private _sender: unknown = null;

  constructor(
    private _ev: SdlEvent,
    private _scaleX: number,
    private _scaleY: number,
    private _topBlackBand: number,
    private _leftBlackBand: number
  ) {}

  getXScale(): number {
    return this._scaleX;
  }

  getYScale(): number {
    return this._scaleY;
  }

  setMouseAction(mouseX: number, mouseY: number, surfaceX: number, surfaceY: number): void {
    this._mouseX = mouseX - this._leftBlackBand;
    this._mouseY = mouseY - this._topBlackBand;
    this._surfaceX = surfaceX;
    this._surfaceY = surfaceY;
  }

  isMouseAction(): boolean {
    return this._mouseX !== -1;
  }

  getTopBlackBand(): number {
    return this._topBlackBand;
  }

  getLeftBlackBand(): number {
    return this._leftBlackBand;
  }

  getXMouse(): number {
    return this._mouseX;
  }

  getYMouse(): number {
    return this._mouseY;
  }

  getAbsoluteXMouse(): number {
    if (this._mouseX === -1) {
      return -1;
    }
    return this._mouseX / this._scaleX;
  }

  getAbsoluteYMouse(): number {
    if (this._mouseY === -1) {
      return -1;
    }
    return this._mouseY / this._scaleY;
  }

  getRelativeXMouse(): number {
    if (this._mouseX === -1) {
      return -1;
    }
    return this._mouseX - this._surfaceX * this._scaleX;
  }

  getRelativeYMouse(): number {
    if (this._mouseY === -1) {
      return -1;
    }
    return this._mouseY - this._surfaceY * this._scaleY;
  }

  getSender(): unknown {
    return this._sender;
  }

  setSender(sender: unknown): void {
    this._sender = sender;
  }

  getDetails(): SdlEvent {
    return this._ev;
  }
}
