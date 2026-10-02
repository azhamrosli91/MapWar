# Malaya World War II

This repository is **MapWar**, a map editor for visualizing military scenarios. The interface is branded **Malaya World War II**. Create your own map with badges, units, routes, annotations, and timeline playback, then save a portable JSON backup.

A React + Vite application for placing custom flag-and-label badges on Google Maps. A local Node service renders MP4 videos; maps and badges are stored in the browser without a database server or sign-in.

## Run locally

Use Node.js 24 or a supported newer release. From this project folder:

```sh
npm install
npm run setup:video
npm run dev
```

Open the local address printed by Malaya World War II (normally `http://127.0.0.1:5181`). `setup:video` installs Chromium for local MP4 rendering; the packaged FFmpeg executable is installed with npm. Without a key, the setup screen and coordinate-based badge editor are available; the live Google map requires the configuration below.

## Connect Google Maps

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Link a billing account and enable **Maps JavaScript API**. Place search is not used, so Places API is not needed. Google Maps usage may incur charges; configure quotas and billing alerts appropriate to your usage.
3. Create an API key. Set its application restriction to **Websites (HTTP referrers)**. Add your local address, normally `http://127.0.0.1:5181/*`. Add `http://127.0.0.1:4173/*` if you use the production preview. Add your actual HTTPS website address when hosting.
4. Restrict the key to **Maps JavaScript API** under API restrictions. A browser key is visible in the built app; website and API restrictions protect its use. Never put server credentials in Vite variables.
5. Copy `.env.example` to `.env.local` and enter your key:

```dotenv
VITE_GOOGLE_MAPS_API_KEY=your_actual_key
VITE_GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID
```

`DEMO_MAP_ID` is Google's development map ID. For production, create your own **JavaScript map ID** in Google Maps Platform → Map Management and use it instead. Advanced markers require a map ID.

Restart Vite after changing environment settings. For a production build, rebuild after changing them. If Google Maps fails to load, check the browser console for the specific Google error and verify API enablement, billing, key restrictions, and network connectivity.

