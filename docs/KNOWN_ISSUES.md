# Known limitations

- Historical land-area mode is a schematic campaign illustration. Intermediate boundaries interpolate dated localities; they do not claim exact wartime frontlines. Country coastlines are modern Natural Earth boundaries.
- Blue in historical area mode is the initial presentation color. Thailand red represents the agreement permitting Japanese passage, not annexation or uniform military occupation. The campaign's noon transition is a date-only display convention.
- The preset covers Malaya and Singapore. East Malaysia retains its initial color; the Borneo campaign is not modeled.
- The following grid, event, and projection limits apply to route-corridor mode, not historical land-area mode.

- Territory uses a regional spherical azimuthal equidistant grid. All capture coverage must remain within 3,000 km of the fixed origin. Tangential distances distort increasingly with distance from that origin; this is a visualization grid, not a survey product.
- The layer has no land/water classification. Naval and air capture is a geometric operation requiring explicit extra permission.
- Derived data is limited to 500,000 cells, 2,000,000 events, and an estimated 32 MiB ownership-snapshot cache. Large or wide corridors can hit these limits; larger cells and smaller radii reduce processing.
- Initial compilation can delay territory presentation and export readiness on large scenarios. Badge rendering remains on the main thread and does not wait for territory during interactive playback.
- Frontlines use unsmoothed grid boundaries, split at chunk boundaries and junctions. Shared ownership remains exact within the grid's geometric tolerance.
- Canvas 2D fallback is slower than WebGL for dense visible coverage. Graphics-context loss reports an error and requires reloading the viewer.
- Battle replay territory follows saved authored badge routes, not simulated combat movement, casualties, or battle events.
