Drop the dev MongoDB database to start from a clean state.

No argument. This is destructive — it deletes all users, tokens, and preferences
in the dev database.

## Steps

1. Confirm with the user that wiping the dev data is intended.
2. Drop the database:
   ```bash
   docker compose exec -T mongo mongosh auth_preferences --quiet \
     --eval 'db.dropDatabase()'
   ```
3. Report the result. Collections and indexes are recreated automatically by
   Mongoose on the next write/startup.

To also wipe the persistent volume entirely (rarely needed):
`docker compose down -v` then `docker compose up -d` — confirm first.
