// ROLE: Defines application-level error class carrying standard CLI process exit codes.
// INPUTS: Error message string, exitCode number.
// CRITICAL: Exit codes must match the assignments in architecture.json (e.g. 2, 10, 11).

export class AppError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'AppError';
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

