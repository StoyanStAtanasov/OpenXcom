import { InteractiveSurface } from "../Engine/InteractiveSurface.ts";
import type { Action } from "../Engine/Action.ts";
import type { Font } from "../Engine/Font.ts";
import type { Language } from "../Engine/Language.ts";
import { Palette } from "../Engine/Palette.ts";
import type { State } from "../Engine/State.ts";
import { Surface } from "../Engine/Surface.ts";
import { SDL_BUTTON_WHEELDOWN, SDL_BUTTON_WHEELUP } from "../types.ts";
import { ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT, Text } from "./Text.ts";

type TextHAlign = typeof ALIGN_LEFT | typeof ALIGN_CENTER | typeof ALIGN_RIGHT;
export const ARROW_VERTICAL = "ARROW_VERTICAL";
export const ARROW_HORIZONTAL = "ARROW_HORIZONTAL";
type ArrowOrientation = typeof ARROW_VERTICAL | typeof ARROW_HORIZONTAL;

export class TextList extends InteractiveSurface {
  private _texts: Text[][] = [];
  private _columns: number[] = [];
  private _rows: number[] = [];
  private _big: Font | null = null;
  private _small: Font | null = null;
  private _font: Font | null = null;
  private _lang: Language | null = null;
  private _scroll = 0;
  private _visibleRows = 0;
  private _selRow = 0;
  private _color = 0;
  private _color2 = 0;
  private _align = new Map<number, TextHAlign>();
  private _dot = false;
  private _selectable = false;
  private _condensed = false;
  private _contrast = false;
  private _wrap = false;
  private _flooding = false;
  private _bg: Surface | null = null;
  private _selector: Surface | null = null;
  private _margin = 0;
  private _scrolling = true;
  private _scrollPos = 4;
  private _arrowPos = -1;
  private _arrowType: ArrowOrientation = ARROW_VERTICAL;
  private _arrowColor = -1;
  private _leftClick: ((action: Action) => void) | null = null;
  private _leftPress: ((action: Action) => void) | null = null;
  private _leftRelease: ((action: Action) => void) | null = null;
  private _rightClick: ((action: Action) => void) | null = null;
  private _rightPress: ((action: Action) => void) | null = null;
  private _rightRelease: ((action: Action) => void) | null = null;
  private _arrowsLeftEdge = 0;
  private _arrowsRightEdge = 0;

  override setX(x: number): void {
    super.setX(x);
    if (this._arrowPos >= 0) {
      this._arrowsLeftEdge = this.getX() + this._arrowPos;
      this._arrowsRightEdge = this._arrowsLeftEdge + 23;
    }
    if (this._selector) {
      this._selector.setX(this.getX());
    }
  }

  override setY(y: number): void {
    super.setY(y);
    if (this._selector) {
      this._selector.setY(this.getY());
    }
  }

  override unpress(state: State | null): void {
    super.unpress(state);
  }

  setCellColor(row: number, column: number, color: number): void {
    this._texts[row]?.[column]?.setColor(color);
    this.invalidate();
  }

  setRowColor(row: number, color: number): void {
    for (const text of this._texts[row] || []) {
      text.setColor(color);
    }
    this.invalidate();
  }

  getCellText(row: number, column: number): string {
    return this._texts[row]?.[column]?.getText() || "";
  }

  setCellText(row: number, column: number, text: string): void {
    this._texts[row]?.[column]?.setText(text);
    this.invalidate();
  }

  getColumnX(column: number): number {
    return this.getX() + (this._texts[0]?.[column]?.getX() || 0);
  }

  getRowY(row: number): number {
    return this.getY() + (this._texts[row]?.[0]?.getY() || 0);
  }

  getTextHeight(row: number): number {
    return this._texts[row]?.[0]?.getTextHeight() || 0;
  }

  getNumTextLines(row: number): number {
    return this._texts[row]?.[0]?.getNumLines() || 0;
  }

  getTexts(): number {
    return this._texts.length;
  }

  getRows(): number {
    return this._rows.length;
  }

  getVisibleRows(): number {
    return this._visibleRows;
  }

