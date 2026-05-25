export function unserializeInt(cursor: { buffer: Uint8Array; offset: number }, sizeKey: number): number {
  const view = new DataView(cursor.buffer.buffer, cursor.buffer.byteOffset + cursor.offset, sizeKey);
  let ret = 0;
  switch (sizeKey) {
    case 1:
      ret = cursor.buffer[cursor.offset];
      break;
    case 2:
      ret = view.getInt16(0, true);
      break;
    case 4:
      ret = view.getUint32(0, true);
      break;
    default:
      throw new Error("invalid serialized integer size");
  }
  cursor.offset += sizeKey;
  return ret;
}

export function serializeInt(cursor: { buffer: Uint8Array; offset: number }, sizeKey: number, value: number): void {
  const view = new DataView(cursor.buffer.buffer, cursor.buffer.byteOffset + cursor.offset, sizeKey);
  switch (sizeKey) {
    case 1:
      if (value >= 256) throw new Error("uint8 overflow");
      cursor.buffer[cursor.offset] = value & 0xff;
      break;
    case 2:
      if (value >= 65536) throw new Error("uint16 overflow");
      view.setInt16(0, value, true);
      break;
    case 4:
      view.setUint32(0, value >>> 0, true);
      break;
    default:
      throw new Error("invalid serialized integer size");
  }
  cursor.offset += sizeKey;
}

export function serializeDouble(value: number): string {
  return Number(value).toPrecision(17).replace(/\.?0+$/, "");
}
