Drop the dev MariaDB database to start from a clean state.

No argument. This is destructive — it deletes all users, tokens, and preferences
in the dev database.

## Steps

1. Confirm with the user that wiping the dev data is intended.
2. Drop and recreate the database, then restart the app:
   ```bash
   docker compose exec -T mariadb mariadb -uroot -proot \
     -e "DROP DATABASE IF EXISTS auth_preferences; CREATE DATABASE auth_preferences;"
   docker compose restart app
   ```
3. Report the result. TypeORM `synchronize` recreates the tables on the next
   app startup.

To also wipe the persistent volume entirely (rarely needed):
`docker compose down -v` then `docker compose up --build` — confirm first.
