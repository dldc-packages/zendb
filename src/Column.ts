import * as zod from 'zod';
import { mapObject, PRIV } from './Utils';
import {
  Datatype,
  datatype,
  DatatypeBoolean,
  DatatypeDate,
  DatatypeInteger,
  DatatypeJson,
  DatatypeNumber,
  DatatypeParsed,
  DatatypeText,
  parseDatatype,
  serializeDatatype,
} from './Datatype';

export type DefaultValueBase = (() => any) | null;

export interface Column<
  Dt extends Datatype,
  Nullable extends boolean,
  DefaultValue extends DefaultValueBase
> {
  [PRIV]: {
    datatype: Dt;
    nullable: Nullable;
    defaultValue: DefaultValue;
    primary: boolean;
    unique: boolean;
  };
  primary(): Column<Dt, Nullable, DefaultValue>;
  unique(): Column<Dt, Nullable, DefaultValue>;
  nullable(): Column<Dt, true, DefaultValue>;
  defaultValue<DefaultValue extends DatatypeParsed<Dt>>(
    val: () => DefaultValue
  ): Column<Dt, Nullable, () => DefaultValue>;
}

export type ColumnAny = Column<Datatype, boolean, DefaultValueBase>;

export type DataFromColumn<Column extends ColumnAny> =
  | DatatypeParsed<Column[PRIV]['datatype']>
  | (Column[PRIV]['nullable'] extends true ? null : never)
  | (Column[PRIV]['defaultValue'] extends null ? never : null);

export type ColumnsAny = Record<string, ColumnAny>;

export type DataFromColumns<Columns extends ColumnsAny> = {
  [K in keyof Columns]: DataFromColumn<Columns[K]>;
};

export type ColumnResolved = {
  datatype: Datatype;
  nullable: boolean;
  defaultValue: DefaultValueBase;
  primary: boolean;
  unique: boolean;
};

export const column = {
  json<Inner>(schema: zod.Schema<Inner>): Column<DatatypeJson<Inner>, false, null> {
    return createColumn(datatype.json(schema));
  },
  text(schema: zod.Schema<string> | null = null): Column<DatatypeText, false, null> {
    return createColumn(datatype.text(schema));
  },
  number(schema: zod.Schema<number> | null = null): Column<DatatypeNumber, false, null> {
    return createColumn(datatype.number(schema));
  },
  integer(schema: zod.Schema<number> | null = null): Column<DatatypeInteger, false, null> {
    return createColumn(datatype.integer(schema));
  },
  boolean(schema: zod.Schema<boolean> | null = null): Column<DatatypeBoolean, false, null> {
    return createColumn(datatype.boolean(schema));
  },
  date(): Column<DatatypeDate, false, null> {
    return createColumn(datatype.date());
  },
};

export function createColumn<Dt extends Datatype>(datatype: Dt): Column<Dt, false, null> {
  return create(datatype, false, null, false, false);
  function create<
    Dt extends Datatype,
    Nullable extends boolean,
    DefaultValue extends DefaultValueBase
  >(
    datatype: Dt,
    nullable: Nullable,
    defaultValue: DefaultValue,
    primary: boolean,
    unique: boolean
  ): Column<Dt, Nullable, DefaultValue> {
    return {
      [PRIV]: {
        datatype,
        nullable,
        defaultValue,
        primary,
        unique,
      },
      nullable() {
        return create(datatype, true, defaultValue, primary, unique);
      },
      defaultValue(defaultValue) {
        return create(datatype, nullable, defaultValue, primary, unique);
      },
      primary() {
        return create(datatype, nullable, defaultValue, true, unique);
      },
      unique() {
        return create(datatype, nullable, defaultValue, primary, true);
      },
    };
  }
}

export function serializeColumn(column: ColumnResolved, data: any, name: string): unknown {
  if (data === undefined || data === null) {
    if (column.defaultValue) {
      return serializeDatatype(column.datatype, column.defaultValue());
    }
    if (column.nullable) {
      return null;
    }
    throw new Error(`Received null or undefined for non-nullable column ${name}`);
  }
  return serializeDatatype(column.datatype, data);
}

export function parseColumn<Column extends ColumnAny>(
  column: Column,
  data: any,
  name: string
): DataFromColumn<Column> {
  const val = column[PRIV];
  if (data === undefined || data === null) {
    if (val.defaultValue) {
      return val.defaultValue();
    }
    if (val.nullable) {
      return null as any;
    }
    throw new Error(`Column ${name} cannot be null/undefined.`);
  }
  return parseDatatype(val.datatype, data as any) as any;
}

export function serializeColumns<Columns extends ColumnsAny>(
  columns: Columns,
  data: Record<string, any>
): Record<string, unknown> {
  return mapObject(columns, (colName, column) => {
    const dataItem = data[colName];
    return serializeColumn(column[PRIV], dataItem, colName);
  });
}

export function parseColumns<Columns extends ColumnsAny>(
  columns: Columns,
  data: Record<string, unknown>
): DataFromColumns<Columns> {
  return mapObject(columns, (colName, column) => {
    const dataItem = data[colName];
    return parseColumn(column, dataItem, colName);
  }) as any;
}
