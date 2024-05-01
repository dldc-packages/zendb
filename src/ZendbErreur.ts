import { createErreurStore } from '@dldc/erreur';

export type TZendbErreurData =
  | { kind: 'InvalidLiteral'; value: unknown }
  | { kind: 'MissingPrimaryKey'; table: string }
  | { kind: 'InvalidUniqueConstraint'; constraintName: string | null }
  | { kind: 'NoRows' }
  | { kind: 'ColumnNotFound'; columnKey: string }
  | { kind: 'ColumnDoesNotExist'; column: string }
  | { kind: 'CannotInsertEmptyArray'; table: string };

const ZendbErreurInternal = createErreurStore<TZendbErreurData>();

export const ZendbErreur = ZendbErreurInternal.asReadonly;

export function createInvalidLiteral(value: unknown) {
  return ZendbErreurInternal.setAndReturn(new Error(`Invalid literal ${String(value)}`), {
    kind: 'InvalidLiteral',
    value,
  });
}

export function createMissingPrimaryKey(table: string) {
  return ZendbErreurInternal.setAndReturn(new Error(`No primary key found for table ${table}`), {
    kind: 'MissingPrimaryKey',
    table,
  });
}

export function createInvalidUniqueConstraint(constraintName: string | null) {
  return ZendbErreurInternal.setAndReturn(new Error(`Invalid unique constraint ${constraintName}`), {
    kind: 'InvalidUniqueConstraint',
    constraintName,
  });
}

export function createNoRows() {
  return ZendbErreurInternal.setAndReturn(new Error('Expected one row, got 0'), { kind: 'NoRows' });
}

export function createColumnNotFound(columnKey: string) {
  return ZendbErreurInternal.setAndReturn(new Error(`Column not found: ${columnKey}`), {
    kind: 'ColumnNotFound',
    columnKey,
  });
}

export function createColumnDoesNotExist(column: string) {
  return ZendbErreurInternal.setAndReturn(new Error(`Column "${column}" does not exist`), {
    kind: 'ColumnDoesNotExist',
    column,
  });
}

export function createCannotInsertEmptyArray(table: string) {
  return ZendbErreurInternal.setAndReturn(new Error(`No data to insert into table ${table}`), {
    kind: 'CannotInsertEmptyArray',
    table,
  });
}
