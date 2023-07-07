import { Datatype } from './Datatype';
import { PRIV } from './utils/constants';
import { ColumnInputValue, ColumnOutputValue } from './utils/types';

export type DefaultValueBase = (() => any) | null;

interface IColumnInternal<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase> {
  datatype: Datatype<DtExt, any>;
  nullable: Nullable;
  defaultValue: DefaultValue;
  primary: boolean;
  unique: Array<{ constraintName: string | null }>;
}

export type IColumnAny = IColumn<any, boolean, DefaultValueBase>;

export interface IColumn<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase> {
  readonly [PRIV]: IColumnInternal<DtExt, Nullable, DefaultValue>;
  nullable(): IColumn<DtExt, true, DefaultValue>;
  defaultValue<DefaultValue extends DtExt>(
    defaultValue: () => DefaultValue,
  ): IColumn<DtExt, Nullable, () => DefaultValue>;
  primary(): IColumn<DtExt, Nullable, DefaultValue>;
  unique(constraintName?: string | null): IColumn<DtExt, Nullable, DefaultValue>;
}

export const Column = (() => {
  return {
    declare,
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

  function parseColumn<Col extends IColumnAny>(column: Col, output: any): ColumnOutputValue<Col> {
    const { nullable, datatype } = column[PRIV];
    if (nullable && output === null) {
      return null as any;
    }
    return datatype.parse(output);
  }

  function serializeColumn<Col extends IColumnAny>(column: Col, input: ColumnInputValue<Col>): any {
    const { defaultValue, nullable, datatype } = column[PRIV];
    if (defaultValue && input === undefined) {
      return serializeColumn(column, defaultValue());
    }
    if (nullable && input === null) {
      return null;
    }
    return datatype.serialize(input);
  }

  function declare<DtExt>(datatype: Datatype<DtExt, any>): IColumn<DtExt, false, null> {
    return createInternal({ datatype, nullable: false, defaultValue: null, primary: false, unique: [] });
  }

  function createInternal<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase>(
    internal: IColumnInternal<DtExt, Nullable, DefaultValue>,
  ): IColumn<DtExt, Nullable, DefaultValue> {
    return {
      [PRIV]: internal,
      nullable: () => createInternal({ ...internal, nullable: true }),
      defaultValue: (defaultValue) => createInternal({ ...internal, defaultValue }),
      primary: () => createInternal({ ...internal, primary: true }),
      unique: (constraintName = null) =>
        createInternal({ ...internal, unique: [...internal.unique, { constraintName }] }),
    };
  }

  function json<Obj>(): IColumn<Obj, false, null> {
    return declare(Datatype.json);
  }

  function text(): IColumn<string, false, null>;
  function text<T extends string = string>(): IColumn<T, false, null>;
  function text<T extends string = string>(): IColumn<T, false, null> {
    return declare(Datatype.text as any);
  }

  function number(): IColumn<number, false, null>;
  function number<T extends number = number>(): IColumn<T, false, null>;
  function number<T extends number = number>(): IColumn<T, false, null> {
    return declare(Datatype.number as any);
  }

  function integer(): IColumn<number, false, null>;
  function integer<T extends number = number>(): IColumn<T, false, null>;
  function integer<T extends number = number>(): IColumn<T, false, null> {
    return declare(Datatype.integer as any);
  }

  function boolean(): IColumn<boolean, false, null> {
    return declare(Datatype.boolean);
  }

  function date(): IColumn<Date, false, null> {
    return declare(Datatype.date);
  }
})();
