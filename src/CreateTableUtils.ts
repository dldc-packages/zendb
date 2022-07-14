import { builder as b, Node, printNode } from 'zensqlite';
import { SchemaAny } from './schema';
import { PRIV, isNotNull } from './Utils';

export function schemaToCreateTableQueries(schema: SchemaAny): Array<string> {
  const { tables } = schema;
  const queries = Object.entries(tables).map(([tableName, table]) => {
    const { columns } = table[PRIV];
    const columnsEntries = Object.entries(columns);
    const primaryKeys = columnsEntries.filter(([, column]) => column[PRIV].primary).map(([columnName]) => columnName);
    if (primaryKeys.length === 0) {
      throw new Error(`No primary key found for table ${tableName}`);
    }
    const multiPrimaryKey = primaryKeys.length > 1;
    const tableConstraint = multiPrimaryKey ? [b.TableConstraint.PrimaryKey(primaryKeys)] : undefined;

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
