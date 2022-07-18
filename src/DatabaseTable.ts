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
import { IDriverDatabase, IDriverStatement } from './Driver';

export type DatabaseTableAny = DatabaseTable<IDriverStatement, IDriverDatabase<IDriverStatement>, SchemaAny, string, SchemaTableAny>;

export type DeleteOptions = { limit?: number };

export type DeleteResult = { deleted: number };

export type UpdateResult = { updated: number };

export type UpdateOptions<SchemaTable extends SchemaTableAny> = {
  limit?: number;
  where?: WhereBase<SchemaTable>;
};

export class DatabaseTable<
  DriverStatement extends IDriverStatement,
  DriverDatabase extends IDriverDatabase<DriverStatement>,
  Schema extends SchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny
> {
  readonly driverDatabase: DriverDatabase;
  readonly name: TableName;
  readonly schema: Schema;
  readonly schemaTable: SchemaTable;

  private insertStatement: IDriverStatement | null = null;

  private readonly columns: Array<[string, SchemaColumnAny]>;

  constructor(driverDatabase: DriverDatabase, schema: Schema, name: TableName) {
    this.driverDatabase = driverDatabase;
    this.name = name;
    this.schema = schema;
    this.schemaTable = (schema.tables as any)[name];
    this.columns = Object.entries(this.schemaTable[PRIV].columns);
  }

  query(): DatabaseTableQuery<DriverStatement, DriverDatabase, Schema, TableName, ExtractTable<Schema, TableName>, null, null> {
    return DatabaseTableQuery.create<DriverStatement, DriverDatabase, Schema, TableName>(this.driverDatabase, this.schema, this.name);
  }

  insert(data: InferSchemaTableInput<SchemaTable>): InferSchemaTableResult<SchemaTable> {
    const resolvedData: Record<string, any> = {};
    this.columns.forEach(([name, column]) => {
      const input = (data as any)[name];
      resolvedData[name] = serializeColumn(column, input);
    });
    const columnsArgs = this.columns.map(([name]) => resolvedData[name]);
    this.getInsertStatement().run(columnsArgs);
    return resolvedData as any;
  }

  private getInsertStatement(): IDriverStatement {
    let insertStatement = this.insertStatement;
    if (!insertStatement) {
      const params = this.columns.map(() => b.Expr.BindParameter.Indexed());
      const columns = this.columns.map(([col]) => b.Identifier(col));
      const queryNode = b.InsertStmt(this.name as string, {
        columnNames: columns,
        data: b.InsertStmtData.Values([params]),
      });
      insertStatement = this.driverDatabase.prepare(printNode(queryNode));
      this.insertStatement = insertStatement;
    }
    return insertStatement;
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
    const statement = this.driverDatabase.prepare(queryText);
    if (params !== null) {
      statement.bind(params);
    }
    const result = statement.run();
    return { deleted: result.changes };
  }

  deleteOne(condition: WhereBase<SchemaTable>): DeleteResult {
    return this.delete(condition, { limit: 1 });
  }

  update(data: Partial<Infer<SchemaTable>>, { where, limit }: UpdateOptions<SchemaTable> = {}): UpdateResult {
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
    const statement = this.driverDatabase.prepare(queryText);
    if (params !== null) {
      statement.bind(params);
    }
    const result = statement.run();
    return { updated: result.changes };
  }

  updateOne(data: Partial<Infer<SchemaTable>>, where?: WhereBase<SchemaTable>): UpdateResult {
    return this.update(data, { where, limit: 1 });
  }
}
