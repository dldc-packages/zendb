import { builder as b, printNode } from 'zensqlite';
import { Infer, ISchemaAny } from './Schema';
import { ISchemaColumnAny, SchemaColumn } from './SchemaColumn';
import { InferSchemaTableInput, InferSchemaTableResult, ISchemaTableAny } from './SchemaTable';
import { builder, IQueryBuilder, WhereBase } from './Table/builder';
import { createSetItems } from './Table/create';
import { createWhere } from './Table/createWhere';
import { ExtractTable } from './Table/types';
import { paramsFromMap } from './Table/utils';
import { PRIV } from './Utils';

export type DeleteOptions = { limit?: number };

export type DeleteResolved = {
  query: string;
  params: Record<string, any> | null;
};

export type UpdateOptions<SchemaTable extends ISchemaTableAny> = {
  limit?: number;
  where?: WhereBase<SchemaTable>;
};

export type UpdateResolved = {
  query: string;
  params: Record<string, any> | null;
};

export interface InsertResolved<SchemaTable extends ISchemaTableAny> {
  query: string;
  params: Array<any>;
  inserted: InferSchemaTableResult<SchemaTable>;
}

export interface ITable<Schema extends ISchemaAny, TableName extends keyof Schema['tables'], SchemaTable extends ISchemaTableAny> {
  query(): IQueryBuilder<Schema, TableName, ExtractTable<Schema, TableName>, null, null>;
  insert(data: InferSchemaTableInput<SchemaTable>): InsertResolved<SchemaTable>;
  delete(condition: WhereBase<SchemaTable>, options?: DeleteOptions): DeleteResolved;
  deleteOne(condition: WhereBase<SchemaTable>): DeleteResolved;
  update(data: Partial<Infer<SchemaTable>>, options?: UpdateOptions<SchemaTable>): UpdateResolved;
  updateOne(data: Partial<Infer<SchemaTable>>, where?: WhereBase<SchemaTable>): UpdateResolved;
}

export const Table = (() => {
  return { create };

  function create<Schema extends ISchemaAny, TableName extends keyof Schema['tables'], SchemaTable extends ISchemaTableAny>(
    schema: Schema,
    _tableName: TableName
  ): ITable<Schema, TableName, SchemaTable> {
    const tableName = _tableName as string;
    const schemaTable = (schema.tables as any)[tableName];
    const columns: Array<[string, ISchemaColumnAny]> = Object.entries(schemaTable[PRIV].columns);
    let insertStatement: string | null = null;

    return {
      query,
      delete: deleteFn,
      deleteOne,
      insert,
      update,
      updateOne,
    };

    function query(): IQueryBuilder<Schema, TableName, ExtractTable<Schema, TableName>, null, null> {
      return builder<Schema, TableName>(schema, _tableName);
    }

    function insert(data: InferSchemaTableInput<SchemaTable>): InsertResolved<SchemaTable> {
      const resolvedData: Record<string, any> = {};
      const parsedData: Record<string, any> = {};
      columns.forEach(([name, column]) => {
        const input = (data as any)[name];
        const serialized = SchemaColumn.serialize(column, input);
        resolvedData[name] = serialized;
        parsedData[name] = SchemaColumn.parse(column, serialized);
      });
      const columnsArgs = columns.map(([name]) => resolvedData[name]);
      return {
        query: getInsertStatement(),
        params: columnsArgs,
        inserted: parsedData as any,
      };
    }

    function deleteFn(condition: WhereBase<SchemaTable>, options: DeleteOptions = {}): DeleteResolved {
      const paramsMap = new Map<any, string>();
      const queryNode = b.DeleteStmt(tableName, {
        where: createWhere(paramsMap, schemaTable, condition, tableName),
        limit: options.limit,
      });
      const queryText = printNode(queryNode);
      const params = paramsFromMap(paramsMap);
      return { query: queryText, params };
    }

    function deleteOne(condition: WhereBase<SchemaTable>): DeleteResolved {
      return deleteFn(condition, { limit: 1 });
    }

    function update(data: Partial<Infer<SchemaTable>>, { where, limit }: UpdateOptions<SchemaTable> = {}): UpdateResolved {
      const paramsMap = new Map<any, string>();
      // const table = this.schemaTable;
      const queryNode = b.UpdateStmt(tableName, {
        where: where ? createWhere(paramsMap, schemaTable, where, tableName) : undefined,
        limit: limit,
        setItems: createSetItems(paramsMap, schemaTable, data),
      });
      const queryText = printNode(queryNode);
      const params = paramsFromMap(paramsMap);
      return { query: queryText, params };
    }

    function updateOne(data: Partial<Infer<SchemaTable>>, where?: WhereBase<SchemaTable>): UpdateResolved {
      return update(data, { where, limit: 1 });
    }

    function getInsertStatement(): string {
      if (!insertStatement) {
        const params = columns.map(() => b.Expr.BindParameter.Indexed());
        const cols = columns.map(([col]) => b.Identifier(col));
        const queryNode = b.InsertStmt(tableName, {
          columnNames: cols,
          data: b.InsertStmtData.Values([params]),
        });
        insertStatement = printNode(queryNode);
      }
      return insertStatement;
    }
  }

  // function insert<
  // Schema extends SchemaAny,
  // TableName extends keyof Schema['tables'],
  // SchemaTable extends SchemaTableAny>(schema: Schema, name: TableName, data: InferSchemaTableInput<SchemaTable>): IsertResolved {

  // }

  // function getInsertStatement(schema: SchemaAny, name: string):  {
  //   const schemaTable = (schema.tables as any)[name];
  //   const columns = Object.entries(schemaTable[PRIV].columns);
  //     const params = this.columns.map(() => b.Expr.BindParameter.Indexed());
  //     const columns = this.columns.map(([col]) => b.Identifier(col));
  //     const queryNode = b.InsertStmt(this.name as string, {
  //       columnNames: columns,
  //       data: b.InsertStmtData.Values([params]),
  //     });
  //     return (printNode(queryNode));
  // }
})();
