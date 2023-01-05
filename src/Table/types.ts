import { Node } from 'zensqlite';
import { Infer, ISchemaAny } from '../Schema';
import { TablesNames } from '../types';
import { JoinKind, QueryParentBase, SelectionBase } from './queryBuilder';

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

export type SelectionPick<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Selection extends SelectionBase<Schema, TableName>
> = keyof Selection extends keyof Infer<Schema, TableName> ? Pick<Infer<Schema, TableName>, keyof Selection> : undefined;

export type ResultSelf<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Selection extends SelectionBase<Schema, TableName> | null
> = Selection extends SelectionBase<Schema, TableName> ? SelectionPick<Schema, TableName, Selection> : undefined;

export type MergeInnerAndParent<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
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
  TableName extends TablesNames<Schema>,
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
  TableName extends TablesNames<Schema>,
  Inner,
  Parent extends null | QueryParentBase<Schema>
> = Parent extends QueryParentBase<Schema>
  ? WrapInParent<Schema, Parent['query']['table'], ParentResult<Schema, TableName, Parent, Inner>, Parent['query']['parent']>
  : Inner;

export type Result<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  Selection extends SelectionBase<Schema, TableName> | null,
  Parent extends null | QueryParentBase<Schema>
> = WrapInParent<Schema, TableName, ResultSelf<Schema, TableName, Selection>, Parent>;
