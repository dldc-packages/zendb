import { resolveStmt, sql } from '../src';

test('resolve simple select', () => {
  const users = sql.Table.create('users');
  const userId = users.column('id');

  const { query } = resolveStmt(
    sql.SelectStmt.create({
      from: users,
      select: [userId],
    })
  );
  expect(query).toBe('SELECT `users`.`id` FROM `users`');
});

test('resolve simple select with alias', () => {
  const users = sql.Table.create('users').as('u');
  const userId = users.column('id').as('userId');

  const { query } = resolveStmt(
    sql.SelectStmt.create({
      from: users,
      select: [userId],
    })
  );
  expect(query).toBe('SELECT `u`.`id` AS `userId` FROM `users` AS `u`');
});

test('resolve json_each', () => {
  const users = sql.Table.create('users');
  const userId = users.column('id').as('userId');
  const userData = users.column('data');
  const usersDataJson = sql.JsonTable.each(userData).as('usersData');
  const numParam = sql.Param.createNamed('num');

  const { query } = resolveStmt(
    sql.SelectStmt.create({
      from: [users, usersDataJson],
      select: [userId, userData],
      distinct: true,
      where: sql.eq(usersDataJson.columns.value, numParam),
      orderBy: [userId],
      limit: { limit: sql.literal(10), offset: sql.literal(0) },
    })
  );
  expect(query).toBe(
    'SELECT DISTINCT `users`.`id` AS `userId`, `users`.`data` FROM `users`, json_each(`users`.`data`) AS `usersData` WHERE (`usersData`.`value` = :num) ORDER BY `userId` LIMIT 10 OFFSET 0'
  );
});

test('aggregate select', () => {
  const users = sql.Table.create('users').as('u');
  const userId = users.column('id');
  const userIdCount = sql.Aggregate.count(userId).as('userIdCount');

  const { query } = resolveStmt(
    sql.SelectStmt.create({
      from: [users],
      select: [userIdCount],
      orderBy: [userIdCount],
    })
  );
  expect(query).toBe(
    'SELECT COUNT(`u`.`id`) AS `userIdCount` FROM `users` AS `u` ORDER BY `userIdCount`'
  );
});
