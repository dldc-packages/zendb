import { PRIV } from '../Utils';
import { Datatype } from './Datatype';

export type DefaultValueBase = (() => any) | null;

type SchemaColumnInternal<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase> = {
  datatype: Datatype<DtExt, any>;
  nullable: Nullable;
  defaultValue: DefaultValue;
  primary: boolean;
  unique: boolean;
};

export type SchemaColumnAny = SchemaColumn<any, boolean, DefaultValueBase>;

// Can be null if nullable and undefined if defaultValue is set
export type SchemaColumnInputValue<Column extends SchemaColumnAny> =
  | Column[PRIV]['datatype'][PRIV]
  | (Column[PRIV]['nullable'] extends true ? null : never)
  | (Column[PRIV]['defaultValue'] extends null ? never : undefined);

// Can be null only if nullable
export type SchemaColumnOutputValue<Column extends SchemaColumnAny> =
  | Column[PRIV]['datatype'][PRIV]
  | (Column[PRIV]['nullable'] extends true ? null : never);

export class SchemaColumn<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase> {
  static create<DtExt>(datatype: Datatype<DtExt, any>): SchemaColumn<DtExt, false, null> {
    return new SchemaColumn({
      datatype,
      nullable: false,
      defaultValue: null,
      primary: false,
      unique: false,
    });
  }

  static json<Obj>(): SchemaColumn<Obj, false, null> {
    return SchemaColumn.create(Datatype.json);
  }

  static text(): SchemaColumn<string, false, null>;
  static text<T extends string = string>(): SchemaColumn<T, false, null>;
  static text<T extends string = string>(): SchemaColumn<T, false, null> {
    return SchemaColumn.create(Datatype.text as any);
  }

  static number(): SchemaColumn<number, false, null>;
  static number<T extends number = number>(): SchemaColumn<T, false, null>;
  static number<T extends number = number>(): SchemaColumn<T, false, null> {
    return SchemaColumn.create(Datatype.number as any);
  }

  static integer(): SchemaColumn<number, false, null>;
  static integer<T extends number = number>(): SchemaColumn<T, false, null>;
  static integer<T extends number = number>(): SchemaColumn<T, false, null> {
    return SchemaColumn.create(Datatype.integer as any);
  }

  static boolean(): SchemaColumn<boolean, false, null> {
    return SchemaColumn.create(Datatype.boolean);
  }

  static date(): SchemaColumn<Date, false, null> {
    return SchemaColumn.create(Datatype.date);
  }

  readonly [PRIV]: SchemaColumnInternal<DtExt, Nullable, DefaultValue>;

  private constructor(internal: SchemaColumnInternal<DtExt, Nullable, DefaultValue>) {
    this[PRIV] = internal;
  }

  nullable(): SchemaColumn<DtExt, true, DefaultValue> {
    return new SchemaColumn({ ...this[PRIV], nullable: true });
  }

  defaultValue<DefaultValue extends DtExt>(defaultValue: () => DefaultValue): SchemaColumn<DtExt, Nullable, () => DefaultValue> {
    return new SchemaColumn({ ...this[PRIV], defaultValue });
  }

  primary(): SchemaColumn<DtExt, Nullable, DefaultValue> {
    return new SchemaColumn({ ...this[PRIV], primary: true });
  }

  unique(): SchemaColumn<DtExt, Nullable, DefaultValue> {
    return new SchemaColumn({ ...this[PRIV], unique: true });
  }
}

export function parseColumn<Col extends SchemaColumnAny>(column: Col, output: any): SchemaColumnOutputValue<Col> {
  const { nullable, datatype } = column[PRIV];
  if (nullable && output === null) {
    return null as any;
  }
  return datatype.parse(output);
}

export function serializeColumn<Col extends SchemaColumnAny>(column: Col, input: SchemaColumnInputValue<Col>): any {
  const { defaultValue, nullable, datatype } = column[PRIV];
  if (defaultValue && input === undefined) {
    return serializeColumn(column, defaultValue());
  }
  if (nullable && input === null) {
    return null;
  }
  return datatype.serialize(input);
}
