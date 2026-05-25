export class Exception extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "Exception";
  }
}
