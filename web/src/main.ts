import { Game } from "./Engine/Game.ts";
import { Logger, LOG_DEBUG, LOG_INFO, LOG_VERBOSE } from "./Engine/Logger.ts";
import { Options } from "./Engine/Options.ts";
import { State } from "./Engine/State.ts";
import { StartState } from "./Menu/StartState.ts";
import { OPENXCOM_VERSION_GIT, OPENXCOM_VERSION_SHORT } from "./version.ts";

const canvas = document.getElementById("openxcom");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing #openxcom canvas");
}

Logger.reportingLevel = LOG_DEBUG;
if (!Options.init()) {
  throw new Error("Options initialization failed");
}

const title = `OpenXcom ${OPENXCOM_VERSION_SHORT}${OPENXCOM_VERSION_GIT}`;
if (Options.verboseLogging) {
  Logger.reportingLevel = LOG_VERBOSE;
}
Options.baseXResolution = Options.displayWidth;
Options.baseYResolution = Options.displayHeight;

const game = new Game(title, canvas);
State.setGamePtr(game);
game.setState(new StartState());
Logger.log(LOG_INFO, "Starting browser state machine.");
game.run();

declare global {
  interface Window {
    openxcomGame?: Game;
  }
}

window.openxcomGame = game;
