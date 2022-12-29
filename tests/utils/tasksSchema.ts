import { Schema } from '../../src/mod';

export const tasksSchema = Schema.define({
  tables: {
    tasks: Schema.table({
      id: Schema.column.dt.text().primary(),
      title: Schema.column.dt.text(),
      description: Schema.column.dt.text(),
      completed: Schema.column.dt.boolean(),
    }),
    users: Schema.table({
      id: Schema.column.dt.text().primary(),
      name: Schema.column.dt.text(),
      email: Schema.column.dt.text(),
    }),
    users_tasks: Schema.table({
      user_id: Schema.column.dt.text().primary(),
      task_id: Schema.column.dt.text().primary(),
    }),
  },
});
