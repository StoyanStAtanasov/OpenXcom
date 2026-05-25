export const LODEPNG_VERSION_STRING = "20180114";

export enum LodePNGColorType {
  LCT_GREY = 0,
  LCT_RGB = 2,
  LCT_PALETTE = 3,
  LCT_GREY_ALPHA = 4,
  LCT_RGBA = 6
}

export function lodepng_error_text(code: number): string {
  return code === 0 ? "no error" : `lodepng browser boundary error ${code}`;
}

export async function lodepng_decode_file(filename: string): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const image = await loadImage(filename);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  ctx.drawImage(image, 0, 0);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: rgba.data, w: canvas.width, h: canvas.height };
}

export async function lodepng_decode32_file(filename: string): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  return lodepng_decode_file(filename);
}

export async function lodepng_decode24_file(filename: string): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  return lodepng_decode_file(filename);
}

export function lodepng_decode_memory(_input: Uint8Array, _colorType = LodePNGColorType.LCT_RGBA, _bitDepth = 8): never {
  throw new Error("lodepng_decode_memory is not translated for raw PNG buffers yet.");
}

export function lodepng_encode_memory(_image: Uint8Array, _w: number, _h: number, _colorType = LodePNGColorType.LCT_RGBA, _bitDepth = 8): never {
  throw new Error("lodepng_encode_memory is not translated for browser runtime yet.");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`failed to load PNG ${src}`));
    image.src = src;
  });
}
