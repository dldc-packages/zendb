# v9.0.0

- **BREAKING CHANGE**: Revamped the Query API to be more explicit about what is
  overriden and what is not. Main change is that `where()` is not longer merging
  with `AND`, use `andWhere()` instead.
