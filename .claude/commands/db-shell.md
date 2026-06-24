Open a mongosh shell (or run a one-off query) against the dev MongoDB.

Optional argument: a JS expression to evaluate non-interactively. If empty, print
how to open an interactive shell.

Query: $ARGUMENTS

The dev database is `auth_preferences` (set by docker-compose).

## Steps

- One-off query (argument given):
  ```bash
  docker compose exec -T mongo mongosh auth_preferences --quiet --eval '<expr>'
  ```
  Examples:
  - count users → `db.users.countDocuments()`
  - inspect a user → `db.users.findOne({email:"user@example.com"})`
  - list refresh tokens → `db.refreshtokens.find().toArray()`
  - show indexes → `db.users.getIndexes()`

- Interactive shell (no argument):
  ```bash
  docker compose exec mongo mongosh auth_preferences
  ```

Reminder: tokens are stored as sha256 hashes, so you cannot read raw token values
from the DB — capture them from the email (Mailpit) or the API response.