  addRow(cols: number, ...cells: string[]): void {
    const ncols = cols > 0 ? cols : 1;
    const row: Text[] = [];
    let rowX = 0;
    let rowY = 0;
    let rows = 1;
    let rowHeight = 0;
    if (this._texts.length > 0 && this._font) {
      const previous = this._texts[this._texts.length - 1][0];
      rowY = previous.getY() + previous.getHeight() + this._font.getSpacing();
    }

    for (let i = 0; i < ncols; ++i) {
      const width = this._flooding ? 340 : (this._columns[i] || this.getWidth());
      const text = new Text(width, this._font?.getHeight() || 0, this._margin + rowX, rowY);
      text.setPalette(this.getPalette());
      text.initText(this._big, this._small, this._lang);
      text.setColor(this._color);
      text.setSecondaryColor(this._color2);
      const align = this._align.get(i);
      if (align) {
        text.setAlign(align);
      }
      text.setHighContrast(this._contrast);
      if (this._font === this._big) {
        text.setBig();
      } else {
        text.setSmall();
      }
      if (cols > 0) {
        text.setText(cells[i] || "");
      }
      const vmargin = (this._font?.getHeight() || 0) - text.getTextHeight();
      if (this._wrap && text.getTextWidth() > text.getWidth()) {
        text.setWordWrap(true, true);
        rows = Math.max(rows, text.getNumLines());
      }
      rowHeight = Math.max(rowHeight, text.getTextHeight() + vmargin);

      if (this._dot && i < cols - 1 && this._font) {
        let buf = text.getText();
        let w = text.getTextWidth();
        while (w < (this._columns[i] || 0)) {
          if (this._align.get(i) !== "ALIGN_RIGHT") {
            w += this._font.getCharSize(".".codePointAt(0)!).w;
            buf += ".";
          }
          if (this._align.get(i) !== "ALIGN_LEFT") {
            w += this._font.getCharSize(".".codePointAt(0)!).w;
            buf = `.${buf}`;
          }
        }
        text.setText(buf);
      }

      row.push(text);
      rowX += this._condensed ? text.getTextWidth() : (this._columns[i] || 0);
    }

    for (const text of row) {
      text.setHeight(rowHeight);
    }
    this._texts.push(row);
    for (let i = 0; i < rows; ++i) {
      this._rows.push(this._texts.length - 1);
    }
    this.invalidate();
  }

  setColumns(cols: number, ...columns: number[]): void {
    this._columns = columns.slice(0, cols);
  }

  override setPalette(colors: ReturnType<typeof this.getPalette>, firstcolor = 0, ncolors = colors.length): void {
    super.setPalette(colors, firstcolor, ncolors);
    for (const row of this._texts) {
      for (const text of row) {
        text.setPalette(colors, firstcolor, ncolors);
      }
    }
    this._selector?.setPalette(colors, firstcolor, ncolors);
  }

  override initText(big?: unknown, small?: unknown, lang?: unknown): void {
    this._big = (big as Font | null) || this._big;
    this._small = (small as Font | null) || this._small || this._big;
    this._font = this._small;
    this._lang = (lang as Language | null) || this._lang;
    this.makeSelector(this._font);
    this.updateVisible();
  }

  override setHeight(height: number): void {
    super.setHeight(height);
    this.updateVisible();
  }

  override setColor(color: number): void {
    this._color = color;
    for (const row of this._texts) {
      for (const text of row) {
        text.setColor(color);
      }
    }
    this.invalidate();
  }

  getColor(): number {
    return this._color;
  }

  override setSecondaryColor(color: number): void {
    this._color2 = color;
    for (const row of this._texts) {
      for (const text of row) {
        text.setSecondaryColor(color);
      }
    }
    this.invalidate();
  }

  getSecondaryColor(): number {
    return this._color2;
  }

  setWordWrap(wrap: boolean): void {
    this._wrap = wrap;
  }

  override setHighContrast(contrast: boolean): void {
    this._contrast = contrast;
    for (const row of this._texts) {
      for (const text of row) {
        text.setHighContrast(contrast);
      }
    }
    this.invalidate();
  }

  setAlign(align: TextHAlign, col = -1): void {
    if (col === -1) {
      for (let i = 0; i < this._columns.length; ++i) {
        this._align.set(i, align);
      }
    } else {
      this._align.set(col, align);
    }
  }

  setDot(dot: boolean): void {
    this._dot = dot;
  }

  setArrowColumn(pos: number, type: ArrowOrientation): void {
    this._arrowPos = pos;
    this._arrowType = type;
    this._arrowsLeftEdge = this.getX() + this._arrowPos;
    this._arrowsRightEdge = this._arrowsLeftEdge + 23;
    this.invalidate();
  }

  getArrowsLeftEdge(): number {
    return this._arrowsLeftEdge;
  }

