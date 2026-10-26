# Home VM setup

Two small Node services run on the same home VM as the Googlant index server, and are published with Tailscale Funnel. Neither has dependencies.

| Service | Local port | Public address |
| --- | --- | --- |
| Catbox relay (`catbox-relay.mjs`) | 9100 | `https://<vm>.ts.net/catbox-relay` |
| YouTube download service (`yt-service.mjs`) | 9200 | `https://<vm>.ts.net:8443/` |

**Why a relay for Catbox?** Catbox refuses uploads coming from Vercel's servers (`Invalid uploader`). The browser sends the file to the relay instead, which forwards it to catbox.moe from the home connection. The relay only accepts requests from the site's origins (`ALLOWED_ORIGINS`), limits each IP to 30 uploads per minute and files to 200 MB.

**How the YouTube service works.** `middleware.js` sends `POST /` with the API key, the service starts [yt-dlp](https://github.com/yt-dlp/yt-dlp) and answers right away with a status link. The page polls `/jobs/<id>` for the progress, then downloads `/files/<id>`. Both links carry a random token, and files are deleted 30 minutes after they are ready. At most two downloads run at once, videos are limited to one hour, and a download is stopped after 15 minutes.

I first used a [Cobalt](https://github.com/imputnet/cobalt) instance, but with its default YouTube client it returned empty files for most recent videos, while yt-dlp downloaded them fine from the same connection.

## Installation

Tested on Ubuntu 26.04 with Node 24.

```bash
apt-get install -y ffmpeg
mkdir -p /opt/imageshack/bin
cp catbox-relay.mjs yt-service.mjs /opt/imageshack/
curl -L -o /opt/imageshack/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
chmod 755 /opt/imageshack/bin/yt-dlp
```

Create `/etc/imageshack/yt.env` (readable by root only) with the public address and a new key:

```bash
mkdir -p /etc/imageshack
printf "PUBLIC_URL=https://<vm>.ts.net:8443/\nAPI_KEY=%s\n" "$(cat /proc/sys/kernel/random/uuid)" > /etc/imageshack/yt.env
chmod 600 /etc/imageshack/yt.env
```

Install the services and publish them:

```bash
cp imageshack-catbox-relay.service imageshack-yt.service imageshack-ytdlp-update.* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now imageshack-catbox-relay imageshack-yt imageshack-ytdlp-update.timer
tailscale funnel --bg --set-path /catbox-relay http://127.0.0.1:9100/catbox-relay
tailscale funnel --bg --https=8443 http://127.0.0.1:9200
```

Port 443 is shared with Googlant (path-based), the YouTube service gets port 8443 because its links are served from the root. Edit `ALLOWED_ORIGINS` in the service files if the site uses another domain.

Then, in the Vercel project settings, add `YT_API_URL` (the 8443 address) and `YT_API_KEY` (the key from `yt.env`), and redeploy. For local development, the same two lines go in `.env.local` at the root of the project.

## Checking

```bash
systemctl status imageshack-catbox-relay imageshack-yt
journalctl -u imageshack-yt -n 20
tailscale funnel status
```

yt-dlp updates itself every day (`imageshack-ytdlp-update.timer`), which is what usually fixes downloads when YouTube changes something. To update by hand: `/opt/imageshack/bin/yt-dlp -U`.
