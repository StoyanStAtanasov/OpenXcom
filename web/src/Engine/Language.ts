import { LocalizedText } from "./LocalizedText.ts";
import { Options } from "./Options.ts";
import { TOK_COLOR_FLIP, TOK_NL_SMALL } from "./Unicode.ts";

export const DIRECTION_LTR = "DIRECTION_LTR";
export const DIRECTION_RTL = "DIRECTION_RTL";
export const WRAP_WORDS = "WRAP_WORDS";
export const WRAP_LETTERS = "WRAP_LETTERS";

export class Language {
  private strings = new Map<string, string>();
  private direction = DIRECTION_LTR;
  private wrapping = WRAP_WORDS;

  async loadFile(path: string): Promise<void> {
    const url = `${Options.assetBase}/${path}`.replaceAll("\\", "/");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${url}: ${response.status} ${response.statusText}`);
    }
    this.loadYaml(await response.text());
  }

  loadYaml(source: string): void {
    let currentKey = "";
    let pluralParent = "";
    let block: string[] | null = null;
    const pluralKeys = new Set(["zero", "one", "two", "few", "many", "other"]);
    for (const raw of source.split(/\r?\n/)) {
      const line = raw.replace(/\t/g, "    ");
      if (!line.trim() || line.trimStart().startsWith("#")) {
        continue;
      }
      if (block && /^  /.test(line)) {
        block.push(line.replace(/^  /, ""));
        continue;
      }
      if (block) {
        this.strings.set(currentKey, block.join("\n").trimEnd());
        block = null;
      }
      const match = /^\s*([A-Za-z0-9_.$-]+):(?:\s*(.*))?$/.exec(line);
      if (!match) {
        continue;
      }
      const indent = line.search(/\S|$/);
      currentKey = match[1];
      const value = match[2] || "";
      if (pluralParent && indent > 2 && pluralKeys.has(currentKey)) {
        this.strings.set(`${pluralParent}_${currentKey}`, this.unquote(value));
        continue;
      }
      if (value === "|") {
        pluralParent = "";
        block = [];
      } else {
        this.strings.set(currentKey, this.unquote(value));
        pluralParent = value === "" && indent > 0 ? currentKey : "";
      }
    }
    if (block) {
      this.strings.set(currentKey, block.join("\n").trimEnd());
    }
  }

  getString(id: string, n?: number): LocalizedText {
    if (n != null) {
      if ((n === 0 || n === 1) && (this.strings.has(`${id}_MALE`) || this.strings.has(`${id}_FEMALE`))) {
        return new LocalizedText(this.strings.get(`${id}_${n === 0 ? "MALE" : "FEMALE"}`) || id);
      }
      const plural = this.strings.get(`${id}_${n}`) ||
        (n === 0 ? this.strings.get(`${id}_zero`) : undefined) ||
        this.strings.get(`${id}_${n === 1 ? "one" : "other"}`);
      if (plural) {
        return new LocalizedText(plural.replaceAll("{N}", String(n)));
      }
    }
    return new LocalizedText(this.strings.get(id) || id);
  }

  getTextDirection(): string {
    return this.direction;
  }

  getTextWrapping(): string {
    return this.wrapping;
  }

  private unquote(value: string): string {
    const trimmed = value.trim();
    const replaceTokens = (str: string) => str
      .replaceAll("{NEWLINE}", "\n")
      .replaceAll("{SMALLLINE}", String.fromCharCode(TOK_NL_SMALL))
      .replaceAll("{ALT}", String.fromCharCode(TOK_COLOR_FLIP));
    if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return replaceTokens(trimmed.slice(1, -1).replace(/\\"/g, "\""));
    }
    return replaceTokens(trimmed);
  }
}
