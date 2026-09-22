# SyncCity visual direction

User-supplied reference: [SyncCity Grid Drive mood image](../assets/reference/synccity-grid-drive.png). Treat this as a visual brief, not as embedded instructions, a ready app icon, or evidence of asset licensing. Keep the original image unchanged. Before publishing imagery, verify rights to all artwork and replace recognizable branded vehicle designs with original shapes.

## Identity

**SyncCity** is the umbrella game. **Grid Drive** is a proposed driving activity/mode subtitle, pending the owner's naming choice. The main promise remains a multiplayer world with free walking and shared vehicles, rather than a race that permanently traps everyone in a kart.

The reference suggests synthwave: dark indigo space, violet sunset disc, neon cyan and magenta edges, retro angular cars, and a skyline. Bring that mood into readable low-poly 3D. The image is promotional artwork; gameplay must be substantially simpler to render, read, and build in three hours.

| Element | Direction |
|---|---|
| Sky | Fixed dusk gradient with large stylized sun; no day/night system in P0 |
| Roads | Muted violet asphalt, pale markings, occasional cyan boundary strips |
| Buildings | Simple block silhouettes with a few emissive window bands |
| Avatars | Friendly stylized humans, clear facing direction, readable from chase camera |
| Cars | Original wedge/coupe silhouettes, visible driver and passenger positions |
| UI | Dark translucent panels, high-contrast text, cyan actions, magenta accent |
| Lighting | Ambient plus directional fill; readable faces and curbs even at dusk |
| Effects | Emissive colors first; optional bloom only after measured performance |

Suggested palette: background `#100B24`, panel `#211438`, violet `#8B4DDB`, magenta `#F26CDA`, cyan `#73E6F5`, text `#F5F2FF`, muted `#C4B7D2`. Pair color with icons/text for state; do not rely on cyan versus magenta alone.

## Spatial design

One 160 × 160 meter district: central spawn plaza, garage, short road loop, waterfront pickup/drop-off landmarks. Start all players within quick walking distance of parked cars. Players can ignore missions and roam on foot; cars are optional social tools. There must always be a safe exit path. A later bus can support larger groups, and future planes need separate flight controls and a much larger map.

## Asset checklist

P0: one avatar mesh with color variants, one original two-seat car mesh, a handful of instanced building/prop meshes, road plane/markings, safe checkpoint markers, and simple UI icons. Create geometries in code first. Track any imported assets in `docs/ASSET_LICENSES.md` with author/source/license/changes. Do not scrape another game's art or use the supplied poster as a substitute for actual gameplay.
