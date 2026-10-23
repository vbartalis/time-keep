# 10. The app deploys from a compose file

- date: 2026-10-23
- status: active
- amends: —
- amended-by: —
- superseded-by: —

## Rule

Coolify deploys the app with its Docker Compose build pack from `docker-compose.yaml`
in the repository root, written the way Coolify's own service templates are: it builds
the image from the `Dockerfile`, mounts the named volume `time-keep-data` at `/data`,
fixes `DATABASE_PATH` to `/data/time-keep.db`, and uses Coolify's magic variables, so
`SERVICE_URL_APP_3000` makes Coolify generate the domain and route to port 3000 and
`SERVICE_PASSWORD_ADMIN` makes it generate the first admin's password
(`ADMIN_USERNAME` defaults to `admin`). It carries the health check. Coolify adds the
restart policy, network and labels. Nothing has to be filled in or set up by hand in
Coolify; the domain and the username may be changed there.

## Why

The first deploy (2026-10-23), with the Dockerfile build pack, failed: a
`DATABASE_PATH` set in Coolify's environment pointed the database at `/app/data`, which
the image's user cannot write, and the Dockerfile's `VOLUME` gives no volume Coolify
keeps, so persistence would have been a manual storage entry. With a compose file the
volume and the path live in git and cannot be forgotten or overridden, which is what
the operator asked for (2026-10-23: "shouldnt the setup automatically setup the
persistance?") and what the Docker rule wants: container setup in the repository,
never by hand.
