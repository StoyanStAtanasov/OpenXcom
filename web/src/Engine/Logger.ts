export const LOG_DEBUG = 0;
export const LOG_VERBOSE = 1;
export const LOG_INFO = 2;
export const LOG_WARNING = 3;
export const LOG_ERROR = 4;

const labels = ["DEBUG", "VERBOSE", "INFO", "WARNING", "ERROR"];

export class Logger {
  static reportingLevel = LOG_INFO;
  static entries: string[] = [];

  static log(level: number, message: string): void {
    if (level >= Logger.reportingLevel) {
      const line = `[${labels[level] || "LOG"}] ${message}`;
      Logger.entries.push(line);
      console.log(line);
    }
  }

  static logFile(): string {
    return "browser console";
  }
}
