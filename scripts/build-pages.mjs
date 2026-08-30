import { cp, mkdir, rm } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const output = new URL("../dist/", import.meta.url);
const files = ["index.html", "styles.css", "favicon.svg", "_headers", "_routes.json"];
const directories = ["assets", "src"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  ...files.map((file) => cp(new URL(file, projectRoot), new URL(file, output))),
  ...directories.map((directory) => cp(
    new URL(`${directory}/`, projectRoot),
    new URL(`${directory}/`, output),
    { recursive: true },
  )),
]);

console.log("Ryku Hunt Cloudflare Pages assets built in dist/");
