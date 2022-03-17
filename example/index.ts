import * as zen from '../src';
import { schema as v001 } from './migrations/001';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
import { nanoid } from 'nanoid';

export * from './migrations/001';

const DATA_PATH = resolve('example/data');

try {
  mkdirSync(DATA_PATH);
} catch {
  //
}

const migrations = zen.Migrations.create({
  id: 'init',
  description: 'Initialize the database',
  schema: v001,
});

export type Db = typeof db;

const db = migrations.applySync({
  databasePath: resolve(DATA_PATH, 'database.db'),
  migrationDatabasePath: resolve(DATA_PATH, 'migration-database.db'),
});

const userByMail = db.tables.users
  .query()
  .where({ email: 'e.dldc@gmail.com' })
  .select({ email: true, name: true })
  .all();

const firstTask = db.tables.tasks.query().maybeFirst();

const newTask = db.tables.tasks.insert({
  id: nanoid(10),
  chainId: '',
  color: '',
  date: new Date(),
  name: '',
  infos: '',
  priority: 'low',
  repeat: null,
  spaceId: '',
  big: 12n,
});

console.log(newTask.createdAt);

db.tables.spaces.delete({ id: '' }, { limit: 1 });
db.tables.spaces.deleteOne({ id: '' });

// const userSpacesFromToken = db.tables.users
//   .query()
//   .where({ token: 'token1' })
//   .pipe('email', 'user_space', 'userEmail')
//   .pipeOne('spaceId', 'spaces', 'id')
//   .orderBy('name', 'Desc')
//   .select({ name: true, slug: true, id: true })
//   .one();

// console.log(JSON.stringify(userSpacesFromToken, null, 2));

// userSpacesFromToken[0].slug;

const tasksWithUsers = db.tables.tasks
  .query()
  .limit(10)
  .select({ id: true, name: true, date: true })
  .pipe('id', 'task_user', 'taskId')
  .pipeOne('userEmail', 'users', 'email')
  .select({ email: true, name: true })
  .all();

console.log(JSON.stringify(tasksWithUsers, null, 2));

// tasksWithUsers[0].task_user[0].email;

db.tables.tasks.delete({ id: 'yolo' });