References: [API key setup](https://developers.google.com/maps/documentation/javascript/get-api-key), [advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).

## Use your map

- Select **Add badge**, enter a label, and upload a PNG, JPEG, or WebP flag under 5 MB. Images are resized to a maximum of 512 pixels on their longest edge and stored with the map.
- Choose a helmet, artillery, tank, warship, person, custom image, or no symbol. A custom symbol image can be PNG, JPEG, or WebP. Choose 0–5 stars; 0 hides the stars.
- Choose **S**, **M**, **L**, or **XL** to size the entire badge. M is the original size; the other sizes are 50%, 125%, and 150% of M.
- Click the live map to pick a position, or enter latitude (−90 to 90) and longitude (−180 to 180). Select **Save badge**.
- Drag a saved badge without a movement route to move it. Click its map marker or its entry in the panel to reopen it for editing or deletion. During editing, the preview marker is positioned using **Choose on map** or the coordinate fields. For a routed badge, edit stop A to change its starting position.
- Use **Symbols** to add a separate tank, warship, artillery, troop, or custom image marker. Symbols can be moved, edited, deleted, sized, and given historical movement routes without a flag.
- In either editor, set optional **Show from** and **Hide at** scenario dates. The feature appears at Show from and disappears at Hide at during playback and video export. Leave either field blank for an open-ended visibility window. Features remain visible while editing.
- Switch between Map and Satellite, or select **Show all features** to frame badges, symbols, lines, and movement routes.
- On a small screen, collapse the side panel to access the map, and reopen it with the panel button. The editor reopens after a location is chosen.
- Saved badges and the last map view are stored automatically in IndexedDB for this browser and website address. Unsaved editor changes are not stored. Keep the page open until the footer says **Saved on this device**.
- **Export map** downloads a JSON backup containing all saved badges, images, and map settings. **Import** validates a backup, then asks before replacing the current map and any unsaved edits.

Browser storage is local: changing browser, hostname, or port opens a separate workspace. Clearing site data removes locally saved maps. Private browsing or storage limits can prevent saving; the app reports this and you can export an in-memory backup. If existing data cannot be read, automatic saving remains paused until the issue is resolved and the page is reloaded, to avoid overwriting it. Multiple open tabs do not synchronize; use one editing tab per workspace.

## Draw lines

Open **Lines → Draw line** and click successive locations. **Undo last point** removes the latest point; **Finish** ends drawing so you can adjust handles, then **Save line** stores it. **Cancel** discards the draft. Lines appear red in Map view and white in Satellite view, including in video exports. Select solid or dashed lines with thin (3 px), medium (6 px), or thick (10 px) width.

Click a saved line or its sidebar entry to rename it, drag its handles, insert points by dragging a middle handle, or append points using **Add points**. Select a vertex on the map or in the Points selector to remove it. Lines require at least two points. Each map supports up to 200 lines with 2,000 points each, within the existing 24 MB project limit.

## Animate a historical route

In a badge or symbol editor, choose **Add movement route**. Stop A starts at its position and size. Set its historical date and time, then use **Add stop on map** or **Add by coordinates** for B, C, and further stops. Each stop has its own position, arrival date/time, size, and icon effect. Choose Normal, Firing, Booming, Demolish, Kills, or Crack. An effect appears on arrival, animates, and stays until the next stop; Firing flickers, Booming expands, Demolish shakes and falls, Kills pulses, and Crack flashes. The same animation appears in video exports. New stops inherit the previous size and default to one day later. Drag the lettered handles or edit coordinates to adjust locations. Dates must increase strictly; at least two dated stops are needed for animation. A route can contain up to 200 stops.

Enable **Show movement trail** to display the feature's full route in red on Map or white on Satellite. Selected routes use the same layer color while editing. These routes are separate from drawn line annotations.

Save the badge or symbol to enable the historical timeline. Use **Reset** immediately before **Play / Pause** in the header to pause and return all routes to their first date. The expanded timeline appears in the header below the main toolbar, with a date scrubber to preview all routes together with smooth movement and resizing. Minimize it with the minus button to keep only the current date visible on the map as **DD/MM/YYYY**; click the date to expand it again. **Length (sec)** controls the full timeline's playback length (5–600 seconds, initially 30). The timeline spans the earliest and latest animated stops. Badges and symbols hold their first position before their route begins and their final position after it ends; features without routes remain stationary.

Dates and times share a scenario clock with minute precision, independent of the computer's timezone. They animate badges on the selected Google background; they do not load historical Google imagery. Playback pauses when the browser tab is hidden. Choose **Edit map** to restore authored positions and edit again. Playback positions are never saved over authored positions. JSON exports include routes and playback length.

## Export an animated MP4

After saving a badge or symbol with a dated route or visibility change, choose **Export video**. Select landscape 16:9 or portrait 9:16. The shaded map area outside the frame is excluded from the video. Pan and zoom inside the frame to choose a fixed view; the Google logo and attribution remain inside it. **Show date** places the changing DD/MM/YYYY date in the video and starts enabled. Use **Preview** and the scrubber to check movement, then choose **Export MP4**.

The renderer creates a silent 30 fps H.264 video at 1920×1080 or 1080×1920. It displays progress, supports cancellation, and offers playback and download when finished. Rendering can take longer than the selected animation length. Completed files are available for one hour while the app is running. A single video renders at a time; up to two may wait. Closing an active export cancels it. When running locally, rendering stays on your computer. On the hosted website, PNG and MP4 exports send the map project to the Ubuntu server for rendering. Keep Malaya World War II open until the MP4 is ready. Restarting the service clears export jobs and makes previous downloads unavailable.

## Build and commands

```sh
npm run build
npm run preview
npm run lint
```

The production website is generated in `dist/`. Run the Node service to serve that folder and retain PNG/MP4 exports; a static-only host cannot render exports. Opening `index.html` directly using `file://` is not supported.

## Deploy on Ubuntu with Docker and Nginx

The included setup targets **https://war2.pinangemas.com.my** on **76.13.181.222**, using the server's existing Nginx installation. The app runs as a non-root user in Docker, including Linux Chromium and FFmpeg. Port 4173 is published only on the server's loopback interface; Nginx handles public requests and TLS. If port 4173 is already occupied, change the host port in `compose.yaml` and the upstream port in `deploy/war2.nginx.conf` together.

1. Set the DNS **A** record for `war2.pinangemas.com.my` to `76.13.181.222`. Remove any stale AAAA record unless IPv6 is configured on this server. Allow inbound TCP ports 80 and 443.
2. Install Docker Engine and its Compose plugin following the [official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/). Use the existing Nginx installation. You need sudo access to install the Nginx site and certificate.
3. Copy this project, including your deployment changes and `package-lock.json`, to `/opt/mapwar` on the server. A fresh Git clone must include the deployment changes before continuing. Do not copy Windows `node_modules`, `dist`, or local credentials.
4. Configure the Google Maps browser key for `https://war2.pinangemas.com.my/*` and restrict it to Maps JavaScript API. Create your own JavaScript map ID for production. The hosted renderer loads this same HTTPS address, so no localhost referrer needs to be added for hosted exports. The container must be able to reach the public domain over HTTPS and Google Maps over the internet.
5. In the project folder on Ubuntu:

```sh
cd /opt/mapwar
cp .env.example .env
nano .env
sudo docker compose up -d --build
```

Enter the actual `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_MAP_ID` in `.env`. These are browser settings embedded at build time; rebuild after changing them. `.env` is excluded from Git and the Docker build context. Compose passes the two browser settings explicitly as build arguments.

6. Install this domain's Nginx site without replacing existing sites:

```sh
sudo cp deploy/war2.nginx.conf /etc/nginx/sites-available/war2.pinangemas.com.my
sudo ln -s /etc/nginx/sites-available/war2.pinangemas.com.my /etc/nginx/sites-enabled/war2.pinangemas.com.my
sudo nginx -t
sudo systemctl reload nginx
```

If a site or symlink for this hostname already exists, merge the proxy settings into that site instead of installing a duplicate. The proxy preserves the hostname for the app's origin checks, permits 25 MB export requests, and allows up to five minutes of inactivity while a PNG renders.

7. After DNS resolves to this server, obtain HTTPS using [Certbot's Nginx instructions](https://certbot.eff.org/instructions?ws=nginx&os=snap). If Certbot is already installed:

```sh
sudo certbot --nginx -d war2.pinangemas.com.my --redirect
```

Certbot adds the certificate configuration and HTTP-to-HTTPS redirect to this site's configuration. Retain the installed renewal timer. PNG/MP4 rendering becomes available once the public HTTPS address works.

Useful operational commands:

```sh
sudo docker compose ps
sudo docker compose logs --tail=100 app
curl --fail http://127.0.0.1:4173/healthz
curl --fail https://war2.pinangemas.com.my/healthz
```

For updates, copy/pull the new source and run `sudo docker compose up -d --build`. Browser maps remain in each user's browser; export JSON backups before changing hostname. Temporary generated videos live in the container and expire after an hour. Rendering capacity is shared by all visitors.

Server settings: `HOST` controls the listening interface (defaults to `127.0.0.1` locally); `PORT` controls the port; `ALLOWED_HOSTS` adds comma-separated permitted hostnames; `RENDER_ORIGIN` selects the address Chromium loads (defaults to the local server). The Compose file configures these for the public domain.

## Project structure

| Location | Purpose |
| --- | --- |
| `src/App.jsx` | Main editor, tools, and project actions |
| `src/MapCanvas.jsx` | Google Maps integration and overlays |
| `src/data.js` | Project validation, browser storage, image handling, and JSON export |
| `src/Timeline.jsx`, `src/timeline.js`, `src/usePlayback.js` | Timeline controls and movement playback |
| `src/badge.js`, `src/effects.js`, `src/paint*.js` | Marker artwork, effects, and paint overlays |
| `src/VideoExportPanel.jsx`, `src/RenderApp.jsx`, `render.html` | Export controls and rendering page |
| `server/index.js` | Local development server and export service |
| `scenarios/` | Example scenarios and scenario-building resources |
| `.env.example` | Google Maps configuration template |

The editor also supports text annotations, arrows, colored paint overlays, troop counts, and PNG map picture export.

## Backup format

New projects use version **6**, which includes `paintStrokes` and map heading alongside the fields below. The loader accepts versions 1–6.

Version 5 JSON contains `version`, `view` (`center`, `zoom`, `mapTypeId`), `badges`, `units`, `lines`, and `playbackDuration` in seconds. Each badge includes `id`, `label`, `lat`, `lng`, `flag` (embedded image data URL), `symbol`, `symbolImage`, `stars`, `size`, `route`, `showTrail`, and `visibility`. Each movable symbol in `units` includes `id`, `name`, `kind`, `image`, `lat`, `lng`, `size`, `route`, `showTrail`, and `visibility`. Visibility has optional `showAt` and `hideAt` scenario times. Each route stop contains `id`, `lat`, `lng`, `dateTime` (`YYYY-MM-DDTHH:mm`), `size`, and `effect`. The first stop determines the feature's authored position and size. Each line includes `id`, `name`, `style` (`solid` or `dashed`), `width`, and a `path` of latitude/longitude points. Labels and line names are limited to 80 characters.

Versions 1–4 remain supported. Older maps load with visibility always on; versions before 4 also get zero stars, no custom symbol image, and Normal effects. Version 1 helmet settings are preserved. One map supports up to 500 badges, 500 movable symbols, and 24 MB of normalized map data, keeping exports within the 25 MB import limit. Imports validate coordinates, dates, chronological order, sizes, visibility windows, and unique identifiers. Imported labels and names are rendered as plain text.

Internet access is required for Google Maps. Interface fonts load from Google Fonts with local fallbacks. Uploaded flag images remain in your browser during editing. PNG and MP4 exports send project data and images to the app's rendering service; on the hosted website this runs on the Ubuntu server. Maps requests are made to Google.
