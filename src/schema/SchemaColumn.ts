import * as zod from 'zod';
import { PRIV } from '../Utils';
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
  serializeDatatype,
} from '../Datatype';

export type DefaultValueBase = (() => any) | null;

export interface SchemaColumn<
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
  primary(): SchemaColumn<Dt, Nullable, DefaultValue>;
  unique(): SchemaColumn<Dt, Nullable, DefaultValue>;
  nullable(): SchemaColumn<Dt, true, DefaultValue>;
  defaultValue<DefaultValue extends DatatypeParsed<Dt>>(
    val: () => DefaultValue
  ): SchemaColumn<Dt, Nullable, () => DefaultValue>;
}

export type SchemaColumnAny = SchemaColumn<Datatype, boolean, DefaultValueBase>;

export type DataFromSchemaColumn<Column extends SchemaColumnAny> =
  | DatatypeParsed<Column[PRIV]['datatype']>
  | (Column[PRIV]['nullable'] extends true ? null : never)
  | (Column[PRIV]['defaultValue'] extends null ? never : null);

export type SchemaColumnsAny = Record<string, SchemaColumnAny>;

export type DataFromSchemaColumns<Columns extends SchemaColumnsAny> = {
  [K in keyof Columns]: DataFromSchemaColumn<Columns[K]>;
};

export type SchemaColumnResolved = {
  datatype: Datatype;
  nullable: boolean;
  defaultValue: DefaultValueBase;
  primary: boolean;
  unique: boolean;
};

export const column = {
  json<Inner>(schema: zod.Schema<Inner>): SchemaColumn<DatatypeJson<Inner>, false, null> {
    return createColumn(datatype.json(schema));
  },
  text(schema: zod.Schema<string> | null = null): SchemaColumn<DatatypeText, false, null> {
    return createColumn(datatype.text(schema));
  },
  number(schema: zod.Schema<number> | null = null): SchemaColumn<DatatypeNumber, false, null> {
    return createColumn(datatype.number(schema));
  },
  integer(schema: zod.Schema<number> | null = null): SchemaColumn<DatatypeInteger, false, null> {
    return createColumn(datatype.integer(schema));
  },
  boolean(schema: zod.Schema<boolean> | null = null): SchemaColumn<DatatypeBoolean, false, null> {
    return createColumn(datatype.boolean(schema));
  },
  date(): SchemaColumn<DatatypeDate, false, null> {
    return createColumn(datatype.date());
  },
};

function createColumn<Dt extends Datatype>(datatype: Dt): SchemaColumn<Dt, false, null> {
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
  ): SchemaColumn<Dt, Nullable, DefaultValue> {
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

export function serializeColumnData(
  column: SchemaColumnResolved,
  data: any,
  name: string
): unknown {
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

// export function parseColumnData<Column extends ColumnAny>(
//   column: Column,
//   data: any,
//   name: string
// ): DataFromColumn<Column> {
//   const val = column[PRIV];
//   if (data === undefined || data === null) {
//     if (val.defaultValue) {
//       return val.defaultValue();
//     }
//     if (val.nullable) {
//       return null as any;
//     }
//     throw new Error(`Column ${name} cannot be null/undefined.`);
//   }
//   return parseDatatype(val.datatype, data as any) as any;
// }

// export function serializeColumnsData<Columns extends ColumnsAny>(
//   columns: Columns,
//   data: Record<string, any>
// ): Record<string, unknown> {
//   return mapObject(columns, (colName, column) => {
//     const dataItem = data[colName];
//     return serializeColumnData(column[PRIV], dataItem, colName);
//   });
// }

// export function parseColumnsData<Columns extends ColumnsAny>(
//   columns: Columns,
//   data: Record<string, unknown>
// ): DataFromColumns<Columns> {
//   return mapObject(columns, (colName, column) => {
//     const dataItem = data[colName];
//     return parseColumnData(column, dataItem, colName);
//   }) as any;
// }
