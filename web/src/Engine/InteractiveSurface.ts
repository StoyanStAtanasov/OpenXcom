import { Surface } from "./Surface.ts";
import { Action } from "./Action.ts";
import type { State } from "./State.ts";
import { KMOD_ALT, KMOD_CTRL, KMOD_SHIFT, SDL_BUTTON_LEFT, SDL_MOUSEBUTTONDOWN, SDL_MOUSEBUTTONUP, SDL_MOUSEMOTION, SDL_KEYDOWN, SDL_KEYUP } from "../types.ts";

export type ActionHandler = (action: Action) => void;

function buttonMask(button: number): number {
  return 1 << (button - 1);
}

export class InteractiveSurface extends Surface {
  private static NUM_BUTTONS = 7;
  static SDLK_ANY = "*";
  private _buttonsPressed = 0;
  protected _click = new Map<number, ActionHandler>();
  protected _press = new Map<number, ActionHandler>();
  protected _release = new Map<number, ActionHandler>();
  protected _in: ActionHandler | null = null;
  protected _over: ActionHandler | null = null;
  protected _out: ActionHandler | null = null;
  protected _keyPress = new Map<string, ActionHandler>();
  protected _keyRelease = new Map<string, ActionHandler>();
  protected _isHovered = false;
  protected _isFocused = true;
  protected _listButton = false;

  isButtonPressed(button = 0): boolean {
    if (button === 0) {
      return this._buttonsPressed !== 0;
    }
    return (this._buttonsPressed & buttonMask(button)) !== 0;
  }

  protected isButtonHandled(button = 0): boolean {
    let handled = this._click.has(0) || this._press.has(0) || this._release.has(0);
    if (!handled && button !== 0) {
      handled = this._click.has(button) || this._press.has(button) || this._release.has(button);
    }
    return handled;
  }

  protected setButtonPressed(button: number, pressed: boolean): void {
    if (pressed) {
      this._buttonsPressed |= buttonMask(button);
    } else {
      this._buttonsPressed &= ~buttonMask(button);
    }
  }

  override setVisible(visible: boolean): void {
    super.setVisible(visible);
    if (!visible) {
      this.unpress(null);
    }
  }

  handle(action: Action, state: State): void {
    if (!this._visible || this._hidden) {
      return;
    }
    action.setSender(this);
    const details = action.getDetails();
    if (details.type === SDL_MOUSEBUTTONUP || details.type === SDL_MOUSEBUTTONDOWN) {
      const button = details.button;
      if (button) {
        action.setMouseAction(button.x, button.y, this.getX(), this.getY());
      }
    } else if (details.type === SDL_MOUSEMOTION) {
      const motion = details.motion;
      if (motion) {
        action.setMouseAction(motion.x, motion.y, this.getX(), this.getY());
      }
    }

    if (action.isMouseAction()) {
      if (
        action.getAbsoluteXMouse() >= this.getX() &&
        action.getAbsoluteXMouse() < this.getX() + this.getWidth() &&
        action.getAbsoluteYMouse() >= this.getY() &&
        action.getAbsoluteYMouse() < this.getY() + this.getHeight()
      ) {
        if (!this._isHovered) {
          this._isHovered = true;
          this.mouseIn(action, state);
        }
        this.mouseOver(action, state);
      } else if (this._isHovered) {
        this._isHovered = false;
        this.mouseOut(action, state);
      }
    }

    if (details.type === SDL_MOUSEBUTTONDOWN && details.button) {
      if (this._isHovered && !this.isButtonPressed(details.button.button)) {
        this.setButtonPressed(details.button.button, true);
        this.mousePress(action, state);
      }
    } else if (details.type === SDL_MOUSEBUTTONUP && details.button) {
      if (this.isButtonPressed(details.button.button)) {
        this.setButtonPressed(details.button.button, false);
        this.mouseRelease(action, state);
        if (this._isHovered) {
          this.mouseClick(action, state);
        }
      }
    }

    if (this._isFocused) {
      if (details.type === SDL_KEYDOWN) {
        this.keyboardPress(action, state);
      } else if (details.type === SDL_KEYUP) {
        this.keyboardRelease(action, state);
      }
    }
  }

  setFocus(focus: boolean): void {
    this._isFocused = focus;
  }

  isFocused(): boolean {
    return this._isFocused;
  }

  unpress(state: State | null): void {
    if (this.isButtonPressed()) {
      this._buttonsPressed = 0;
      const action = new Action({ type: SDL_MOUSEBUTTONUP, button: { x: 0, y: 0, button: SDL_BUTTON_LEFT } }, 0, 0, 0, 0);
      if (state) {
        this.mouseRelease(action, state);
      }
    }
  }

  onMouseClick(handler: ActionHandler | null, button = SDL_BUTTON_LEFT): void {
    this.setHandler(this._click, button, handler);
  }

  onMousePress(handler: ActionHandler | null, button = 0): void {
    this.setHandler(this._press, button, handler);
  }

  onMouseRelease(handler: ActionHandler | null, button = 0): void {
    this.setHandler(this._release, button, handler);
  }

  onMouseIn(handler: ActionHandler | null): void {
    this._in = handler;
  }

  onMouseOver(handler: ActionHandler | null): void {
    this._over = handler;
  }

  onMouseOut(handler: ActionHandler | null): void {
    this._out = handler;
  }

  onKeyboardPress(handler: ActionHandler | null, key = InteractiveSurface.SDLK_ANY): void {
    this.setHandler(this._keyPress, key, handler);
  }

  onKeyboardRelease(handler: ActionHandler | null, key = InteractiveSurface.SDLK_ANY): void {
    this.setHandler(this._keyRelease, key, handler);
  }

  mousePress(action: Action, _state: State): void {
    this.callMouseHandlers(this._press, action);
  }

  mouseRelease(action: Action, _state: State): void {
    this.callMouseHandlers(this._release, action);
  }

  mouseClick(action: Action, _state: State): void {
    this.callMouseHandlers(this._click, action);
  }

  mouseIn(action: Action, _state: State): void {
    this._in?.(action);
  }

  mouseOver(action: Action, _state: State): void {
    this._over?.(action);
  }

  mouseOut(action: Action, _state: State): void {
    this._out?.(action);
  }

  keyboardPress(action: Action, _state: State): void {
    this.callKeyboardHandlers(this._keyPress, action);
  }

  keyboardRelease(action: Action, _state: State): void {
    this.callKeyboardHandlers(this._keyRelease, action);
  }

  setListButton(): void {
    this._listButton = true;
  }

  private setHandler<K>(map: Map<K, ActionHandler>, key: K, handler: ActionHandler | null): void {
    if (handler) {
      map.set(key, handler);
    } else {
      map.delete(key);
    }
  }

  private callMouseHandlers(map: Map<number, ActionHandler>, action: Action): void {
    const button = action.getDetails().button?.button || 0;
    map.get(0)?.(action);
    map.get(button)?.(action);
  }

  private callKeyboardHandlers(map: Map<string, ActionHandler>, action: Action): void {
    const key = action.getDetails().key?.keysym.sym || "";
    map.get(InteractiveSurface.SDLK_ANY)?.(action);
    const mod = ((action.getDetails().key?.keysym.mod || 0) & (KMOD_CTRL | KMOD_ALT | KMOD_SHIFT)) !== 0;
    if (!mod) {
      map.get(key)?.(action);
    }
  }
}
