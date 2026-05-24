import type { RuleItem } from "../Mod/RuleItem.ts";

export class ItemContainer {
  private _qty = new Map<string, number>();

  load(node: Record<string, number> | Map<string, number> | null | undefined): void {
    this._qty.clear();
    if (!node) {
      return;
    }
    const entries = node instanceof Map ? node.entries() : Object.entries(node);
    for (const [id, qty] of entries) {
      if (id && Number.isFinite(qty)) {
        this._qty.set(id, qty);
      }
    }
  }

  save(): Record<string, number> {
    return Object.fromEntries(this._qty);
  }

  addItem(id: string, qty = 1): void {
    if (!id) {
      return;
    }
    this._qty.set(id, this.getItem(id) + qty);
  }

  removeItem(id: string, qty = 1): void {
    if (!id || !this._qty.has(id)) {
      return;
    }
    const current = this.getItem(id);
    if (qty < current) {
      this._qty.set(id, current - qty);
    } else {
      this._qty.delete(id);
    }
  }

  getItem(id: string): number {
    if (!id) {
      return 0;
    }
    return this._qty.get(id) || 0;
  }

  getTotalQuantity(): number {
    let total = 0;
    for (const qty of this._qty.values()) {
      total += qty;
    }
    return total;
  }

  getTotalSize(mod: { getItem?: (id: string, error?: boolean) => RuleItem | null } | null): number {
    let total = 0;
    for (const [id, qty] of this._qty.entries()) {
      const rule = mod?.getItem?.(id, true);
      total += (rule?.getSize() || 0) * qty;
    }
    return total;
  }

  getContents(): Map<string, number> {
    return this._qty;
  }
}
