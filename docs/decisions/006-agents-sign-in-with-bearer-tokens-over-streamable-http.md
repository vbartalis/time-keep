# 6. Agents sign in with bearer tokens over Streamable HTTP

- date: 2026-10-19
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

Agents reach the app through its MCP server at `/mcp`, served as stateless Streamable
HTTP (`POST` only, a fresh server per request, JSON responses), and sign in with a
per-user bearer token sent as `Authorization: Bearer tk_…`. A user makes and revokes
their own tokens on the Account screen; a token is shown once and only its SHA-256 is
stored. A token acts as its user, on that user's data, through the core as actor
`agent`; it never opens a screen, and a session cookie never opens `/mcp`. Disabling
a user deletes their tokens. There is no OAuth.

## Why

One person uses the app, and the agents that use it (Claude Code, the import script)
can hold a secret header, so a static token is all "behind authentication" needs and
nothing new has to run beside the one container. The MCP specification's OAuth flow
(dynamic client registration, a consent screen, refresh tokens) would be the app's
largest authentication surface and serves no client in use. Revisit when a client
that is needed accepts only OAuth.
