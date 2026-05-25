export type ExtraStringsNode = {
  strings?: Record<string, string | Record<string, string>>;
};

export class ExtraStrings {
  private _strings = new Map<string, string>();

  load(node: ExtraStringsNode): void {
    for (const [key, value] of Object.entries(node.strings || {})) {
      if (typeof value === "string") {
        this._strings.set(key, value);
      } else {
        for (const [pluralKey, pluralValue] of Object.entries(value)) {
          this._strings.set(`${key}_${pluralKey}`, pluralValue);
        }
      }
    }
  }

  getStrings(): Map<string, string> {
    return this._strings;
  }
}
