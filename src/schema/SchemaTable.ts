import {
  SchemaColumn,
  DataFromSchemaColumn,
  SchemaColumnAny,
  SchemaColumnResolved,
} from './SchemaColumn';
import { Datatype, DatatypeParsed } from '../Datatype';
import { PRIV } from '../Utils';

export type SchemaIndexFn<Data, T> = (data: Data) => T;

export type SchemaIndex<Name extends string, Data, Column extends SchemaColumnAny> = {
  [PRIV]: {
    data: Data;
    value: DataFromSchemaColumn<Column>;
  };
  name: Name;
  column: Column;
  fn: SchemaIndexFn<Data, DataFromSchemaColumn<Column>>;
};

export type SchemaIndexAny = SchemaIndex<string, any, SchemaColumnAny>;

export type SchemaIndexesAny<Data> = ReadonlyArray<SchemaIndex<string, Data, SchemaColumnAny>>;

export type SchemaIndexResolved = {
  name: string;
  column: SchemaColumnResolved;
  fn: SchemaIndexFn<any, any>;
};

export type SchemaTableResolved = {
  name: string;
  key: {
    column: SchemaColumnResolved;
    fn: SchemaIndexFn<any, any>;
  };
  indexes: Array<SchemaIndexResolved>;
};

export type SchemaTableKey<Data, KeyDt extends Datatype> = {
  column: SchemaColumn<KeyDt, false, null>;
  fn: SchemaIndexFn<Data, DataFromSchemaColumn<SchemaColumn<KeyDt, false, null>>>;
};

export type PartialSchemaTable<Data> = {
  [PRIV]: Data;
  key<KeyDt extends Datatype>(
    column: SchemaColumn<KeyDt, false, null>,
    fn: SchemaIndexFn<Data, DataFromSchemaColumn<SchemaColumn<KeyDt, false, null>>>
  ): SchemaTable<Data, KeyDt, []>;
};

export type SchemaTable<Data, KeyDt extends Datatype, Indexes extends SchemaIndexesAny<Data>> = {
  [PRIV]: {
    data: Data;
    keyType: DatatypeParsed<KeyDt>;
    key: SchemaTableKey<Data, KeyDt>;
    indexes: Indexes;
  };
  index<Name extends string, Column extends SchemaColumnAny>(
    name: Name,
    column: Column,
    fn: SchemaIndexFn<Data, DataFromSchemaColumn<Column>>
  ): SchemaTable<Data, KeyDt, [...Indexes, SchemaIndex<Name, Data, Column>]>;
};

export type SchemaTableAny = SchemaTable<any, any, SchemaIndexesAny<any>>;

export function table<Data>(): PartialSchemaTable<Data> {
  return {
    [PRIV]: null as any,
    key<KeyDt extends Datatype>(
      column: SchemaColumn<KeyDt, false, null>,
      fn: SchemaIndexFn<Data, DataFromSchemaColumn<SchemaColumn<KeyDt, false, null>>>
    ) {
      return create({ column, fn }, []);
    },
  };
  function create<Data, KeyDt extends Datatype, Indexes extends SchemaIndexesAny<Data>>(
    key: SchemaTableKey<Data, KeyDt>,
    indexes: Indexes
  ): SchemaTable<Data, KeyDt, Indexes> {
    return {
      [PRIV]: {
        data: null as any,
        keyType: null as any,
        key,
        indexes,
      },
      index<Name extends string, Column extends SchemaColumnAny>(
        name: Name,
        column: Column,
        fn: SchemaIndexFn<Data, DataFromSchemaColumn<Column>>
      ) {
        const index: SchemaIndex<Name, Data, Column> = {
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

export type SchemaTablesAny = Record<string, SchemaTableAny>;
