export type IDriverAny = IDriver<IDriverDatabaseAny>;
export interface IDriver<DriverDatabase extends IDriverDatabaseAny> {
  // open the main database
  openMain(): DriverDatabase;
  // open the migration database
  openMigration(): DriverDatabase;
  removeMain(): void;
  removeMigration(): void;
  // replace the main database with the migration database
  applyMigration(): void;
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
