export class LocalizedText {
  private argIndex = 0;

  constructor(private value: string) {}

  arg(value: unknown): LocalizedText {
    const replacement = String(value);
    const indexed = `{${this.argIndex}}`;
    if (this.value.includes(indexed)) {
      this.value = this.value.replace(indexed, replacement);
    } else {
      this.value = this.value.replace(/\{\d+\}/, replacement);
    }
    this.argIndex++;
    return this;
  }

  toString(): string {
    return this.value;
  }

  valueOf(): string {
    return this.value;
  }
}
