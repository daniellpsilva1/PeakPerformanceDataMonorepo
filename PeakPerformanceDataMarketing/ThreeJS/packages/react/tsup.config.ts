import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  shims: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    "react",
    "react-dom",
    "three",
    "@react-three/fiber",
    "@react-three/drei",
  ],
});
