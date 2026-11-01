# Bundled finish photos

Photo-based maps for the Naturi finishes that ship with the app (every designer and client sees
them). Until a finish has an entry here, the app uses the photo a designer imported on their own
device, or the procedural texture.

## Adding a finish

1. In the app, open **Finish → Import sample photo** and process a photo of the physical sample
   (even, diffuse light; camera square-on; measure the width of the area in frame).
2. Click **Download maps**. You get `<id>-albedo.jpg`, `<id>-normal.jpg`, `<id>-roughness.jpg`
   and `<id>-manifest-entry.json`.
3. Put the three images in `public/materials/finishes/<id>/` as `albedo.jpg`, `normal.jpg`,
   `roughness.jpg`, and merge the manifest entry into `manifest.json` under `"finishes"`.

```json
{
  "finishes": {
    "caraibi": {
      "albedo": "finishes/caraibi/albedo.jpg",
      "normal": "finishes/caraibi/normal.jpg",
      "roughness": "finishes/caraibi/roughness.jpg",
      "tileSize": 0.3,
      "source": "Bunch Outdoor Services sample photo, 2026"
    }
  }
}
```

Finish ids: `caraibi`, `maldive`, `panama`, `rosa-corallo`, `hawai`, `tbc-6` … `tbc-10`.
Use only photos you own or have permission to use.