  getArrowsRightEdge(): number {
    return this._arrowsRightEdge;
  }

  setArrowColor(color: number): void {
    this._arrowColor = color;
    this.invalidate();
  }

  onLeftArrowClick(handler: ((action: Action) => void) | null): void {
    this._leftClick = handler;
  }

  onLeftArrowPress(handler: ((action: Action) => void) | null): void {
    this._leftPress = handler;
  }

  onLeftArrowRelease(handler: ((action: Action) => void) | null): void {
    this._leftRelease = handler;
  }

  onRightArrowClick(handler: ((action: Action) => void) | null): void {
    this._rightClick = handler;
  }

  onRightArrowPress(handler: ((action: Action) => void) | null): void {
    this._rightPress = handler;
  }

  onRightArrowRelease(handler: ((action: Action) => void) | null): void {
    this._rightRelease = handler;
  }

  setSelectable(selectable: boolean): void {
    this._selectable = selectable;
  }

  setBig(): void {
    this._font = this._big;
    this.makeSelector(this._font);
    this.updateVisible();
  }

  setSmall(): void {
    this._font = this._small;
    this.makeSelector(this._font);
    this.updateVisible();
  }

  setCondensed(condensed: boolean): void {
    this._condensed = condensed;
  }

  getSelectedRow(): number {
    if (this._rows.length === 0 || this._selRow >= this._rows.length) {
      return -1;
    }
    return this._rows[this._selRow];
  }

  setBackground(bg: Surface): void {
    this._bg = bg;
  }

  setMargin(margin: number): void {
    this._margin = margin;
  }

  getMargin(): number {
    return this._margin;
  }

  clearList(): void {
    this.scrollUp(true, false);
    this._texts = [];
    this._rows = [];
    this.invalidate();
  }

  scrollUp(toMax: boolean, scrollByWheel = false): void {
    if (!this._scrolling || this._rows.length <= this._visibleRows || this._scroll === 0) {
      return;
    }
    if (toMax) {
      this.scrollTo(0);
    } else {
      this.scrollTo(this._scroll - (scrollByWheel ? Math.min(3, this._scroll) : 1));
    }
  }

  scrollDown(toMax: boolean, scrollByWheel = false): void {
    if (!this._scrolling || this._rows.length <= this._visibleRows || this._scroll >= this._rows.length - this._visibleRows) {
      return;
    }
    if (toMax) {
      this.scrollTo(this._rows.length - this._visibleRows);
    } else {
      this.scrollTo(this._scroll + (scrollByWheel ? 3 : 1));
    }
  }

  setScrolling(scrolling: boolean, scrollPos = 4): void {
    this._scrolling = scrolling;
    this._scrollPos = scrollPos;
  }

  override draw(): void {
    super.draw();
    if (this._rows.length === 0 || !this._font) {
      return;
    }
    let y = 0;
    for (let row = this._scroll; row > 0 && this._rows[row] === this._rows[row - 1]; --row) {
      y -= this._font.getHeight() + this._font.getSpacing();
    }
    const start = this._rows[this._scroll] || 0;
    const end = Math.min(this._texts.length, start + this._visibleRows);
    for (let i = start; i < end; ++i) {
      for (const text of this._texts[i]) {
        text.setY(y);
        text.blit(this);
      }
      this.drawRowArrows(y);
      y += (this._texts[i][0]?.getHeight() || this._font.getHeight()) + this._font.getSpacing();
    }
  }

  override blit(surface: Surface): void {
    if (this._visible && !this._hidden && this._selector?.getVisible()) {
      this._selector.blit(surface);
    }
    super.blit(surface);
  }

  override mousePress(action: Action, state: State): void {
    const button = action.getDetails().button?.button;
    if (button === SDL_BUTTON_WHEELUP) {
      this.scrollUp(false, true);
    } else if (button === SDL_BUTTON_WHEELDOWN) {
      this.scrollDown(false, true);
    }
    const arrow = this.arrowSide(action);
    if (arrow === "left") {
      this._leftPress?.(action);
    } else if (arrow === "right") {
      this._rightPress?.(action);
    }
    if (!this._selectable || this._selRow < this._rows.length) {
      super.mousePress(action, state);
    }
  }

  override mouseRelease(action: Action, state: State): void {
    const arrow = this.arrowSide(action);
    if (arrow === "left") {
      this._leftRelease?.(action);
    } else if (arrow === "right") {
      this._rightRelease?.(action);
    }
    if (!this._selectable || this._selRow < this._rows.length) {
      super.mouseRelease(action, state);
    }
  }

