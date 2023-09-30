import type { TKey, TVoidKey } from '@dldc/erreur';
import { Erreur, Key } from '@dldc/erreur';

const ZendbErrorKey: TVoidKey = Key.createEmpty('ZendbError');
const InvalidLiteralKey: TKey<{ value: unknown }> = Key.create('InvalidLiteral');
const MissingPrimaryKeyKey: TKey<{ table: string }> = Key.create('MissingPrimaryKey');
const InvalidUniqueConstraintKey: TKey<{ constraintName: string | null }> = Key.create('InvalidUniqueConstraint');
const NoRowsKey: TVoidKey = Key.createEmpty('NoRows');
const ColumnNotFoundKey: TKey<{ columnKey: string }> = Key.create('ColumnNotFound');
const ColumnDoesNotExistKey: TKey<{ column: string }> = Key.create('ColumnDoesNotExist');

export const ZendbError = {
  Key: ZendbErrorKey,
  create: createZendbError,
  InvalidLiteral: {
    Key: InvalidLiteralKey,
    create: createInvalidLiteral,
  },
  MissingPrimaryKey: {
    Key: MissingPrimaryKeyKey,
    create: createMissingPrimaryKey,
  },
  InvalidUniqueConstraint: {
    Key: InvalidUniqueConstraintKey,
    create: createInvalidUniqueConstraint,
  },
  NoRows: {
    Key: NoRowsKey,
    create: createNoRows,
  },
  ColumnNotFound: {
    Key: ColumnNotFoundKey,
    create: createColumnNotFound,
  },
  ColumnDoesNotExist: {
    Key: ColumnDoesNotExistKey,
    create: createColumnDoesNotExist,
  },
};

function createZendbError() {
  return Erreur.createWith(ZendbErrorKey).withName('ZendbError');
}

function createInvalidLiteral(value: unknown) {
  return createZendbError()
    .with(InvalidLiteralKey.Provider({ value }))
    .withMessage(`Invalid literal ${String(value)}`);
}

function createMissingPrimaryKey(table: string) {
  return createZendbError()
    .with(MissingPrimaryKeyKey.Provider({ table }))
    .withMessage(`No primary key found for table ${table}`);
}

function createInvalidUniqueConstraint(constraintName: string | null) {
  return createZendbError()
    .with(InvalidUniqueConstraintKey.Provider({ constraintName }))
    .withMessage(`Invalid unique constraint ${constraintName}`);
}

function createNoRows() {
  return createZendbError().with(NoRowsKey.Provider()).withMessage('Expected one row, got 0');
}

function createColumnNotFound(columnKey: string) {
  return createZendbError()
    .with(ColumnNotFoundKey.Provider({ columnKey }))
    .withMessage(`Column not found: ${columnKey}`);
}

function createColumnDoesNotExist(column: string) {
  return createZendbError()
    .with(ColumnDoesNotExistKey.Provider({ column }))
    .withMessage(`Column "${column}" does not exist`);
}
