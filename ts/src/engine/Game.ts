import { Renderer } from "./Renderer";
import type { GameState, StateContext, StateTransition } from "./State";

export interface GameConfig {
  width: number;
  height: number;
  scale: number;
  autoScale?: boolean;
  minScale?: number;
  maxScale?: number;
  viewportPadding?: number;
}

export class Game {
  private readonly renderer: Renderer;
  private readonly config: GameConfig;
  private currentState: GameState | null = null;
  private running = false;
  private rafId = 0;
  private lastTs = 0;

  constructor(parent: HTMLElement, config: GameConfig) {
    this.config = config;
    this.renderer = new Renderer(parent, config.width, config.height, config.scale);
    this.applyViewportScale();
    window.addEventListener("resize", this.applyViewportScale);

    this.renderer.getCanvas().addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("keydown", this.onKeyDown);
  }

  run(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    this.tick(this.lastTs);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.applyViewportScale);
    window.removeEventListener("keydown", this.onKeyDown);
    this.renderer.getCanvas().removeEventListener("pointerdown", this.onPointerDown);
  }

  setState(next: GameState): void {
    if (this.currentState?.exit) {
      this.currentState.exit(this.ctx());
    }
    this.currentState = next;
    this.currentState.enter?.(this.ctx());
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  private tick = (timestamp: number): void => {
    if (!this.running || !this.currentState) return;

    const dtMs = Math.min(50, timestamp - this.lastTs);
    this.lastTs = timestamp;

    const transition = this.currentState.update(this.ctx(), dtMs);
    this.applyTransition(transition);
    this.currentState.render(this.ctx());
    this.renderer.present();

    this.rafId = requestAnimationFrame(this.tick);
  };

  private applyTransition(transition: StateTransition | void): void {
    if (!transition || transition.type === "none") return;
    if (transition.type === "quit") {
      this.stop();
      return;
    }
    this.setState(transition.next);
  }

  private ctx(): StateContext {
    return { game: this };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.currentState?.onPointerDown) return;
    const pos = this.renderer.toLogicalCoordinates(event.clientX, event.clientY);
    const transition = this.currentState.onPointerDown(this.ctx(), pos.x, pos.y);
    this.applyTransition(transition);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.currentState?.onKeyDown) return;
    const transition = this.currentState.onKeyDown(this.ctx(), event);
    if (transition && transition.type !== "none") {
      event.preventDefault();
    }
    this.applyTransition(transition);
  };

  private applyViewportScale = (): void => {
    if (this.config.autoScale === false) {
      return;
    }
    this.renderer.fitToViewport(
      window.innerWidth,
      window.innerHeight,
      this.config.viewportPadding ?? 24,
      this.config.minScale ?? 1,
      this.config.maxScale ?? 6
    );
  };
}