  override mouseClick(action: Action, state: State): void {
    const arrow = this.arrowSide(action);
    if (arrow === "left") {
      this._leftClick?.(action);
    } else if (arrow === "right") {
      this._rightClick?.(action);
    }
    if (!this._selectable || this._selRow < this._rows.length) {
      super.mouseClick(action, state);
    }
  }

  override mouseOver(action: Action, state: State): void {
    if (this._selectable && this._font) {
      const rowHeight = this._font.getHeight() + this._font.getSpacing();
      this._selRow = Math.max(0, this._scroll + Math.floor(action.getRelativeYMouse() / (rowHeight * action.getYScale())));
      if (this._selRow < this._rows.length && this._selector) {
        const selectedText = this._texts[this._rows[this._selRow]][0];
        let y = this.getY() + selectedText.getY();
        let actualHeight = selectedText.getHeight() + this._font.getSpacing();
        if (y < this.getY() || y + actualHeight > this.getY() + this.getHeight()) {
          actualHeight = Math.trunc(actualHeight / 2);
        }
        if (y < this.getY()) {
          y = this.getY();
        }
        if (this._selector.getHeight() !== actualHeight) {
          this._selector = new Surface(this.getWidth(), actualHeight, this.getX(), y);
          this._selector.setPalette(this.getPalette());
        }
        this._selector.setY(y);
        if (this._bg) {
          this._selector.copy(this._bg);
          if (this._contrast) {
            this._selector.offsetBlock(-5);
          } else {
            this._selector.offsetBlock(-10);
          }
        } else {
          this._selector.clear(Palette.blockOffset(0) + 4);
        }
        this._selector.setVisible(true);
      } else {
        this._selector?.setVisible(false);
      }
    }
    super.mouseOver(action, state);
  }

  override mouseOut(action: Action, state: State): void {
    if (this._selectable) {
      this._selector?.setVisible(false);
    }
    super.mouseOut(action, state);
  }

  getScroll(): number {
    return this._scroll;
  }

  scrollTo(scroll: number): void {
    if (!this._scrolling || this._rows.length <= this._visibleRows) {
      return;
    }
    this._scroll = Math.max(0, Math.min(scroll, this._rows.length - this._visibleRows));
    this.invalidate();
  }

  getScrollbarColor(): number {
    return this._color;
  }

  setFlooding(flooding: boolean): void {
    this._flooding = flooding;
  }

  private makeSelector(font: Font | null): void {
    this._selector = new Surface(this.getWidth(), (font?.getHeight() || 0) + (font?.getSpacing() || 0), this.getX(), this.getY());
    this._selector.setPalette(this.getPalette());
    this._selector.setVisible(false);
  }

  private updateVisible(): void {
    if (!this._font) {
      return;
    }
    this._visibleRows = 0;
    for (let y = 0; y < this.getHeight(); y += this._font.getHeight() + this._font.getSpacing()) {
      ++this._visibleRows;
    }
  }

  private arrowSide(action: Action): "left" | "right" | null {
    if (this._arrowPos < 0 || this._selRow >= this._rows.length) {
      return null;
    }
    const x = action.getAbsoluteXMouse();
    if (x < this._arrowsLeftEdge || x > this._arrowsRightEdge) {
      return null;
    }
    return x < this._arrowsLeftEdge + 12 ? "left" : "right";
  }

  private drawRowArrows(y: number): void {
    if (this._arrowPos < 0) {
      return;
    }
    const color = this._arrowColor >= 0 ? this._arrowColor : (this._color || 1);
    const leftX = this._arrowPos + 2;
    const rightX = this._arrowPos + 14;
    const topY = y + 1;
    if (this._arrowType === ARROW_VERTICAL) {
      this.drawLine(leftX + 4, topY, leftX, topY + 5, color);
      this.drawLine(leftX + 4, topY, leftX + 8, topY + 5, color);
      this.drawLine(rightX, topY + 1, rightX + 4, topY + 6, color);
      this.drawLine(rightX + 8, topY + 1, rightX + 4, topY + 6, color);
    } else {
      this.drawLine(leftX, topY + 3, leftX + 6, topY, color);
      this.drawLine(leftX, topY + 3, leftX + 6, topY + 6, color);
      this.drawLine(rightX + 8, topY + 3, rightX + 2, topY, color);
      this.drawLine(rightX + 8, topY + 3, rightX + 2, topY + 6, color);
    }
  }
}
