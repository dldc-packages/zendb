import { PRIV } from '../Utils';
import { SchemaColumnAny, SchemaColumnInputValue, SchemaColumnOutputValue } from './SchemaColumn';

export type SchemaColumnsBase = Record<string, SchemaColumnAny>;

export type SchemaTableInternal<Columns extends SchemaColumnsBase> = {
  columns: Columns;
};

export type SchemaTableAny = SchemaTable<SchemaColumnsBase>;

export type InferSchemaColumnsResult<Columns extends SchemaColumnsBase> = {
  [K in keyof Columns]: SchemaColumnOutputValue<Columns[K]>;
};

export type InferSchemaTableResult<Table extends SchemaTableAny> = InferSchemaColumnsResult<
  Table[PRIV]['columns']
>;

export type ExtractUndefinedKeys<Data extends Record<string, any>> = {
  [K in keyof Data]: undefined extends Data[K] ? K : never;
}[keyof Data];

export type ExtractDefinedKeys<Data extends Record<string, any>> = {
  [K in keyof Data]: undefined extends Data[K] ? never : K;
}[keyof Data];

export type MarkUndefinedOptional<Data extends Record<string, any>> = Pick<
  Data,
  ExtractDefinedKeys<Data>
> &
  Partial<Pick<Data, ExtractUndefinedKeys<Data>>>;

export type InferSchemaColumnsInput<Columns extends SchemaColumnsBase> = {
  [K in keyof Columns]: SchemaColumnInputValue<Columns[K]>;
};

export type InferSchemaTableInput<Table extends SchemaTableAny> = MarkUndefinedOptional<
  InferSchemaColumnsInput<Table[PRIV]['columns']>
>;

export class SchemaTable<Columns extends SchemaColumnsBase> {
  static create<Columns extends SchemaColumnsBase>(columns: Columns): SchemaTable<Columns> {
    return new SchemaTable({
      columns,
    });
  }

  readonly [PRIV]: SchemaTableInternal<Columns>;

  private constructor(internal: SchemaTableInternal<Columns>) {
    this[PRIV] = internal;
  }
}
