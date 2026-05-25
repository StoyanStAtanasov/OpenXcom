export enum OptionType {
  OPTION_BOOL,
  OPTION_INT,
  OPTION_KEY,
  OPTION_STRING
}

export class OptionInfo {
  private _type: OptionType;

  constructor(
    private _id: string,
    private _owner: object,
    private _key: string,
    private _default: boolean | number | string,
    private _desc = "",
    private _cat = ""
  ) {
    if (typeof _default === "boolean") {
      this._type = OptionType.OPTION_BOOL;
    } else if (typeof _default === "number") {
      this._type = OptionType.OPTION_INT;
    } else if (_key.toLowerCase().startsWith("key")) {
      this._type = OptionType.OPTION_KEY;
    } else {
      this._type = OptionType.OPTION_STRING;
    }
  }

  load(node: Record<string, unknown>): void {
    if (Object.prototype.hasOwnProperty.call(node, this._id)) {
      this.set(node[this._id] as never);
    }
  }

  save(node: Record<string, unknown>): void {
    node[this._id] = this.get();
  }

  reset(): void {
    this.set(this._default as never);
  }

  type(): OptionType {
    return this._type;
  }

  description(): string {
    return this._desc;
  }

  category(): string {
    return this._cat;
  }

  id(): string {
    return this._id;
  }

  get(): boolean | number | string {
    return (this._owner as Record<string, unknown>)[this._key] as boolean | number | string;
  }

  set(value: boolean | number | string): void {
    const owner = this._owner as Record<string, unknown>;
    switch (this._type) {
      case OptionType.OPTION_BOOL:
        owner[this._key] = Boolean(value);
        break;
      case OptionType.OPTION_INT:
        owner[this._key] = Number(value) || 0;
        break;
      case OptionType.OPTION_KEY:
      case OptionType.OPTION_STRING:
      default:
        owner[this._key] = String(value);
        break;
    }
  }

  asBool(): { value: boolean } {
    const thisInfo = this;
    return {
      get value() { return Boolean(thisInfo.get()); },
      set value(value: boolean) { thisInfo.set(value); }
    };
  }

  asInt(): { value: number } {
    const thisInfo = this;
    return {
      get value() { return Number(thisInfo.get()) || 0; },
      set value(value: number) { thisInfo.set(value); }
    };
  }

  asKey(): { value: string } {
    const thisInfo = this;
    return {
      get value() { return String(thisInfo.get()); },
      set value(value: string) { thisInfo.set(value); }
    };
  }

  asString(): { value: string } {
    return this.asKey();
  }
}
