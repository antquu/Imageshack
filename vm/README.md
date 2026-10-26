# Home VM setup

Two services run on the same home VM as the Googlant index server, and are published with Tailscale Funnel:

| Service | Local port | Public address |
| --- | --- | --- |
| Catbox relay (`catbox-relay.mjs`) | 9100 | `https://<vm>.ts.net/catbox-relay` |
| Cobalt, for the YouTube downloader | 9000 | `https://<vm>.ts.net:8443/` |

**Why a relay for Catbox?** Catbox refuses uploads coming from Vercel's servers (`Invalid uploader`). The browser sends the file to the relay instead, which forwards it to catbox.moe from the home connection. The relay only accepts requests from the site's origins (`ALLOWED_ORIGINS`), limits each IP to 30 uploads per minute and files to 200 MB.

**Why a private Cobalt?** The official instance (`api.cobalt.tools`) is reserved for cobalt.tools and has YouTube disabled. The site never exposes the API key: `middleware.js` adds it to requests sent to `/youtube/api`. Download links returned by Cobalt are signed tunnel links, so the file goes straight from the VM to the browser.

## Installation

Tested on Ubuntu 26.04 with Node 24.

```bash
apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
```

### Catbox relay

```bash
mkdir -p /opt/imageshack
cp catbox-relay.mjs /opt/imageshack/
cp imageshack-catbox-relay.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now imageshack-catbox-relay
tailscale funnel --bg --set-path /catbox-relay http://127.0.0.1:9100/catbox-relay
```

Edit `ALLOWED_ORIGINS` in the service file if the site uses another domain.

### Cobalt

```bash
mkdir -p /opt/imageshack/cobalt && cd /opt/imageshack/cobalt
cp /path/to/vm/docker-compose.yml .
cp /path/to/vm/keys.example.json keys.json     # then replace the UUID
cat /proc/sys/kernel/random/uuid               # generates a new key
cp /path/to/vm/.env.example .env               # set the public address
tailscale funnel --bg --https=8443 http://127.0.0.1:9000
docker compose up -d
```

Port 443 is shared with Googlant (path-based), Cobalt gets port 8443 because it needs to be served from the root.

Then, in the Vercel project settings, add `COBALT_API_URL` (the 8443 address) and `COBALT_API_KEY` (the UUID from `keys.json`), and redeploy. For local development, the same two lines go in `.env.local` at the root of the project.

## Checking

```bash
systemctl status imageshack-catbox-relay
docker compose -f /opt/imageshack/cobalt/docker-compose.yml ps
tailscale funnel status
```

If YouTube starts asking the instance to prove it is not a bot (`youtube.login` error), `docker compose restart` usually gets a fresh session. Watchtower keeps the Cobalt images up to date.
