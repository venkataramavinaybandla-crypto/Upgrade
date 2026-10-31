import type { Logger } from '../ports/index.js';

export class ConsoleLogger implements Logger {
  private debugMode: boolean;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  info(msg: string): void {
    console.log(msg);
  }

  warn(msg: string): void {
    console.warn(`[WARN] ${msg}`);
  }

  error(msg: string): void {
    console.error(`[ERROR] ${msg}`);
  }

  debug(msg: string): void {
    if (this.debugMode) {
      console.debug(`[DEBUG] ${msg}`);
    }
  }
}
