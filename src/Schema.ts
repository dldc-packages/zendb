import { Column, DataFromColumn, ColumnAny, ColumnResolved } from './Column';
import { Datatype } from './Datatype';
import { PRIV } from './Utils';

export type IndexFn<Data, T> = (data: Data) => T;

export type Index<Name extends string, Data, Column extends ColumnAny> = {
  [PRIV]: {
    data: Data;
    value: DataFromColumn<Column>;
  };
  name: Name;
  column: Column;
  fn: IndexFn<Data, DataFromColumn<Column>>;
};

export type IndexAny = Index<string, any, ColumnAny>;

export type IndexesAny<Data> = ReadonlyArray<Index<string, Data, ColumnAny>>;

export type TableKey<Data, KeyDt extends Datatype> = {
  column: Column<KeyDt, false, null>;
  fn: IndexFn<Data, DataFromColumn<Column<KeyDt, false, null>>>;
};

export type PartialTable<Data> = {
  [PRIV]: Data;
  key<KeyDt extends Datatype>(
    column: Column<KeyDt, false, null>,
    fn: IndexFn<Data, DataFromColumn<Column<KeyDt, false, null>>>
  ): Table<Data, KeyDt, []>;
};

export type Table<Data, KeyDt extends Datatype, Indexes extends IndexesAny<Data>> = {
  [PRIV]: {
    data: Data;
    key: TableKey<Data, KeyDt>;
    indexes: Indexes;
  };
  index<Name extends string, Column extends ColumnAny>(
    name: Name,
    column: Column,
    fn: IndexFn<Data, DataFromColumn<Column>>
  ): Table<Data, KeyDt, [...Indexes, Index<Name, Data, Column>]>;
};

export type TableAny = Table<any, any, IndexesAny<any>>;

export type WrappedType<T> = { [PRIV]: T };

export function type<T>(): WrappedType<T> {
  return { [PRIV]: null as any };
}

export function table<Data>(): PartialTable<Data> {
  return {
    [PRIV]: null as any,
    key<KeyDt extends Datatype>(
      column: Column<KeyDt, false, null>,
      fn: IndexFn<Data, DataFromColumn<Column<KeyDt, false, null>>>
    ) {
      return create({ column, fn }, []);
    },
  };
  function create<Data, KeyDt extends Datatype, Indexes extends IndexesAny<Data>>(
    key: TableKey<Data, KeyDt>,
    indexes: Indexes
  ): Table<Data, KeyDt, Indexes> {
    return {
      [PRIV]: {
        data: null as any,
        key,
        indexes,
      },
      index<Name extends string, Column extends ColumnAny>(
        name: Name,
        column: Column,
        fn: IndexFn<Data, DataFromColumn<Column>>
      ) {
        const index: Index<Name, Data, Column> = {
          [PRIV]: {
            data: null as any,
            value: null as any,
          },
          name,
          column,
          fn,
        };
        return create(key, [...indexes, index]);
      },
    };
  }
}

export type TablesAny = Record<string, TableAny>;

export type IndexResolved = {
  name: string;
  column: ColumnResolved;
  fn: IndexFn<any, any>;
};

export type TableResolved = {
  name: string;
  key: {
    column: ColumnResolved;
    fn: IndexFn<any, any>;
  };
  indexes: Array<IndexResolved>;
};

export type Schema<Tables extends TablesAny> = {
  [PRIV]: Tables;
  tables: Array<TableResolved>;
  sanitize: (data: unknown) => unknown;
  restore: (data: unknown) => unknown;
};

export type SchemaAny = Schema<TablesAny>;

export type SchemaOptions<Tables extends TablesAny> = {
  tables: Tables;
  sanitize?: (data: unknown) => unknown;
  restore?: (data: unknown) => unknown;
};

export function schema<Tables extends TablesAny>({
  tables,
  restore = (d) => d,
  sanitize = (d) => d,
}: SchemaOptions<Tables>): Schema<Tables> {
  return {
    [PRIV]: tables,
    sanitize,
    restore,
    tables: Object.entries(tables).map(([name, table]): TableResolved => {
      const indexesNames = new Set<string>();
      return {
        name,
        key: {
          fn: table[PRIV].key.fn,
          column: table[PRIV].key.column[PRIV],
        },
        indexes: table[PRIV].indexes.map(({ name, column, fn }): IndexResolved => {
          const nameLower = name.toLowerCase();
          if (nameLower === 'key') {
            throw new Error(`Index name 'key' is reserved`);
          }
          if (nameLower === 'data') {
            throw new Error(`Index name 'data' is reserved`);
          }
          if (nameLower === 'internal_current_key') {
            // Reserved because we use this name in the UPDATE query
            throw new Error(`Index name 'internal_current_key' is reserved`);
          }
          if (indexesNames.has(nameLower)) {
            throw new Error(`Duplicate index name '${nameLower}'`);
          }
          indexesNames.add(nameLower);
          return { name, column: column[PRIV], fn };
        }),
      };
    }),
  };
}
