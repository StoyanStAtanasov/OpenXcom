import type { Renderer } from "../engine/Renderer";
import { noTransition, type StateTransition } from "../engine/State";

export interface UiWidget {
  readonly zIndex?: number;
  readonly focusable?: boolean;
  draw(renderer: Renderer): void;
  contains?(x: number, y: number): boolean;
  onPointerDown?(): StateTransition | void;
  setFocused?(focused: boolean): void;
}

export class UiState {
  private widgets: UiWidget[] = [];
  private focused: UiWidget | null = null;

  setWidgets(next: UiWidget[]): void {
    this.clearFocus();
    this.widgets = [...next].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  }

  draw(renderer: Renderer): void {
    for (const widget of this.widgets) {
      widget.draw(renderer);
    }
  }

  onPointerDown(x: number, y: number): StateTransition {
    for (let i = this.widgets.length - 1; i >= 0; i -= 1) {
      const widget = this.widgets[i];
      const interactive = Boolean(widget.onPointerDown || widget.focusable || widget.contains);
      if (!interactive) {
        continue;
      }
      if (widget.contains && !widget.contains(x, y)) {
        continue;
      }
      if (widget.focusable) {
        this.setFocus(widget);
      } else {
        this.clearFocus();
      }
      return widget.onPointerDown?.() ?? noTransition();
    }
    this.clearFocus();
    return noTransition();
  }

  onKeyDown(event: KeyboardEvent): StateTransition {
    const focusable = this.widgets.filter((widget) => widget.focusable);
    if (focusable.length === 0) {
      return noTransition();
    }

    switch (event.key) {
      case "Tab":
        this.focusNext(focusable, event.shiftKey);
        return noTransition();
      case "ArrowDown":
      case "ArrowRight":
        this.focusNext(focusable, false);
        return noTransition();
      case "ArrowUp":
      case "ArrowLeft":
        this.focusNext(focusable, true);
        return noTransition();
      case "Enter":
      case " ":
        if (!this.focused) {
          this.setFocus(focusable[0]);
          return noTransition();
        }
        return this.focused.onPointerDown?.() ?? noTransition();
      default:
        return noTransition();
    }
  }

  private setFocus(widget: UiWidget): void {
    if (this.focused === widget) {
      return;
    }
    this.focused?.setFocused?.(false);
    this.focused = widget;
    this.focused.setFocused?.(true);
  }

  private clearFocus(): void {
    if (!this.focused) return;
    this.focused.setFocused?.(false);
    this.focused = null;
  }

  private focusNext(focusable: UiWidget[], reverse: boolean): void {
    if (focusable.length === 0) return;
    if (!this.focused) {
      this.setFocus(reverse ? focusable[focusable.length - 1] : focusable[0]);
      return;
    }

    const currentIndex = focusable.indexOf(this.focused);
    if (currentIndex < 0) {
      this.setFocus(reverse ? focusable[focusable.length - 1] : focusable[0]);
      return;
    }

    const delta = reverse ? -1 : 1;
    const nextIndex = (currentIndex + delta + focusable.length) % focusable.length;
    this.setFocus(focusable[nextIndex]);
  }
}
