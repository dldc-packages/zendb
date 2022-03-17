import { fingerprintString, mapObject, PRIV, isNotNull } from './Utils';
import DB from 'better-sqlite3';
import { SchemaAny } from './schema';
import { DatabaseTable } from './DatabaseTable';
import { ExtractTable } from './DatabaseTableQuery';
import { builder as b, Node, printNode } from 'zensqlite';

export type VariableArgFunction = (...params: any[]) => any;
export type ArgumentTypes<F extends VariableArgFunction> = F extends (...args: infer A) => any
  ? A
  : never;

export interface Transaction<F extends VariableArgFunction> {
  (...params: ArgumentTypes<F>): ReturnType<F>;
  default(...params: ArgumentTypes<F>): ReturnType<F>;
  deferred(...params: ArgumentTypes<F>): ReturnType<F>;
  immediate(...params: ArgumentTypes<F>): ReturnType<F>;
  exclusive(...params: ArgumentTypes<F>): ReturnType<F>;
}

export class Database<Schema extends SchemaAny> {
  private db: DB.Database | null = null;
  private readonly schemaQueries: Array<string>;

  readonly schema: Schema;
  readonly fingerpring: number;
  readonly tables: {
    [K in keyof Schema['tables']]: DatabaseTable<Schema, K, ExtractTable<Schema, K>>;
  };

  constructor(schema: Schema, id: number = 0) {
    this.schemaQueries = schemaToCreateTableQueries(schema);
    this.schema = schema;
    this.fingerpring = fingerprintString(
      // add id to allow same schema in multiple mutations (different hash)
      id + '_' + this.schemaQueries.join('\n'),
      Math.pow(2, 30)
    );
    const getDb = this.ensureConnected.bind(this);
    this.tables = mapObject(schema.tables, (tableName) => {
      return new DatabaseTable(schema, tableName, getDb);
    });
  }

  connect(path: string) {
    if (this.db) {
      throw new Error('Database already connected');
    }
    this.db = new DB(path);
  }

  transaction<F extends VariableArgFunction>(fn: F): Transaction<F> {
    return this.ensureConnected().transaction(fn);
  }

  backup(destinationFile: string, options?: DB.BackupOptions) {
    return this.ensureConnected().backup(destinationFile, options);
  }

  getUserVersion(): number {
    return this.ensureConnected().pragma(`user_version`, { simple: true });
  }

  setUserVersion() {
    this.ensureConnected().pragma(`user_version = ${this.fingerpring}`);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  initSchema() {
    const db = this.ensureConnected();
    const selectTablesQuery = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`);
    const currentTables = selectTablesQuery.all();
    if (currentTables.length) {
      throw new Error(`Cannot init schema on non-empty database`);
    }
    this.schemaQueries.forEach((query) => {
      console.log('-> ' + query);
      db.exec(query);
    });
  }

  private ensureConnected(): DB.Database {
    if (this.db === null) {
      throw new Error('Not Connected');
    }
    return this.db;
  }
}

function schemaToCreateTableQueries(schema: SchemaAny): Array<string> {
  const { tables } = schema;
  const queries = Object.entries(tables).map(([tableName, table]) => {
    const { columns } = table[PRIV];
    const columnsEntries = Object.entries(columns);
    const primaryKeys = columnsEntries
      .filter(([, column]) => column[PRIV].primary)
      .map(([columnName]) => columnName);
    if (primaryKeys.length === 0) {
      throw new Error(`No primary key found for table ${tableName}`);
    }
    const multiPrimaryKey = primaryKeys.length > 1;
    const tableConstraint = multiPrimaryKey
      ? [b.TableConstraint.PrimaryKey(primaryKeys)]
      : undefined;

    const node = b.CreateTableStmt(
      tableName,
      columnsEntries.map(([columnName, column]): Node<'ColumnDef'> => {
        const { datatype, nullable, primary, unique } = column[PRIV];
        const dt = datatype.type;
        return b.ColumnDef(
          columnName,
          dt,
          [
            !nullable ? b.ColumnConstraint.NotNull() : null,
            primary && !multiPrimaryKey ? b.ColumnConstraint.PrimaryKey() : null,
            unique ? b.ColumnConstraint.Unique() : null,
          ].filter(isNotNull)
        );
      }),
      { strict: schema.strict ? true : undefined, tableConstraints: tableConstraint }
    );

    return printNode(node);
  });
  return queries;
}
