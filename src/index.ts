import { Migrations } from './Migrations';
import { Database } from './Database';
import { schema } from './Schema';
import { SchemaTable } from './SchemaTable';
export * from './sql';

const table = SchemaTable.create;

export { Migrations, Database, schema, table };

export type { Schema, SchemaAny } from './Schema';
