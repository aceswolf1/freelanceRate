# Automated deploy: GitHub → GHCR → NAS

This wires the repo to your TrueNAS so a **release tag** tests the code, rebuilds
the images, and the NAS **auto-updates itself**: no manual builds, no SSH, nothing
on the NAS exposed to the internet.

```
git tag v1.2.0 && git push origin v1.2.0
        │
        ▼
GitHub Actions (.github/workflows/publish.yml)
   test (backend + Postgres, frontend) → build multi-arch (amd64+arm64) → GHCR
   tags: 1.2.0, 1.2, latest
        │
        ▼  (Watchtower polls GHCR every 5 min)
NAS Watchtower  ──▶  new :latest digest?  ──▶  pull + recreate backend & frontend
                                                (Postgres is never touched)
```

**Images** (public):
- `ghcr.io/aceswolf1/freelancer-invoices-backend`
- `ghcr.io/aceswolf1/freelancer-invoices-frontend`

**Network shape:** only the frontend is published (NAS port `3010`). The
browser calls same-origin `/api`, and the frontend proxies it to the backend on
the app's internal network. The API and Postgres are never exposed, and there's no
CORS or API URL to configure for the NAS hostname.

---

## Part 1 — CI (already committed)

`.github/workflows/publish.yml` runs on every `v*` tag. It needs **no secrets**,
because it uses the built-in `GITHUB_TOKEN`. One-time repo setting:

1. **Settings → Actions → General → Workflow permissions** → **Read and write
   permissions** (lets Actions push to GHCR).

### Gotcha: `denied: permission_denied: write_package` on the first run

```
failed to push ghcr.io/aceswolf1/freelancer-invoices-backend:<tag>: denied:
permission_denied: write_package
```

Cause: a **pre-existing package not linked to this repo**. Any image pushed to
GHCR outside Actions (e.g. a manual `docker push`) has no write role for the
repo's `GITHUB_TOKEN`. Fix once per package:

1. Open the package settings:
   - `https://github.com/users/aceswolf1/packages/container/freelancer-invoices-backend/settings`
   - `https://github.com/users/aceswolf1/packages/container/freelancer-invoices-frontend/settings`
2. **Manage Actions access → Add Repository** → `freelanceRate` → role **Write**.
3. **Actions → the run → Re-run failed jobs** (no new tag needed).

If the packages were never pushed manually, the first Actions run creates them
already linked, and you won't see this.

### Make the packages public (one-time, after the first successful run)

New GHCR packages start **private**. For each package: **Package settings →
Change visibility → Public**. Then the NAS and Watchtower pull without
credentials. (To keep them private, see "Private images" below.)

### Cutting a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

Watch it under **Actions**. The `test` job must pass before anything is
published. When it's green, each image has `:0.1.0`, `:0.1` and `:latest`.

> Watchtower tracks the **moving `:latest`** tag, which is why every release also
> moves `:latest` even though builds are triggered by version tags.

---

## Part 2 — First deploy on TrueNAS (one-time)

1. **Create a dataset** for the database, e.g. `storage/freelancer-invoices`
   (→ `/mnt/storage/freelancer-invoices`). The Postgres files go in `pgdata/`
   inside it, so they're covered by your snapshots.
