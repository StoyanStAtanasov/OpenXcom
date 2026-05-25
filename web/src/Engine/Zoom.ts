import { OpenGL } from "./OpenGL.ts";
import { Options } from "./Options.ts";
import { Screen } from "./Screen.ts";
import { Surface } from "./Surface.ts";

export class Zoom {
  static flipWithZoom(
    src: Surface,
    dst: Surface,
    topBlackBand: number,
    bottomBlackBand: number,
    leftBlackBand: number,
    rightBlackBand: number,
    glOut: OpenGL | null
  ): void {
    const dstWidth = dst.getWidth() - leftBlackBand - rightBlackBand;
    const dstHeight = dst.getHeight() - topBlackBand - bottomBlackBand;
    if (Screen.useOpenGL() && glOut?.buffer_surface) {
      src.blit(glOut.buffer_surface);
      glOut.refresh(glOut.linear, glOut.iwidth, glOut.iheight, dst.getWidth(), dst.getHeight(), topBlackBand, bottomBlackBand, leftBlackBand, rightBlackBand);
    } else if (topBlackBand <= 0 && bottomBlackBand <= 0 && leftBlackBand <= 0 && rightBlackBand <= 0) {
      Zoom._zoomSurfaceY(src, dst, 0, 0);
    } else if (dstWidth === src.getWidth() && dstHeight === src.getHeight()) {
      for (let y = 0; y < src.getHeight(); ++y) {
        for (let x = 0; x < src.getWidth(); ++x) {
          dst.setPixel(leftBlackBand + x, topBlackBand + y, src.getPixel(x, y));
        }
      }
    } else {
      const tmp = new Surface(dstWidth, dstHeight);
      Zoom._zoomSurfaceY(src, tmp, 0, 0);
      for (let y = 0; y < tmp.getHeight(); ++y) {
        for (let x = 0; x < tmp.getWidth(); ++x) {
          dst.setPixel(leftBlackBand + x, topBlackBand + y, tmp.getPixel(x, y));
        }
      }
    }
  }

  static _zoomSurfaceY(src: Surface, dst: Surface, flipx: number, flipy: number): number {
    void Options.useScaleFilter;
    const srcW = src.getWidth();
    const srcH = src.getHeight();
    const dstW = dst.getWidth();
    const dstH = dst.getHeight();
    if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
      return -1;
    }
    for (let y = 0; y < dstH; ++y) {
      const syBase = Math.trunc(y * srcH / dstH);
      const sy = flipy ? srcH - 1 - syBase : syBase;
      for (let x = 0; x < dstW; ++x) {
        const sxBase = Math.trunc(x * srcW / dstW);
        const sx = flipx ? srcW - 1 - sxBase : sxBase;
        dst.setPixel(x, y, src.getPixel(sx, sy));
      }
    }
    return 0;
  }

  static haveSSE2(): boolean {
    return false;
  }
}
