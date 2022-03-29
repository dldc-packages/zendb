import DB from 'better-sqlite3';
import { DatabaseTableQuery, ExtractTable, WhereBase } from './DatabaseTableQuery';
import {
  Infer,
  InferSchemaTableInput,
  InferSchemaTableResult,
  SchemaAny,
  SchemaColumnAny,
  SchemaTableAny,
  serializeColumn,
} from './schema';
import { PRIV } from './Utils';
import { builder as b, printNode } from 'zensqlite';
import { createSetItems, createWhere, paramsFromMap } from './QueryUtils';

type QueriesCache = {
  insert: DB.Statement | null;
  //   deleteByKey: DB.Statement | null;
  //   updateByKey: DB.Statement | null;
  //   selectAll: DB.Statement | null;
  //   findByKey: DB.Statement | null;
  //   countAll: DB.Statement | null;
};

// type IndexQueriesCache<IndexName extends string> = { [K in IndexName]?: DB.Statement | undefined };

export type DatabaseTableAny = DatabaseTable<SchemaAny, string, SchemaTableAny>;

export type DeleteOptions = {
  limit?: number;
};

export type DeleteResult = {
  deleted: number;
};

export type UpdateResult = {
  updated: number;
};

export type UpdateOptions<SchemaTable extends SchemaTableAny> = {
  limit?: number;
  where?: WhereBase<SchemaTable>;
};

export class DatabaseTable<
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny
> {
  readonly name: TableName;
  readonly schema: Schema;
  readonly schemaTable: SchemaTable;

  private readonly columns: Array<[string, SchemaColumnAny]>;
  private readonly getDb: () => DB.Database;

  private readonly cache: QueriesCache = {
    insert: null,
  };
  // private readonly indexQueriesCache: IndexQueriesCache<Indexes[number]['name']> = {};

  constructor(schema: Schema, name: TableName, getDb: () => DB.Database) {
    this.getDb = getDb;
    this.name = name;
    this.schema = schema;
    this.schemaTable = (schema.tables as any)[name];
    this.columns = Object.entries(this.schemaTable[PRIV].columns);
  }

  query(): DatabaseTableQuery<
    Schema,
    TableName,
    ExtractTable<Schema, TableName>,
    null,
    null,
    null
  > {
    return DatabaseTableQuery.create<Schema, TableName>(this.getDb, this.schema, this.name);
  }

  insert(data: InferSchemaTableInput<SchemaTable>): InferSchemaTableResult<SchemaTable> {
    const resolvedData: Record<string, any> = {};
    this.columns.forEach(([name, column]) => {
      const input = (data as any)[name];
      resolvedData[name] = serializeColumn(column, input);
    });
    const columnsArgs = this.columns.map(([name]) => resolvedData[name]);
    this.getInsertQuery().run(columnsArgs);
    return resolvedData as any;
  }

  delete(condition: WhereBase<SchemaTable>, options: DeleteOptions = {}): DeleteResult {
    const paramsMap = new Map<any, string>();
    const tableName = this.name as string;
    const queryNode = b.DeleteStmt(tableName, {
      where: createWhere(paramsMap, this.schemaTable, condition, tableName),
      limit: options.limit,
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(paramsMap);
    const statement = this.getDb().prepare(queryText);
    if (params !== null) {
      statement.bind(params);
    }
    const result = statement.run();
    return { deleted: result.changes };
  }

  deleteOne(condition: WhereBase<SchemaTable>): DeleteResult {
    return this.delete(condition, { limit: 1 });
  }

  update(
    data: Partial<Infer<SchemaTable>>,
    { where, limit }: UpdateOptions<SchemaTable> = {}
  ): UpdateResult {
    const paramsMap = new Map<any, string>();
    const tableName = this.name as string;
    const table = this.schemaTable;
    const queryNode = b.UpdateStmt(tableName, {
      where: where ? createWhere(paramsMap, table, where, tableName) : undefined,
      limit: limit,
      setItems: createSetItems(paramsMap, table, data),
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(paramsMap);
    const statement = this.getDb().prepare(queryText);
    if (params !== null) {
      statement.bind(params);
    }
    const result = statement.run();
    return { updated: result.changes };
  }

  updateOne(data: Partial<Infer<SchemaTable>>, where?: WhereBase<SchemaTable>): UpdateResult {
    return this.update(data, { where, limit: 1 });
  }

  private getStatement<Name extends keyof QueriesCache>(
    name: Name,
    create: () => QueriesCache[Name]
  ): NonNullable<QueriesCache[Name]> {
    if (this.cache[name] === null) {
      this.cache[name] = create();
    }
    return this.cache[name] as any;
  }

  private getInsertQuery(): DB.Statement {
    return this.getStatement('insert', (): DB.Statement => {
      const db = this.getDb();
      const params = this.columns.map(() => b.Expr.BindParameter.Indexed());
      const columns = this.columns.map(([col]) => b.Identifier(col));
      const queryNode = b.InsertStmt(this.name as string, {
        columnNames: columns,
        data: b.InsertStmtData.Values([params]),
      });
      return db.prepare(printNode(queryNode));
    });
  }
}
