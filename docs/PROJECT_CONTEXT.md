# Project context

MapWar (Malaya World War II) is a React/Vite historical military map editor using Google Maps, IndexedDB project storage, server-side published copies, and Playwright/FFmpeg media exports.

## Territory architecture

Project format 9 adds `territory.mode` and a compact historical `campaign` selection to format 8's route settings. Formats 1–7 migrate with capture disabled; format 8 always migrates in route mode. IndexedDB remains `fieldmark`, version 1, with the existing `projects` store. Publication serialization uses the same normalized project model; generated territory is never persisted.

`territory-campaign.js` reconstructs fixed geographical arrival-time fields from dated historical localities using continuous inverse-fourth-distance weighting across all anchors. Exact locality coordinates retain their dates; intermediate areas are schematic. Marching triangles interpolate boundary crossings and merge fully captured cell runs into broad fills. The invisible interpolation mesh never appears as cell outlines. `territory-campaign-overlay.js` clips these fills to country shapes, applies group opacity once, caches projected geometry, and exposes the same readiness contract as the route overlay. Its deterministic state depends only on the scenario timestamp, not badge movement.

The versioned campaign asset bundles public-domain Natural Earth country boundaries and the existing scenario's capture localities, dates, and source references. Thailand changes as a complete country after the 8 December agreement; Malaysia is initially blue in full, while only the peninsula participates in subsequent Malayan campaign advances. Singapore advances separately in February. Optional suppression of old capture paint affects display only. No original route, date, or paint data is overwritten.

`geodesy.js` supplies the shared spherical interpolation used by marker playback and territory compilation. `territory.js` defines defaults, validation, eligibility, a stable regional projection, and integer cell/chunk keys. The origin and cell size scope cell identities; changing either regenerates the grid.

`territory-engine.js` compiles radius/cell entry intervals from dated badge routes, merges continuous visits, orders capture events, and reconstructs ownership. Its badge caches exclude marker size, visibility, effects, and group color because those cannot alter capture. Ownership snapshots share chunk maps through copy-on-write, are created every 10,000 events, and obey an estimated 32 MiB budget. Editing invalidates snapshots after the first changed event.

`territory.worker.js` serializes reconstruction, yields to process cancellation, and attaches generation/request identifiers to responses. Obsolete results are ignored. Cancellation forces a complete chunk response on the next successful seek, preventing lost incremental changes.

`territory-overlay.js` renders culled 64×64-cell chunks through a single WebGL canvas in an OverlayView, with a Canvas 2D fallback. Changed chunks rebuild their geometry and cardinal shared boundaries; other chunks reuse geometry and buffers. Frontline paths split at junctions and chunk boundaries. Existing paint, annotations, effects, and markers keep their ordering above territory.

`MapCanvas` integrates the layer across all viewers and exposes `whenTerritoryReady(timestamp)`. RenderApp awaits it during initialization, fixed-view seeks, and recorded-camera frames. The promise covers ownership, geometry, and completed drawing; the Node service preserves its existing export API and encoding pipeline.

## Capture semantics

Territory begins neutral. A badge captures once at its first authored stop, then on cell re-entry along its saved route. Stationary occupation never continuously recaptures. Visibility does not suppress route-driven capture. Naval/air formations require explicit non-land permission; equipment is excluded.

Use scenario UTC arithmetic independently of the viewer's timezone. Crossing events are rounded upward to milliseconds. Sort by timestamp, badge ID, route segment, and cell ID with locale-independent lexical ordering; apply in ascending order so the last event wins.

Projection and resource limits are configuration errors, not permission to clip results. They disable the incomplete territory presentation while leaving ordinary map editing available. See README and KNOWN_ISSUES for supported limits.
