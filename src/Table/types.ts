import { Node } from 'zensqlite';
import { Infer, ISchemaAny, SchemaTableAny } from '../schemaOlfd/mod';
import { JoinKind, QueryParentBase, SelectionBase } from './builder';

export type Rows = Array<Record<string, unknown>>;
export type SelectFrom = Extract<Node<'SelectCore'>, { variant: 'Select' }>['from'];
export type SelectOrderBy = Node<'SelectStmt'>['orderBy'];

export type KindMapper<Inner, Kind extends JoinKind> = {
  many: Array<Inner>;
  one: Inner;
  maybeOne: Inner | null;
  first: Inner;
  maybeFirst: Inner | null;
}[Kind];

export type ExtractTable<Schema extends ISchemaAny, TableName extends keyof Schema['tables']> = Schema['tables'][TableName];

export type SelectionPick<
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable>
> = keyof Selection extends keyof Infer<SchemaTable> ? Pick<Infer<SchemaTable>, keyof Selection> : undefined;

export type ResultSelf<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  Selection extends SelectionBase<ExtractTable<Schema, TableName>> | null
> = Selection extends SelectionBase<ExtractTable<Schema, TableName>>
  ? SelectionPick<ExtractTable<Schema, TableName>, Selection>
  : undefined;

export type MergeInnerAndParent<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  Kind extends JoinKind,
  Parent,
  Inner
> = Parent extends undefined
  ? Inner extends undefined
    ? undefined
    : KindMapper<Inner, Kind>
  : Inner extends undefined
  ? Parent
  : Parent & { [K in TableName]: KindMapper<Inner, Kind> };

export type ParentResult<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  Parent extends QueryParentBase<Schema>,
  Inner
> = MergeInnerAndParent<
  Schema,
  TableName,
  Parent['kind'],
  ResultSelf<Schema, Parent['query']['table'], Parent['query']['selection']>,
  Inner
>;

export type WrapInParent<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  Inner,
  Parent extends null | QueryParentBase<Schema>
> = Parent extends QueryParentBase<Schema>
  ? WrapInParent<Schema, Parent['query']['table'], ParentResult<Schema, TableName, Parent, Inner>, Parent['query']['parent']>
  : Inner;

export type Result<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  Selection extends SelectionBase<ExtractTable<Schema, TableName>> | null,
  Parent extends null | QueryParentBase<Schema>
> = WrapInParent<Schema, TableName, ResultSelf<Schema, TableName, Selection>, Parent>;

export interface QueryResolved<
  Schema extends ISchemaAny,
  TableName extends keyof Schema['tables'],
  SchemaTable extends SchemaTableAny,
  Selection extends SelectionBase<SchemaTable> | null,
  Parent extends null | QueryParentBase<Schema>
> {
  readonly query: string;
  readonly params: Record<string, any> | null;

  // Returns an Array
  parseAll(data: Array<Record<string, any>>): Array<Result<Schema, TableName, Selection, Parent>>;
  // Throw if result count is not === 1
  parseOne(data: Array<Record<string, any>>): Result<Schema, TableName, Selection, Parent>;
  // Throw if result count is > 1
  parseMaybeOne(data: Array<Record<string, any>>): Result<Schema, TableName, Selection, Parent> | null;
  // Throw if result count is === 0
  parseFirst(data: Array<Record<string, any>>): Result<Schema, TableName, Selection, Parent>;
  // Never throws
  parseMaybeFirst(data: Array<Record<string, any>>): Result<Schema, TableName, Selection, Parent> | null;
}
