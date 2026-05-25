export type KillCriteria = Array<Array<[number, string[]]>>;

export class RuleCommendations {
  private _criteria = new Map<string, number[]>();
  private _killCriteria: KillCriteria = [];
  private _description = "";
  private _sprite = 0;

  load(node: { description?: string; criteria?: Record<string, number[]> | Map<string, number[]>; sprite?: number; killCriteria?: KillCriteria }): void {
    this._description = node.description ?? this._description;
    if (node.criteria instanceof Map) {
      this._criteria = new Map(node.criteria);
    } else if (node.criteria) {
      this._criteria = new Map(Object.entries(node.criteria));
    }
    this._sprite = node.sprite ?? this._sprite;
    this._killCriteria = node.killCriteria ?? this._killCriteria;
  }

  getDescription(): string { return this._description; }
  getCriteria(): Map<string, number[]> { return this._criteria; }
  getKillCriteria(): KillCriteria { return this._killCriteria; }
  getSprite(): number { return this._sprite; }
}
