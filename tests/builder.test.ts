import { sql } from '../src';

test('resolve simple select', () => {
  const users = sql.Table.create('users');
  const userId = users.column('id');

  const query = sql.SelectStmt.print(
    sql.SelectStmt.create({
      from: users,
      columns: [userId],
    })
  );
  expect(query).toBe('SELECT `users`.`id` FROM `users`');
});

test('resolve simple select with alias', () => {
  const users = sql.Table.create('users').as('u');
  const userId = users.column('id').as('userId');

  const query = sql.SelectStmt.print(
    sql.SelectStmt.create({
      from: users,
      columns: [userId],
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

  const query = sql.SelectStmt.print(
    sql.SelectStmt.create({
      from: [users, usersDataJson],
      columns: [userId, userData],
      distinct: true,
      where: sql.Expr.eq(usersDataJson.columns.value, numParam),
      orderBy: [userId],
      limit: { limit: sql.Expr.literal(10), offset: sql.Expr.literal(0) },
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

  const query = sql.SelectStmt.print(
    sql.SelectStmt.create({
      from: [users],
      columns: [userIdCount],
      orderBy: [userIdCount],
    })
  );
  expect(query).toBe(
    'SELECT COUNT(`u`.`id`) AS `userIdCount` FROM `users` AS `u` ORDER BY `userIdCount`'
  );
});

test('insert', () => {
  const users = sql.Table.create('users').as('u');
  const userId = users.column('id');
  const userName = users.column('name');

  const query = sql.InsertStmt.print(
    sql.InsertStmt.create({
      into: users,
      columns: [userId, userName],
      values: [[sql.Expr.literal(1), sql.Expr.literal('Paul')]],
    })
  );
  expect(query).toBe("INSERT INTO `users` AS `u` (`id`, `name`) VALUES (1, 'Paul')");
});

test('update', () => {
  const users = sql.Table.create('users').as('u');
  const userId = users.column('id');
  const userName = users.column('name');

  const query = sql.UpdateStmt.print(
    sql.UpdateStmt.create({
      table: users,
    })
      .set(userId, sql.Expr.literal(1))
      .set(userName, sql.Param.createNamed('name'))
  );
  expect(query).toBe('UPDATE `users` AS `u` SET `id` = 1, `name` = :name');
});
