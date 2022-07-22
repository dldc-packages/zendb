export type IDriverAny = IDriver<IDriverDatabaseAny>;
export interface IDriver<DriverDatabase extends IDriverDatabaseAny> {
  connect(path: string): DriverDatabase;
  remove(path: string): void;
  rename(oldPath: string, newPath: string): void;
}

export type IDriverDatabaseAny = IDriverDatabase<IDriverStatement>;
export interface IDriverDatabase<DriverStatement extends IDriverStatement> {
  prepare(source: string): DriverStatement;
  transaction(fn: () => void): void;
  exec(source: string): this;
  close(): void;
  getUserVersion(): number;
  setUserVersion(version: number): void;
}

export interface IDriverStatement {
  run(...params: Array<any>): { changes: number };
  all(...params: Array<any>): any[];
  bind(...params: Array<any>): this;
  free(): void;
}
