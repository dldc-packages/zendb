import { Datatype } from './Datatype';
import { PRIV } from './Utils';

export type DefaultValueBase = (() => any) | null;

type SchemaColumnInternal<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase> = {
  datatype: Datatype<DtExt, any>;
  nullable: Nullable;
  defaultValue: DefaultValue;
  primary: boolean;
  unique: Array<{ constraintName: string | null }>;
};

export type ISchemaColumnAny = ISchemaColumn<any, boolean, DefaultValueBase>;

// Can be null if nullable and undefined if defaultValue is set
export type SchemaColumnInputValue<Column extends ISchemaColumnAny> =
  | Column[PRIV]['datatype'][PRIV]
  | (Column[PRIV]['nullable'] extends true ? null : never)
  | (Column[PRIV]['defaultValue'] extends null ? never : undefined);

// Can be null only if nullable
export type SchemaColumnOutputValue<Column extends ISchemaColumnAny> =
  | Column[PRIV]['datatype'][PRIV]
  | (Column[PRIV]['nullable'] extends true ? null : never);

export interface ISchemaColumn<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase> {
  readonly [PRIV]: SchemaColumnInternal<DtExt, Nullable, DefaultValue>;
  nullable(): ISchemaColumn<DtExt, true, DefaultValue>;
  defaultValue<DefaultValue extends DtExt>(defaultValue: () => DefaultValue): ISchemaColumn<DtExt, Nullable, () => DefaultValue>;
  primary(): ISchemaColumn<DtExt, Nullable, DefaultValue>;
  unique(constraintName?: string | null): ISchemaColumn<DtExt, Nullable, DefaultValue>;
}

export const SchemaColumn = (() => {
  return {
    create,
    dt: {
      json,
      text,
      number,
      integer,
      boolean,
      date,
    },
    parse: parseColumn,
    serialize: serializeColumn,
  };

  function parseColumn<Col extends ISchemaColumnAny>(column: Col, output: any): SchemaColumnOutputValue<Col> {
    const { nullable, datatype } = column[PRIV];
    if (nullable && output === null) {
      return null as any;
    }
    return datatype.parse(output);
  }

  function serializeColumn<Col extends ISchemaColumnAny>(column: Col, input: SchemaColumnInputValue<Col>): any {
    const { defaultValue, nullable, datatype } = column[PRIV];
    if (defaultValue && input === undefined) {
      return serializeColumn(column, defaultValue());
    }
    if (nullable && input === null) {
      return null;
    }
    return datatype.serialize(input);
  }

  function create<DtExt>(datatype: Datatype<DtExt, any>): ISchemaColumn<DtExt, false, null> {
    return createInternal({ datatype, nullable: false, defaultValue: null, primary: false, unique: [] });
  }

  function createInternal<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase>(
    internal: SchemaColumnInternal<DtExt, Nullable, DefaultValue>
  ): ISchemaColumn<DtExt, Nullable, DefaultValue> {
    return {
      [PRIV]: internal,
      nullable: () => createInternal({ ...internal, nullable: true }),
      defaultValue: (defaultValue) => createInternal({ ...internal, defaultValue }),
      primary: () => createInternal({ ...internal, primary: true }),
      unique: (constraintName = null) => createInternal({ ...internal, unique: [...internal.unique, { constraintName }] }),
    };
  }

  function json<Obj>(): ISchemaColumn<Obj, false, null> {
    return create(Datatype.json);
  }

  function text(): ISchemaColumn<string, false, null>;
  function text<T extends string = string>(): ISchemaColumn<T, false, null>;
  function text<T extends string = string>(): ISchemaColumn<T, false, null> {
    return create(Datatype.text as any);
  }

  function number(): ISchemaColumn<number, false, null>;
  function number<T extends number = number>(): ISchemaColumn<T, false, null>;
  function number<T extends number = number>(): ISchemaColumn<T, false, null> {
    return create(Datatype.number as any);
  }

  function integer(): ISchemaColumn<number, false, null>;
  function integer<T extends number = number>(): ISchemaColumn<T, false, null>;
  function integer<T extends number = number>(): ISchemaColumn<T, false, null> {
    return create(Datatype.integer as any);
  }

  function boolean(): ISchemaColumn<boolean, false, null> {
    return create(Datatype.boolean);
  }

  function date(): ISchemaColumn<Date, false, null> {
    return create(Datatype.date);
  }
})();
