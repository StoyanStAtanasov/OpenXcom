import "./styles.css";
import { Game } from "./engine/Game";
import { LoadingState } from "./states/LoadingState";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("Missing #app element");
}

const game = new Game(root, {
  width: 320,
  height: 200,
  scale: 3,
  autoScale: true,
  minScale: 2,
  maxScale: 6,
  viewportPadding: 24
});

game.setState(new LoadingState());
game.run();
