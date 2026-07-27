# Body Model Sources

## Current State

The BodyViz demo currently uses a **procedural capsule-based body** built from
Three.js primitives. No external GLB model is required to run the demo.

## Planned GLB Models

When a production-quality anatomical model is needed, the following sources
are recommended:

### Open-Source / CC-0

- **Quaternius** — https://quaternius.com/ — CC-0 rigged characters
- **Kay Lousberg** — https://kaylousberg.com/ — Game-ready character packs
- **Mixamo** — https://www.mixamo.com/ — Auto-rigged characters (Adobe account required, free for use)

### Anatomical-Specific

- **BodyParts3D** — https://lifesciencedb.jp/bp3d/ — CC-BY-SA anatomical models from DBCLS
- **Z-Anatomy** — https://www.z-anatomy.com/ — Open-source interactive anatomy (GPL)

### Requirements for BodyViz Integration

1. **Format**: `.glb` (Draco-compressed preferred)
2. **Named nodes**: Body regions must be named to match `regionSystemMap` in
   `@bodyviz/tokens` — e.g., `brain`, `heart`, `torso`, `arms`, `legs`
3. **License**: Must be compatible with PPD commercial use (CC-0, CC-BY, or
   properly attributed)
4. **Polycount**: Target < 50k tris for smooth WebGL performance on mobile
5. **Rig**: Optional — only needed if posing/animation is desired

### Adding a Model

1. Place `.glb` file in `assets/models/`
2. Update `BodyTwin` component to load via `useGLTF` from `@react-three/drei`
3. Map named nodes to `regionSystemMap` for spotlight highlighting
4. Run `pnpm --filter @bodyviz/gallery dev` to verify in Ladle
