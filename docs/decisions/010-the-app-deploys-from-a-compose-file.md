# 10. The app deploys from a compose file

- date: 2026-10-23
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

Coolify deploys the app with its Docker Compose build pack from `docker-compose.yaml`
in the repository root. The file builds the image from the `Dockerfile`, mounts the
named volume `time-keep-data` at `/data`, fixes `DATABASE_PATH` to
`/data/time-keep.db`, requires `ADMIN_USERNAME` and `ADMIN_PASSWORD`, and carries the
health check. Everything the deployment needs, other than the domain and those two
values, is in the file; nothing is set up by hand in Coolify.

## Why

The first deploy (2026-10-23), with the Dockerfile build pack, failed: a
`DATABASE_PATH` set in Coolify's environment pointed the database at `/app/data`, which
the image's user cannot write, and the Dockerfile's `VOLUME` gives no volume Coolify
keeps, so persistence would have been a manual storage entry. With a compose file the
volume and the path live in git and cannot be forgotten or overridden, which is what
the operator asked for (2026-10-23: "shouldnt the setup automatically setup the
persistance?") and what the Docker rule wants: container setup in the repository,
never by hand.