2. **Apps → Discover Apps → Custom App → Install via YAML**, name it
   `freelancer-invoices`, and paste [`docker-compose.registry.yml`](../docker-compose.registry.yml).
   **Before deploying, edit in the pasted YAML** (Custom Apps don't read `.env`):
   - `CHANGE_ME_DB_PASSWORD` → a strong URL-safe password, in **both** places
     (`db` and the backend's `DATABASE_URL`). Never commit the real value.
   - `TZ` if you're not on `America/Chicago`.
   - `"3010:3000"` if NAS port 3010 is taken. Change **only the left number**:
     `PORT` and the right side of `ports:` must both stay `3000`.
   - the `/mnt/storage/...` path if your pool differs.
3. Deploy. The backend applies database migrations on start. Open
   `http://<nas>:3010` (e.g. `http://192.168.18.10:3010`).

### Moving your existing data to the NAS (optional)

```bash
# on your Mac
pg_dump -h localhost -U cace -Fc freelancer_invoices > freelancer.dump
# copy to the NAS, then on the NAS (app running):
sudo docker exec -i ix-freelancer-invoices-db-1 \
  pg_restore -U freelancer -d freelancer_invoices --clean --if-exists < freelancer.dump
```

---

## Part 3 — Watchtower (auto-update)

**You may already have it:** the PixelPaladin Watchtower on the NAS runs with
`WATCHTOWER_LABEL_ENABLE=true`, so it also manages any container carrying
`com.centurylinklabs.watchtower.enable=true`, including this app's backend and
frontend. Check its log after the next poll for `Scanned=` going up by 2.

Otherwise, add [`deploy/watchtower.compose.yml`](./watchtower.compose.yml) as a
**separate** Custom App (**Install via YAML** → paste → deploy). Healthy logs:
`Only checking containers using enable label`, then each poll ends with
`Session done: Scanned=N Updated=M Failed=0`.

From now on: `git tag vX.Y.Z && git push origin vX.Y.Z`, and a few minutes later
the NAS runs the new build.

---

## Update model

`:latest` makes updates **digest-based**: Watchtower recreates a service when the
`:latest` digest changes.

- **Auto (default):** Watchtower drives. Ignore the TrueNAS "update available"
  badge; it clears after the next poll.
- **Manual instead:** if you'd rather click Update in TrueNAS, remove the
  Watchtower labels (or stop Watchtower) so the two don't both act.
- **Version-pinned / rollback:** set the image to a version tag (e.g.
  `freelancer-invoices-backend:0.1.0`) and remove that service's Watchtower label.

**Database migrations** run automatically when the new backend starts. They're
additive-only by convention, so a rollback to an older image keeps working
against the newer schema. Take a dataset snapshot before upgrades that change
the schema.

## Private images (only if you keep the packages private)

1. Create a GitHub PAT (classic) with **`read:packages`** only.
2. On the NAS: `sudo docker login ghcr.io -u aceswolf1` (paste the PAT), which
   is needed for the first deploy.
3. For Watchtower, create `/mnt/storage/freelancer-invoices/watchtower-config.json`:
   ```json
   { "auths": { "ghcr.io": { "auth": "BASE64_OF_aceswolf1:TOKEN" } } }
   ```
   (`printf 'aceswolf1:<PAT>' | base64`), and mount it in
   `watchtower.compose.yml` as `- /mnt/storage/freelancer-invoices/watchtower-config.json:/config.json:ro`.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `write_package` denied on first Actions run | Pre-existing package not linked | Manage Actions access → Add `freelanceRate` → Write; re-run |
| `exec format error` on the NAS | Single-arch image | The workflow builds amd64+arm64; don't push manual single-arch images |
| Watchtower `Scanned=0` | App deployed without the `labels:` blocks | Re-paste the current `docker-compose.registry.yml` (keep both `labels:`) |
| Image pull denied on the NAS | Packages still private | Make them public, or use the private-images steps |
| Postgres `permission denied` on `pgdata` | Dataset ACL blocks the container's chown | Use a dataset with the **Apps** preset, or give the dataset to uid/gid `70` (postgres in alpine) |
| Backend unhealthy, log `password authentication failed` | Password differs between `db` and `DATABASE_URL` | Use the same value in both places |
| Week rolls over early in the evening | `TZ` not set | Set `TZ` on all three services |
| Deploy fails: `Bind for 0.0.0.0:3010 failed: port is already allocated` | Another app uses that NAS port | Change the left number of the frontend's `ports:` to a free port |
| App "Running" + frontend healthy, but the browser gets `ERR_CONNECTION_REFUSED` | Frontend `PORT` was changed, so it listens on a port `ports:` doesn't forward to | Set frontend `PORT: "3000"` (check with `sudo docker logs ix-freelancer-invoices-frontend-1`: it must say `Listening on http://0.0.0.0:3000`) |
| Backend `unhealthy` after changing the DB password | Postgres only applies the password when `pgdata` is first created | If there's no real data yet, empty `pgdata` and redeploy; otherwise change it with `ALTER USER freelancer PASSWORD '...'` |

### Tip: Docker commands on TrueNAS

The admin user isn't in the `docker` group. Prefix commands with `sudo`, and use
explicit container names (`ix-freelancer-invoices-backend-1`, …).
