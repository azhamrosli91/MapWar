# Malaya and Singapore campaign, 1941–1942

Import **`malaya-singapore-detailed-1941-42.json`** in Fieldmark for the expanded map. It has **42 flag badges, 8 symbol markers and 120 seconds of playback**. The earlier `malaya-singapore-1941-42.json` remains the simpler overview. Import replaces the current map; export a backup first if you want to preserve existing work. Press **Play** in the header, or use **Export video** to render an MP4.

The detailed file includes:

- Japanese 25th Army overview, 5th and 18th Infantry Divisions, Imperial Guards Division, 9th and 21st Infantry Brigades, and named infantry regiments with documented campaign sectors.
- British-Indian northern and eastern defence, the 11th Division, 6th, 15th, combined 6th/15th, 28th, 12th, 8th, 22nd and 45th Brigades, and selected Punjab, Frontier Force and Gurkha battalions.
- Australian 22nd and 27th Brigades, their six main infantry battalions, artillery and anti-tank formations, and separate company markers for Gemencheh Bridge and Endau.
- The British 18th Division and 53rd Brigade, Malay Regiment battalions, Force Z and a Japanese landing fleet marker.

`malaya-singapore-waypoints.csv` lists every moving stop with its scenario date/time, named locality and coordinates. The source link in each row supports the formation or key action. **These are representative localities, not verified coordinates for every unit at every hour.** Estate coordinates identify a present-day estate or memorial vicinity, not an exact 1942 firing position. Where a record gives only a date, the map uses 12:00 as a display convention. Motion between stops is a storyboard transition, not a straight-line march. A marker becoming hidden can mean that its **documented mapping window** ended; it does not necessarily mean the formation was destroyed. The 6th and 15th Indian Brigade markers hand over to the combined 6th/15th marker after reorganisation.

The supplied Australian flag appears on Australian badges. The supplied British India red ensign represents British-Indian formations for this illustration; it is not a specific unit battle flag. British formations use a generated Union flag. Japanese land formations use a generated national flag; the supplied rising-sun naval ensign is reserved for the landing-fleet badge. The reference photograph guides the style only. The Google background shows current geography, not a 1942 map.

## Principal historical sources

- [Australian War Memorial: Japanese order of battle and opening plan](https://s3-ap-southeast-2.amazonaws.com/awm-media/collection/RCDIG1070100/document/5519429.PDF) — 5th and 18th Divisions, Imperial Guards, infantry brigades and regiments, and the opening landing assignments.
- [Australian War Memorial: Invasion of Malaya](https://www.awm.gov.au/collection/E84717) — the landings, west/east advances, Gemas, Bakri, Jemaluang and Causeway withdrawal.
- [Australian War Memorial official history, Chapter 8](https://s3-ap-southeast-2.amazonaws.com/awm-media/collection/RCDIG1070101/document/5519430.PDF), [Chapter 9](https://s3-ap-southeast-2.amazonaws.com/awm-media/collection/RCDIG1070591/document/5519874.PDF) and [Chapter 10](https://s3-ap-southeast-2.amazonaws.com/awm-media/collection/RCDIG1070102/document/5519431.PDF) — Indian brigade and battalion deployments from Kota Bharu, Jitra and Gurun to Kampar and Slim River.
- [Australian War Memorial: 2/18th](https://www.awm.gov.au/collection/U56061), [2/19th](https://www.awm.gov.au/collection/U56062), [2/20th](https://www.awm.gov.au/collection/U56063), [2/26th](https://www.awm.gov.au/collection/U56069), [2/29th](https://www.awm.gov.au/collection/U56072) and [2/30th](https://www.awm.gov.au/collection/U56073) Australian battalion histories.
- [Australian War Memorial: Gemencheh Bridge](https://www.awm.gov.au/articles/blog/gemencheh-bridge), [2/10th Field Regiment](https://www.awm.gov.au/collection/U54400), [2/15th Field Regiment](https://www.awm.gov.au/collection/U54405), and [13th Battery at Bakri](https://www.awm.gov.au/collection/011300).
- [Singapore National Heritage Board: World War II Heritage Trail](https://www.nhb.gov.sg/~/media/nhb/files/places/trails/world%20war%20ii/wwii-text.pdf) — Japanese division landing sectors, Australian defences, Kranji and the Malay Regiment.
- [Australian War Memorial: Battle for Singapore](https://www.awm.gov.au/collection/E84308) — 8 February attack and 15 February surrender.

The map is a researched campaign illustration. The sources do not provide a reliable point-by-point track for every regiment and brigade on both sides, so additional formations are included only where the record supports a useful sector or action. Rebuild both JSON files and the waypoint CSV after editing the source with `node scenarios/build-malayan-campaign.mjs` from the project folder.
