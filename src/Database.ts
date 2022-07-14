import { mapObject } from './Utils';
import { SchemaAny } from './schema';
import { DatabaseTable } from './DatabaseTable';
import { ExtractTable } from './DatabaseTableQuery';
import { IDriverDatabase, IDriverStatement } from './Driver';
import { schemaToCreateTableQueries } from './CreateTableUtils';

export type VariableArgFunction = (...params: any[]) => any;
export type ArgumentTypes<F extends VariableArgFunction> = F extends (...args: infer A) => any ? A : never;

export interface Transaction<F extends VariableArgFunction> {
  (...params: ArgumentTypes<F>): ReturnType<F>;
  default(...params: ArgumentTypes<F>): ReturnType<F>;
  deferred(...params: ArgumentTypes<F>): ReturnType<F>;
  immediate(...params: ArgumentTypes<F>): ReturnType<F>;
  exclusive(...params: ArgumentTypes<F>): ReturnType<F>;
}

export class Database<
  DriverStatement extends IDriverStatement,
  DriverDatabase extends IDriverDatabase<DriverStatement>,
  Schema extends SchemaAny
> {
  readonly driverDatabase: DriverDatabase;
  readonly schema: Schema;
  readonly tables: {
    [K in keyof Schema['tables']]: DatabaseTable<DriverStatement, DriverDatabase, Schema, K, ExtractTable<Schema, K>>;
  };

  private readonly createTableQueries: ReadonlyArray<string>;

  readonly fingerpring: number;

  constructor(driverDatabase: DriverDatabase, schema: Schema, fingerprint: number) {
    this.driverDatabase = driverDatabase;
    this.schema = schema;
    this.fingerpring = fingerprint;
    this.createTableQueries = schemaToCreateTableQueries(schema);
    this.tables = mapObject(schema.tables, (tableName) => {
      return new DatabaseTable(driverDatabase, schema, tableName);
    });
  }

  writeFingerprint() {
    this.driverDatabase.setUserVersion(this.fingerpring);
  }

  initSchema() {
    const selectTablesQuery = this.driverDatabase.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`);
    const currentTables = selectTablesQuery.all();
    if (currentTables.length) {
      throw new Error(`Cannot init schema on non-empty database`);
    }
    this.createTableQueries.forEach((query) => {
      // console.info('-> ' + query);
      this.driverDatabase.exec(query);
    });
  }

  close() {
    this.driverDatabase.close();
  }
}
