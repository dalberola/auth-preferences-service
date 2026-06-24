Open a `mariadb` shell (or run a one-off query) against the dev MariaDB.

Optional argument: a SQL statement to evaluate non-interactively. If empty, print
how to open an interactive shell.

Query: $ARGUMENTS

The dev database is `auth_preferences` (set by docker-compose).

## Steps

- One-off query (argument given):
  ```bash
  docker compose exec -T mariadb mariadb -uroot -proot auth_preferences -e "<SQL>"
  ```
  Examples:
  - count users → `SELECT COUNT(*) FROM users;`
  - inspect a user → `SELECT * FROM users WHERE email='user@example.com'\G`
  - list refresh tokens → `SELECT * FROM refresh_tokens;`
  - show table schema → `SHOW CREATE TABLE users\G`

- Interactive shell (no argument):
  ```bash
  docker compose exec mariadb mariadb -uroot -proot auth_preferences
  ```

Reminder: tokens are stored as sha256 hashes, so you cannot read raw token values
from the DB — capture them from the email (Mailpit) or the API response.
