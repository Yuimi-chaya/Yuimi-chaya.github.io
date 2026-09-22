import { readFile, writeFile } from "node:fs/promises";
import { blogLettering } from "../src/themes/kisara/data/blogLettering.ts";

const unique = blogLettering.filter((letter, index, list) =>
  list.findIndex(item => item.character === letter.character) === index);
const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${unique.map(letter =>
  `<path id="${letter.character === "." ? "dot" : letter.character}" d="${letter.outline}"/>`
).join("")}</defs></svg>\n`;
const output = new URL("../public/themes/kisara/assets/blog/trace-glyphs.svg", import.meta.url);
const existing = await readFile(output, "utf8").catch(error => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (existing !== null && existing !== svg) throw new Error("Existing lettering differs; create a new version instead.");
if (existing === null) await writeFile(output, svg, { flag: "wx" });
console.log(`Lettering sprite: ${Buffer.byteLength(svg)} bytes`);
