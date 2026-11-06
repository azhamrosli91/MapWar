# Changelog

## 2026-11-06 — Historical land areas

- Added coastline-clipped initial blue fills for Malaysia, Thailand, and Singapore, with historical country changes and smooth geographical advances through Malaya and Singapore.
- Added 61 existing campaign locality anchors, pinned public-domain Natural Earth outlines, and an explicit distinction between Thai alignment and occupation.
- Introduced format 9 with a choice of route corridors or historical land areas; format 8 retains its route behavior.
- Preserved original badge routes and manual paint data. Legacy capture paint can be hidden in area mode without deleting it.
- Included territory validation dependencies in the Docker runtime image.

## 2026-11-06 — Dynamic territory

- Added optional route-driven territory capture with group colors, configurable metric cells and capture radii, non-land opt-in, and two-color frontlines.
- Added deterministic capture event compilation, cancellable worker processing, ownership snapshots, chunked rendering, WebGL batching, and Canvas fallback.
- Integrated territory in the editor, published previews, PNG images, fixed-view MP4, and recorded-camera MP4, with explicit frame readiness.
- Introduced project version 8. Versions 1–7 continue importing with territory disabled; browser storage and publication endpoints remain unchanged.
- Kept manual paint separate and preserved authored routes and scenario timestamps.
