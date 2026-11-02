import { build } from "esbuild";
import { writeFile, readFile, readdir } from "node:fs/promises";
const files = (await readdir("src/effects")).filter(
  (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
);
const plugins = [];
for (const file of files) {
  if (/export default\s/.test(await readFile("src/effects/" + file, "utf8")))
    plugins.push(file);
}
await writeFile(
  "src/effects/registry.generated.ts",
  plugins
    .map(
      (file, i) => `import effect${i} from './${file.replace(/\.ts$/, "")}';`,
    )
    .join("\n") +
    "\nexport const extensions = [" +
    plugins.map((_, i) => `effect${i}`).join(",") +
    "];\n",
);
const result = await build({
  entryPoints: ["src/standalone.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2022",
  minify: true,
  define: { "import.meta.url": '"standalone.html"' },
});
await writeFile("src/standalone.generated.txt", result.outputFiles[0].text);
