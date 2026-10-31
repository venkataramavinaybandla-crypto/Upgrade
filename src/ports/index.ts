export interface FileStat {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
}

export interface FsRead {
  readText(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<string[]>;
  stat(path: string): Promise<FileStat>;
  realpath(path: string): Promise<string>;
}

export interface FsWrite {
  writeText(path: string, content: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
}

export interface Env {
  get(name: string): string | undefined;
  names(): string[];
  platform(): 'win32' | 'darwin' | 'linux';
  cwd(): string;
  homedir(): string;
  isTty(): boolean;
}

export interface Clock {
  now(): Date;
}

export interface PromptSelectOption<T = string> {
  label: string;
  value: T;
  hint?: string;
}

export interface PromptTextOptions {
  placeholder?: string;
  defaultValue?: string;
}

export interface Prompt {
  confirm(msg: string): Promise<boolean>;
  select<T = string>(msg: string, options: PromptSelectOption<T>[]): Promise<T>;
  text(msg: string, opts?: PromptTextOptions): Promise<string>;
  pickFolder(startAt?: string): Promise<string | undefined>;
}

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

export interface Random {
  pick<T>(list: T[]): T;
  int(max: number): number;
}
