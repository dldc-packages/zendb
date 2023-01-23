import { Datatype } from './Datatype';
import { PRIV } from './utils/constants';
import { ColumnDefInputValue, ColumnDefOutputValue } from './utils/types';

export type DefaultValueBase = (() => any) | null;

interface IColumnDefInternal<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase> {
  datatype: Datatype<DtExt, any>;
  nullable: Nullable;
  defaultValue: DefaultValue;
  primary: boolean;
  unique: Array<{ constraintName: string | null }>;
}

export type IColumnDefAny = IColumnDef<any, boolean, DefaultValueBase>;

export interface IColumnDef<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase> {
  readonly [PRIV]: IColumnDefInternal<DtExt, Nullable, DefaultValue>;
  nullable(): IColumnDef<DtExt, true, DefaultValue>;
  defaultValue<DefaultValue extends DtExt>(defaultValue: () => DefaultValue): IColumnDef<DtExt, Nullable, () => DefaultValue>;
  primary(): IColumnDef<DtExt, Nullable, DefaultValue>;
  unique(constraintName?: string | null): IColumnDef<DtExt, Nullable, DefaultValue>;
}

export const ColumnDef = (() => {
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

  function parseColumn<Col extends IColumnDefAny>(column: Col, output: any): ColumnDefOutputValue<Col> {
    const { nullable, datatype } = column[PRIV];
    if (nullable && output === null) {
      return null as any;
    }
    return datatype.parse(output);
  }

  function serializeColumn<Col extends IColumnDefAny>(column: Col, input: ColumnDefInputValue<Col>): any {
    const { defaultValue, nullable, datatype } = column[PRIV];
    if (defaultValue && input === undefined) {
      return serializeColumn(column, defaultValue());
    }
    if (nullable && input === null) {
      return null;
    }
    return datatype.serialize(input);
  }

  function create<DtExt>(datatype: Datatype<DtExt, any>): IColumnDef<DtExt, false, null> {
    return createInternal({ datatype, nullable: false, defaultValue: null, primary: false, unique: [] });
  }

  function createInternal<DtExt, Nullable extends boolean, DefaultValue extends DefaultValueBase>(
    internal: IColumnDefInternal<DtExt, Nullable, DefaultValue>
  ): IColumnDef<DtExt, Nullable, DefaultValue> {
    return {
      [PRIV]: internal,
      nullable: () => createInternal({ ...internal, nullable: true }),
      defaultValue: (defaultValue) => createInternal({ ...internal, defaultValue }),
      primary: () => createInternal({ ...internal, primary: true }),
      unique: (constraintName = null) => createInternal({ ...internal, unique: [...internal.unique, { constraintName }] }),
    };
  }

  function json<Obj>(): IColumnDef<Obj, false, null> {
    return create(Datatype.json);
  }

  function text(): IColumnDef<string, false, null>;
  function text<T extends string = string>(): IColumnDef<T, false, null>;
  function text<T extends string = string>(): IColumnDef<T, false, null> {
    return create(Datatype.text as any);
  }

  function number(): IColumnDef<number, false, null>;
  function number<T extends number = number>(): IColumnDef<T, false, null>;
  function number<T extends number = number>(): IColumnDef<T, false, null> {
    return create(Datatype.number as any);
  }

  function integer(): IColumnDef<number, false, null>;
  function integer<T extends number = number>(): IColumnDef<T, false, null>;
  function integer<T extends number = number>(): IColumnDef<T, false, null> {
    return create(Datatype.integer as any);
  }

  function boolean(): IColumnDef<boolean, false, null> {
    return create(Datatype.boolean);
  }

  function date(): IColumnDef<Date, false, null> {
    return create(Datatype.date);
  }
})();
