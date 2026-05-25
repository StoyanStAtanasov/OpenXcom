export class ModInfo {
  constructor(
    private _id: string,
    private _name = "",
    private _master = false,
    private _engineOk = true,
    private _version = "",
    private _author = "",
    private _description = "",
    private _requiredExtendedEngine = ""
  ) {}

  getId(): string {
    return this._id;
  }

  getName(): string {
    return this._name || this._id;
  }

  getVersion(): string {
    return this._version;
  }

  getAuthor(): string {
    return this._author;
  }

  getDescription(): string {
    return this._description;
  }

  isMaster(): boolean {
    return this._master;
  }

  canActivate(_curMasterId: string): boolean {
    return true;
  }

  isEngineOk(): boolean {
    return this._engineOk;
  }

  getRequiredExtendedEngine(): string {
    return this._requiredExtendedEngine;
  }
}
