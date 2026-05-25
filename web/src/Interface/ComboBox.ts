import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { Font } from "../Engine/Font.ts";
import type { Language } from "../Engine/Language.ts";
import { Options } from "../Engine/Options.ts";
import { Surface } from "../Engine/Surface.ts";
import type { State } from "../Engine/State.ts";
import { SDL_MOUSEBUTTONDOWN } from "../types.ts";
import type { PaletteColor } from "../types.ts";
import { ALIGN_CENTER } from "./Text.ts";
import { TextButton } from "./TextButton.ts";
import { TextList } from "./TextList.ts";
import { Window } from "./Window.ts";

type FontLike = {
  getHeight: () => number;
  getSpacing: () => number;
};

function getPopupWindowY(buttonHeight: number, buttonY: number, popupHeight: number, popupAboveButton: boolean): number {
  const belowButtonY = buttonY + buttonHeight;
  return popupAboveButton ? buttonY - popupHeight : belowButtonY;
}

/**
 * Text button with a source-shaped dropdown list when pressed.
 */
export class ComboBox extends InteractiveSurface {
  private static readonly HORIZONTAL_MARGIN = 2;
  private static readonly VERTICAL_MARGIN = 3;
  private static readonly MAX_ITEMS = 10;
  private static readonly BUTTON_WIDTH = 14;
  private static readonly TEXT_HEIGHT = 8;

  private _button: TextButton;
  private _arrow: Surface;
  private _window: Window;
  private _list: TextList;
  private _options: string[] = [];
  private _labels: string[] = [];
  private _sel = 0;
  private _change: ((action: Action) => void) | null = null;
  private _color = 0;
  private _arrowColor = -1;
  private _lang: Language | null = null;
  private _toggled = false;

  constructor(private _state: State, width: number, height: number, x = 0, y = 0, private _popupAboveButton = false) {
    super(width, height, x, y);
    this._button = new TextButton(width, height, x, y);
    this._button.setComboBox(this);

    this._arrow = new Surface(11, 8, x + width - ComboBox.BUTTON_WIDTH, y + 4);

    const popupHeight = ComboBox.MAX_ITEMS * ComboBox.TEXT_HEIGHT + ComboBox.VERTICAL_MARGIN * 2;
    const popupY = getPopupWindowY(height, y, popupHeight, _popupAboveButton);
    this._window = new Window(_state, width, popupHeight, x, popupY);
    this._window.setThinBorder();

    this._list = new TextList(
      width - ComboBox.HORIZONTAL_MARGIN * 2 - ComboBox.BUTTON_WIDTH + 1,
      popupHeight - (ComboBox.VERTICAL_MARGIN * 2 + 2),
      x + ComboBox.HORIZONTAL_MARGIN,
      popupY + ComboBox.VERTICAL_MARGIN
    );
    this._list.setComboBox(this);
    this._list.setColumns(1, this._list.getWidth());
    this._list.setSelectable(true);
    this._list.setBackground(this._window);
    this._list.setAlign(ALIGN_CENTER);
    this._list.setScrolling(true, 0);

    this.toggle(true);
  }

  override setX(x: number): void {
    super.setX(x);
    this._button.setX(x);
    this._arrow.setX(x + this.getWidth() - ComboBox.BUTTON_WIDTH);
    this._window.setX(x);
    this._list.setX(x + ComboBox.HORIZONTAL_MARGIN);
  }

  override setY(y: number): void {
    super.setY(y);
    this._button.setY(y);
    this._arrow.setY(y + 4);
    const popupY = getPopupWindowY(this.getHeight(), y, this._window.getHeight(), this._popupAboveButton);
    this._window.setY(popupY);
    this._list.setY(popupY + ComboBox.VERTICAL_MARGIN);
  }

  override setWidth(width: number): void {
    super.setWidth(width);
    this._button.setWidth(width);
    this._window.setWidth(width);
    this._list.setWidth(width - ComboBox.HORIZONTAL_MARGIN * 2 - ComboBox.BUTTON_WIDTH + 1);
    this._list.setColumns(1, this._list.getWidth());
    this._arrow.setX(this.getX() + width - ComboBox.BUTTON_WIDTH);
  }

  override setHeight(height: number): void {
    super.setHeight(height);
    this._button.setHeight(height);
    this.setY(this.getY());
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._lang = (lang as Language | null) || this._lang;
    this._button.initText(big as Font | undefined, small as Font | undefined, this._lang || undefined);
    this._list.initText(big as Font | undefined, small as Font | undefined, this._lang || undefined);
    this.setDropdown(this._options.length);
    this.setSelected(this._sel);
  }

  override setPalette(colors: PaletteColor[], firstcolor = 0, ncolors = 256): void {
    super.setPalette(colors, firstcolor, ncolors);
    this._button.setPalette(colors, firstcolor, ncolors);
    this._arrow.setPalette(colors, firstcolor, ncolors);
    this._window.setPalette(colors, firstcolor, ncolors);
    this._list.setPalette(colors, firstcolor, ncolors);
  }

  setBackground(bg: Surface): void {
    this._window.setBackground(bg);
  }

  override setColor(color: number): void {
    super.setColor(color);
    this._color = color;
    this.drawArrow();
    this._button.setColor(color);
    this._window.setColor(color);
    this._list.setColor(color);
  }

