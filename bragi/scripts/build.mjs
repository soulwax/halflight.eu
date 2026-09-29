import { build } from "esbuild";
import { copyFile, chmod } from "node:fs/promises";
await build({
  entryPoints: ["src/companion/browser.ts"],
  outfile: "dist/companion/browser.js",
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
});
await copyFile("src/companion/index.html", "dist/companion/index.html");
await chmod("dist/cli.js", 0o755);
