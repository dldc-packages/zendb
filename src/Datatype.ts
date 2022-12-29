import { PRIV } from './Utils';

export type SqliteDatatype = 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB';

export type DatatypeAny = Datatype<any, any>;

export type Datatype<External, Internal> = {
  [PRIV]: External;
  name: string;
  parse: (value: Internal) => External;
  serialize: (value: External) => Internal;
  type: SqliteDatatype;
};

function createDatatype<External, Internal>(dt: Omit<Datatype<External, Internal>, PRIV>): Datatype<External, Internal> {
  return dt as any;
}

export const Datatype = {
  create: createDatatype,
  // preset
  boolean: createDatatype<boolean, number>({
    name: 'boolean',
    parse: (value: number) => value === 1,
    serialize: (value: boolean) => (value ? 1 : 0),
    type: 'INTEGER',
  }),
  integer: createDatatype<number, number>({
    name: 'integer',
    parse: (value: number) => value,
    serialize: (value: number) => value,
    type: 'INTEGER',
  }),
  number: createDatatype<number, number>({
    name: 'number',
    parse: (value: number) => value,
    serialize: (value: number) => value,
    type: 'REAL',
  }),
  text: createDatatype<string, string>({
    name: 'text',
    parse: (value: string) => value,
    serialize: (value: string) => value,
    type: 'TEXT',
  }),
  date: createDatatype<Date, number>({
    name: 'date',
    parse: (value: number) => new Date(value),
    serialize: (value: Date) => value.getTime(),
    type: 'REAL',
  }),
  json: createDatatype<any, string>({
    name: 'json',
    parse: (value: string) => JSON.parse(value),
    serialize: (value: any) => JSON.stringify(value),
    type: 'TEXT',
  }),
};