  getColor(): number {
    return this._color;
  }

  private drawArrow(): void {
    this._arrow.clear();
    let color = this._color + 1;
    if (color === 256) {
      color++;
    }

    let square = { x: 1, y: 2, w: 9, h: 1 };
    for (; square.w > 1; square.w -= 2) {
      this._arrow.drawRect(square, color + 2);
      square.x++;
      square.y++;
    }
    this._arrow.drawRect(square, color + 2);

    square = { x: 2, y: 2, w: 7, h: 1 };
    for (; square.w > 1; square.w -= 2) {
      this._arrow.drawRect(square, color);
      square.x++;
      square.y++;
    }
    this._arrow.drawRect(square, color);
  }

  override setHighContrast(contrast: boolean): void {
    this._button.setHighContrast(contrast);
    this._window.setHighContrast(contrast);
    this._list.setHighContrast(contrast);
    this.invalidate();
  }

  setArrowColor(color: number): void {
    this._arrowColor = color;
    this._list.setArrowColor(color);
  }

  getSelected(): number {
    return this._sel;
  }

  getHoveredListIdx(): number {
    const hovered = this._list.getVisible() ? this._list.getSelectedRow() : -1;
    return hovered === -1 ? this._sel : hovered;
  }

  setText(text: string): void {
    this._button.setText(text);
  }

  setSelected(sel: number): void {
    this._sel = Math.max(0, Math.trunc(sel));
    if (this._sel < this._list.getTexts()) {
      this._button.setText(this._list.getCellText(this._sel, 0));
    }
  }

  private setDropdown(options: number): void {
    let items = Math.min(Math.max(0, options), ComboBox.MAX_ITEMS);
    const font = this._button.getFont() as FontLike | null;
    const rowHeight = (font?.getHeight?.() ?? ComboBox.TEXT_HEIGHT) + (font?.getSpacing?.() ?? 0);
    const dy = Math.trunc((Options.baseYResolution - 200) / 2);
    while (items > 0 && this._window.getY() + items * rowHeight + ComboBox.VERTICAL_MARGIN * 2 > 200 + dy) {
      items--;
    }

    const popupHeight = items * rowHeight + ComboBox.VERTICAL_MARGIN * 2;
    const popupY = getPopupWindowY(this.getHeight(), this.getY(), popupHeight, this._popupAboveButton);
    this._window.setY(popupY);
    this._window.setHeight(popupHeight);
    this._list.setY(popupY + ComboBox.VERTICAL_MARGIN);
    this._list.setHeight(items * rowHeight);
  }

  setOptions(options: string[], translate = false): void {
    this._options = [...options];
    this._labels = translate
      ? this._options.map(option => String(this._lang?.getString?.(option) ?? this._state.tr(option)))
      : [...this._options];
    this.setDropdown(this._options.length);
    this._list.clearList();
    for (const label of this._labels) {
      this._list.addRow(1, label);
    }
    this.setSelected(this._sel);
  }

  override blit(surface: Surface): void {
    super.blit(surface);
    this._list.invalidate();
    if (this._visible && !this._hidden) {
      this._button.blit(surface);
      this._arrow.blit(surface);
      this._window.blit(surface);
      this._list.blit(surface);
    }
  }

  override handle(action: Action, state: State): void {
    if (!this._visible || this._hidden) {
      return;
    }
    this._button.handle(action, state);
    this._list.handle(action, state);
    super.handle(action, state);
    const topY = Math.min(this.getY(), this._window.getY());
    if (this._window.getVisible() && action.getDetails().type === SDL_MOUSEBUTTONDOWN &&
      (action.getAbsoluteXMouse() < this.getX() ||
        action.getAbsoluteXMouse() >= this.getX() + this.getWidth() ||
        action.getAbsoluteYMouse() < topY ||
        action.getAbsoluteYMouse() >= topY + this.getHeight() + this._window.getHeight())) {
      this.toggle();
    }
    if (this._toggled) {
      this._change?.(action);
      this._toggled = false;
    }
  }

  override think(): void {
    this._button.think();
    this._arrow.think();
    this._window.think();
    this._list.think();
    super.think();
  }

  toggle(first = false): void {
    const visible = !this._window.getVisible();
    this._window.setVisible(visible);
    this._list.setVisible(visible);
    this._state.setModal(visible ? this : null);
    if (!first && !visible) {
      this._toggled = true;
    }
    if (this._list.getVisible()) {
      if (this._sel < Math.trunc(this._list.getVisibleRows() / 2)) {
        this._list.scrollTo(0);
      } else {
        this._list.scrollTo(this._sel - Math.trunc(this._list.getVisibleRows() / 2));
      }
    }
  }

  onChange(handler: ((action: Action) => void) | null): void {
    this._change = handler;
  }

  onListMouseIn(handler: ((action: Action) => void) | null): void {
    this._list.onMouseIn(handler);
  }

  onListMouseOut(handler: ((action: Action) => void) | null): void {
    this._list.onMouseOut(handler);
  }

  onListMouseOver(handler: ((action: Action) => void) | null): void {
    this._list.onMouseOver(handler);
  }
}
