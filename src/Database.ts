import { builder as b, Node, printNode } from 'zensqlite';
import { ICreateTableOperation, IListTablesOperation, IOperation, ResultFromMode } from './Operation';
import { ISchemaAny } from './Schema';
import { ITable, Table } from './Table';
import { ExtractTable } from './Table/types';
import { isNotNull, mapObject, PRIV } from './Utils';

export type ResultMode = 'Operation' | 'Result' | 'AsyncResult';

export interface IDatabase<Schema extends ISchemaAny, Mode extends ResultMode> {
  readonly tables: {
    [K in keyof Schema['tables']]: ITable<Schema, Mode, K, ExtractTable<Schema, K>>;
  };
  init(): Array<ResultFromMode<Mode, ICreateTableOperation>>;
}

export const Database = (() => {
  return {
    create,
    listTables,
  };

  function create<ISchema extends ISchemaAny, Mode extends ResultMode>(schema: ISchema): IDatabase<ISchema, 'Operation'>;
  function create<ISchema extends ISchemaAny, Mode extends ResultMode>(
    schema: ISchema,
    operationResolver: (op: IOperation) => any
  ): IDatabase<ISchema, Mode>;
  function create<ISchema extends ISchemaAny, Mode extends ResultMode>(
    schema: ISchema,
    operationResolver: (op: IOperation) => any = (op) => op
  ): IDatabase<ISchema, Mode> {
    return {
      tables: mapObject(schema.tables, (tableName) => {
        return Table.create(schema, operationResolver, tableName);
      }),
      init,
    };

    function init(): Array<ResultFromMode<Mode, ICreateTableOperation>> {
      const { tables } = schema;
      const operations = Object.entries(tables).map(([tableName, table]): ResultFromMode<Mode, ICreateTableOperation> => {
        const { columns } = table[PRIV];
        const columnsEntries = Object.entries(columns);
        const primaryKeys = columnsEntries.filter(([, column]) => column[PRIV].primary).map(([columnName]) => columnName);
        if (primaryKeys.length === 0) {
          throw new Error(`No primary key found for table ${tableName}`);
        }
        const multiPrimaryKey = primaryKeys.length > 1;
        const uniqueContraints = new Map<string | null, Array<string>>();
        columnsEntries.forEach(([columnName, column]) => {
          const { unique } = column[PRIV];
          unique.forEach(({ constraintName }) => {
            const keys = uniqueContraints.get(constraintName) || [];
            uniqueContraints.set(constraintName, [...keys, columnName]);
          });
        });

        const uniqueEntries = Array.from(uniqueContraints.entries());
        const uniqueTableContraints: Array<Node<'TableConstraint'>> = [];
        const uniqueColumns: Array<string> = [];
        uniqueEntries.forEach(([constraintName, columns]) => {
          if (columns.length > 1) {
            uniqueTableContraints.push(b.TableConstraint.Unique(columns, undefined, constraintName ?? undefined));
            return;
          }
          if (columns.length === 1) {
            uniqueColumns.push(columns[0]);
            return;
          }
          throw new Error(`Invalid unique constraint ${constraintName}`);
        });

        const tableConstraints = [...(multiPrimaryKey ? [b.TableConstraint.PrimaryKey(primaryKeys)] : []), ...uniqueTableContraints];

        const node = b.CreateTableStmt(
          tableName,
          columnsEntries.map(([columnName, column]): Node<'ColumnDef'> => {
            const { datatype, nullable, primary } = column[PRIV];
            const unique = uniqueColumns.includes(columnName);
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
          { strict: schema.strict ? true : undefined, tableConstraints: tableConstraints.length > 0 ? tableConstraints : undefined }
        );

        return operationResolver({ kind: 'CreateTable', sql: printNode(node), params: null, parse: () => null });
      });
      return operations;
    }
  }

  function listTables(): IListTablesOperation {
    const query = b.SelectStmt({
      resultColumns: [b.ResultColumn.Column('name')],
      from: b.From.Table('sqlite_master'),
      where: b.Expr.Equal(b.Expr.Column('type'), b.literal('table')),
    });
    return { kind: 'ListTables', sql: printNode(query), params: null, parse: (raw) => raw.map((row) => row.name) };
  }
})();
