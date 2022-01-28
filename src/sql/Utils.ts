import { PRIV, expectNever } from '../Utils';
import { Column } from './Column';
import { JsonTable } from './JsonTable';
import { Param } from './Param';
import { Table } from './Table';
import { Aggregate } from './Aggregate';

export function ensureColumnsInTables(columns: Set<Column>, tables: Set<Table | JsonTable>) {
  columns.forEach((column) => {
    if (!tables.has(column[PRIV].table)) {
      console.error(column);
      throw new Error(`Column "${column[PRIV].name}" is not in any table`);
    }
    return;
  });
}

export function ensureUniqueParams(params: Set<Param>) {
  const paramNames = new Set<string>();
  params.forEach((param) => {
    const internal = param[PRIV];
    if (internal.kind === 'Anonymous') {
      return;
    }
    if (internal.kind === 'Named') {
      if (paramNames.has(internal.name)) {
        throw new Error(
          `Duplicate parameter name ${internal.name}, reuse the same param instance.`
        );
      }
      paramNames.add(internal.name);
      return;
    }
    return expectNever(internal);
  });
}

export function ensureUniqueTables(tables: Set<Table | JsonTable>) {
  const tableNames = new Set<string>();
  tables.forEach((table) => {
    const name = printTableOrJsonTableRef(table).toLowerCase();
    if (tableNames.has(name)) {
      throw new Error(`Duplicate table name ${name}, reuse the same table instance.`);
    }
    tableNames.add(name);
    return;
  });
}

export function printTableOrJsonTableRef(table: Table | JsonTable): string {
  if (table instanceof Table) {
    return Table.printRef(table);
  }
  return JsonTable.printRef(table);
}

export function printColumnOrAggregateSelect(column: Column | Aggregate): string {
  if (column instanceof Aggregate) {
    return Aggregate.printSelect(column);
  }
  return Column.printSelect(column);
}

export function printColumnOrAggregateRef(column: Column | Aggregate): string {
  if (column instanceof Aggregate) {
    return Aggregate.printRef(column);
  }
  return Column.printRef(column);
}
