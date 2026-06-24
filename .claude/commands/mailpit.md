Inspect verification emails captured by Mailpit in dev.

Optional argument: `open` (default — print the web UI URL) or `latest` (fetch the
most recent message and extract the verification link).

Action: $ARGUMENTS

Mailpit catches all outbound mail in dev; nothing is sent to real inboxes.

## Steps

- `open` (default) → tell the user to open http://localhost:8025.
- `latest` → query the Mailpit API and pull the verify link:
  ```bash
  # newest message id
  ID=$(curl -s 'http://localhost:8025/api/v1/messages?limit=1' | sed -n 's/.*"ID":"\([^"]*\)".*/\1/p' | head -1)
  # message body, then the verification URL
  curl -s "http://localhost:8025/api/v1/message/$ID" \
    | grep -oE 'http://localhost:4000/auth/verify\?token=[A-Za-z0-9_-]+' | head -1
  ```
  Then optionally `curl` that link to verify the account end-to-end.

If no messages exist, register a user first (`POST /auth/register`).
