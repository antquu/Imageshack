# ImageShack

A free image and video host that looks like a web portal from 2005-2010, built as a static site on Vercel.

I wanted to see how far a hosting site could go without a database of its own. ImageShack stores nothing: files are sent to existing hosts (Catbox, then NoelShack as a fallback), and every link the site gives out is built from the file's address at the host. The only server-side pieces are a Vercel middleware and two small services on a home VM.

> Student project, not a commercial service. It depends on Catbox and NoelShack staying up and keeping their current upload endpoints.

![HTML](https://img.shields.io/badge/HTML-static-e34f26) ![CSS](https://img.shields.io/badge/CSS-handwritten-1572b6) ![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-f7df1e) ![Vercel](https://img.shields.io/badge/hosting-Vercel-black) ![License](https://img.shields.io/badge/license-GPL--3.0-blue)

## Features

**Uploading**
- Drag and drop anywhere on the page, a file picker, or Ctrl+V to paste a screenshot.
- Images (JPG, PNG, GIF, WEBP, BMP, SVG, TIFF, PSD) and videos (MP4, WEBM, MOV, MKV, AVI), up to 200 MB per file.
- Up to 20 files at once, uploaded one after the other with a progress bar per file.
- Upload from a URL with the bar at the top of every page.
- Dedicated pages for photos, GIFs, videos, screenshots and bulk uploads. They reuse the home page with a different title and file filter.
- A YouTube downloader (MP4 or MP3), backed by [yt-dlp](https://github.com/yt-dlp/yt-dlp) on a home VM.

**Links**
- For each upload: a raw link, an ImageShack viewer page, BBCode for forums, HTML for blogs, and the original link at the host.
- "My images" keeps the history of the current browser, with a copy-all button.
- Each file has a viewer page. Images appear line by line from top to bottom, like on a dial-up connection. Videos play in a custom player with a loading spinner.

**The rest**
- French or English depending on the visitor's country, with a manual switch at the top and bottom of every page.
- No account, no analytics, no tracking. The only cookie stores the visitor's country for the language.
- `robots.txt`, `sitemap.xml`, meta descriptions and Open Graph tags for search engines and link previews.
- A 300x250 ad slot that rotates on each page load: either the GreLines ad (another project of mine) or a random image from `pubs/`.

The look follows the MSN home page around 2010: blue gradient header, link grid, three columns, Tahoma at 12 px, glossy buttons, and an XP-style progress bar.

## How it works

```
browser ──► static site (Vercel)
   │           ├─ /noelshack/*           ──► www.noelshack.com      (fallback upload, middleware.js)
   │           ├─ /youtube/api           ──► YouTube service on the VM (middleware.js adds the API key)
   │           ├─ /c/<id>                ──► files.catbox.moe       (raw file, rewrite)
   │           └─ /i/<path>, /m/<path>   ──► image.noelshack.com    (raw file, thumbnail, rewrite)
   │
   └─────────► home VM (Tailscale Funnel)
               ├─ /catbox-relay          ──► catbox.moe/user/api.php (upload)
               └─ :8443                   YouTube service (yt-dlp): progress and finished files
```

Neither Catbox nor NoelShack sends CORS headers, so the browser cannot read their responses directly. Each one also refuses something about Vercel:

- **Catbox** answers `Invalid uploader` to any upload coming from Vercel's servers. Uploads therefore go straight from the browser to a small relay on my home VM (`vm/catbox-relay.mjs`), which forwards them from a home connection. This also means large videos never go through Vercel.
- **NoelShack** answers 404 to requests that carry an `X-Forwarded-Host` header, which Vercel adds to every rewrite. `middleware.js` forwards those calls itself with a plain `fetch` instead.

Raw links (`/c/`, `/i/`, `/m/`) are plain rewrites in `vercel.json`. The VM setup is described in [`vm/README.md`](vm/README.md).

### Uploading

The upload code is in `app.js`.

1. The file is posted to Catbox through the relay (`reqtype=fileupload`, `fileToUpload`). Catbox answers with the file URL as plain text.
2. If Catbox fails and the file is an image of 4 MB or less, it is posted to NoelShack instead (field `fichier[]`). NoelShack answers with JSON containing the direct link and a thumbnail.
3. Videos have no fallback, because NoelShack only accepts images.

For videos, a frame is captured from the local file with a canvas before the upload. It is used as the thumbnail in the history and as the poster on the viewer page.

### Links without a database

The links contain the file's address at the host, so there is nothing to store:

| Host | Raw file | Viewer page |
| --- | --- | --- |
| Catbox | `/c/4jvgxe.png` | `/v/c/4jvgxe.png` |
| NoelShack | `/i/2026/43/7/1792958618-name.png` | `/v/2026/43/7/1792958618-name.png` |

`/c/` and `/i/` are rewrites to the host, so the raw link stays on the site's domain. The viewer page (`view.html`) reads the path from its own URL and rebuilds every link from it. The history in "My images" is kept in `localStorage`, so it only exists in the browser that made the uploads.

### Video player

`files.catbox.moe` sends `X-Frame-Options: DENY`, so the file cannot be embedded with an iframe. The viewer page uses a `<video>` element instead, with custom controls written in `lecteur.js`: play/pause, stop, seek bar, volume, full screen (the bar hides after 2.5 seconds of inactivity), and keyboard shortcuts. Catbox supports range requests, so seeking works without downloading the whole file.

### Language

`middleware.js` runs on Vercel before every page and copies the country detected from the visitor's IP (`x-vercel-ip-country`) into a cookie named `is_pays`. `langue.js` is loaded in the `<head>` of every page and picks the language in this order:

1. the visitor's manual choice, saved in `localStorage`;
2. the country cookie: French in French-speaking countries (including Quebec), English everywhere else;
3. the browser language, which is what happens locally since there is no middleware.

Page text is written in both languages (`data-l="fr"` and `data-l="en"`) and CSS hides the one that is not in use. Text generated by JavaScript goes through `IS.t(fr, en)`.

### YouTube downloader

The `/youtube-downloader` page sends the link to `/youtube/api`. `middleware.js` relays that request to a small service on the home VM (`vm/yt-service.mjs`) and adds its API key, so the key never reaches the browser. The service runs yt-dlp and ffmpeg, the page shows the progress, and the browser downloads the finished file straight from the VM. Files are deleted after 30 minutes.

The setup is described in [`vm/README.md`](vm/README.md). The site needs two environment variables, `YT_API_URL` and `YT_API_KEY`. Without them, the page shows an "unavailable" message. I started with a self-hosted Cobalt instance, but it returned empty files for most recent videos, so I replaced it with yt-dlp.

### Ads

Ad images go in the `pubs/` folder (PNG, JPG, GIF or WEBP, ideally 300x250). At build time, `scripts/pubs.cjs` lists them in `pubs/index.json`. On each page load there is one chance in two to show one of them, picked at random, instead of the GreLines ad. Click targets are optional and go in `pubs/liens.json`:

```json
{ "summer-sale.png": "https://example.com" }
```

The local server builds the list on the fly, so a new image shows up after a simple reload.

## Running locally

Node 18 or later is needed (for `fetch` and web streams).

```bash
npm install
npm run dev        # http://localhost:3000
```

`dev-server.cjs` serves the files and mirrors the rewrites and clean URLs of `vercel.json`, so uploads and links work locally as well. It has no dependencies.

To test the language detection without deploying:

```bash
PAYS=US npm run dev    # English
PAYS=FR npm run dev    # French
```

## Deploying on Vercel

1. Import the GitHub repository in Vercel. No framework preset is needed.
2. Optional: set `SITE_URL` to the production address (for example `https://imageshack.example.com`). Without it, the build uses the Vercel production domain. For the YouTube downloader, also set `YT_API_URL` and `YT_API_KEY` (see `vm/README.md`).
3. Deploy. `npm run build` generates `robots.txt` and `sitemap.xml` with the right domain (`scripts/seo.cjs`) and the ad list (`scripts/pubs.cjs`).

To appear on Google, add the site to the [Google Search Console](https://search.google.com/search-console) and submit `/sitemap.xml`.

## Project structure

```
index.html          home page, also served for /upload-photo, /upload-gif, /upload-video, ...
view.html           viewer page for /v/...
my-images.html      upload history of the current browser
thanks.html         thank-you page linked from the "retired" strip
youtube-downloader.html   YouTube downloader page
how-it-works.html, help.html, terms.html, privacy.html, sitemap.html, 404.html

commun.js           shared layout (header, columns, footer), history, links, clipboard, toast
app.js              upload logic (Catbox, NoelShack fallback, queue, drag and drop, paste)
lecteur.js          custom video player
youtube.js          YouTube downloader (starts the download, follows its progress)
langue.js           language selection, loaded before the page renders
style.css           all styles

middleware.js       Vercel routing middleware (country cookie, NoelShack and YouTube relays)
vercel.json         raw-link rewrites, clean URLs, cache headers
dev-server.cjs      local server that mirrors vercel.json
scripts/seo.cjs     generates robots.txt and sitemap.xml at build time
scripts/pubs.cjs    lists the ad images of pubs/ in pubs/index.json
pubs/               ad images, plus optional click targets in liens.json
vm/                 home VM services: Catbox relay and YouTube download service
```

## Known limits

- Uploads to Catbox and YouTube downloads depend on the home VM. If it is off, uploads fall back to NoelShack (images up to 4 MB) and the downloader shows an "unavailable" message.
- NoelShack is meant for images used on jeuxvideo.com, and its terms allow it to delete images that are not used there for more than 48 hours.
- Catbox keeps anonymous uploads until they go 2 years without a view. Its FAQ asks for approval before using it as a CDN or as a video source for other sites, which is what the raw links and the video player do.
- Both languages share the same URLs, so search engines mostly index the English version. Separate `/en/` pages with `hreflang` would fix that.
- The history lives in `localStorage`: clearing the browser data or switching computers loses it. The files themselves stay online.

## Credits

- File hosting by [Catbox](https://catbox.moe) and [NoelShack](https://www.noelshack.com). ImageShack is not affiliated with either.
- Layout inspired by the MSN home page of 2005-2010. The butterfly logo is a tribute to the MSN butterfly; MSN is a trademark of Microsoft.
- [GreLines](https://grelines.fr), another project of mine, for the default ad.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [FFmpeg](https://ffmpeg.org) for the YouTube downloader. YouTube is a trademark of Google LLC, and ImageShack is not affiliated with it.

## License

ImageShack is released under the [GNU GPL v3](LICENSE) or any later version. You can reuse and modify it as long as you publish your changes under the same license.
