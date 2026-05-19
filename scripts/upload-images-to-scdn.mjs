import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiEndpoint = "https://img.scdn.io/api/upload.php";
const mappingPath = path.join(root, "src/lib/image-cdn-map.json");

const imageRefs = [
  "/assets/fuyukawa-kagari-bg.webp",
  "/assets/hero-wallpaper.webp",
  "/assets/legacy/404.jpg",
  "/assets/mini-pig-scroll.png",
  "/assets/pig-apple-touch.png",
  "/assets/pig-brand.png",
  "/assets/pig-favicon.png",
  "/assets/profile.jpg",
  "/blog-assets/astrbot-napcat-baota/01-cloud-firewall.webp",
  "/blog-assets/astrbot-napcat-baota/02-firewall-rule-fields.webp",
  "/blog-assets/astrbot-napcat-baota/03-baota-app-management.webp",
  "/blog-assets/astrbot-napcat-baota/04-install-docker-module.webp",
  "/blog-assets/astrbot-napcat-baota/05-search-astrbot.webp",
  "/blog-assets/astrbot-napcat-baota/06-astrbot-install-options.webp",
  "/blog-assets/astrbot-napcat-baota/07-astrbot-webui-log.webp",
  "/blog-assets/astrbot-napcat-baota/08-compose-ports.webp",
  "/blog-assets/astrbot-napcat-baota/09-baota-open-6185.webp",
  "/blog-assets/astrbot-napcat-baota/10-astrbot-url.webp",
  "/blog-assets/astrbot-napcat-baota/11-astrbot-welcome.webp",
  "/blog-assets/astrbot-napcat-baota/12-create-napcat-container.webp",
  "/blog-assets/astrbot-napcat-baota/13-napcat-token-log.webp",
  "/blog-assets/astrbot-napcat-baota/14-napcat-login.webp",
  "/blog-assets/astrbot-napcat-baota/15-napcat-dashboard.webp",
  "/blog-assets/astrbot-napcat-baota/16-astrbot-model-entry.webp",
  "/blog-assets/astrbot-napcat-baota/17-astrbot-provider-select.webp",
  "/blog-assets/astrbot-napcat-baota/18-deepseek-create-key.webp",
  "/blog-assets/astrbot-napcat-baota/19-deepseek-copy-key.webp",
  "/blog-assets/astrbot-napcat-baota/20-astrbot-api-key.webp",
  "/blog-assets/astrbot-napcat-baota/21-astrbot-model-list.webp",
  "/blog-assets/astrbot-napcat-baota/22-add-llm.webp",
  "/blog-assets/astrbot-napcat-baota/23-default-llm.webp",
  "/blog-assets/astrbot-napcat-baota/24-create-onebot-robot.webp",
  "/blog-assets/astrbot-napcat-baota/25-create-napcat-ws-client.webp",
  "/blog-assets/astrbot-napcat-baota/26-napcat-ws-client-settings.webp",
  "/blog-assets/astrbot-napcat-baota/27-astrbot-napcat-connected-log.webp",
  "/blog-assets/astrbot-napcat-baota/28-qq-bot-reply.webp",
  "/blog-assets/astrbot-napcat-baota/29-napcat-message-log.webp",
  "/blog-assets/astrbot-napcat-baota/30-astrbot-message-log.webp",
  "/blog-covers/cover-01.webp",
  "/blog-covers/cover-03.webp",
  "/blog-covers/cover-04.webp",
  "/blog-covers/cover-08.webp",
  "/blog-covers/cover-09.webp",
  "/blog-covers/cover-10.webp"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function localPath(ref) {
  return path.join(root, "public", ref.replace(/^\//, ""));
}

function extractUrl(responseJson) {
  const candidates = [
    responseJson?.data?.url,
    responseJson?.data?.links?.url,
    responseJson?.data?.links?.direct,
    responseJson?.data?.image?.url,
    responseJson?.url,
    responseJson?.image_url,
    responseJson?.src,
    responseJson?.data
  ];

  for (const value of candidates) {
    if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  }

  const serialized = JSON.stringify(responseJson);
  const match = serialized.match(/https?:\/\/[^"\\]+/);
  return match?.[0];
}

async function readExistingMap() {
  try {
    return JSON.parse(await readFile(mappingPath, "utf8"));
  } catch {
    return {};
  }
}

async function uploadImage(ref) {
  const filePath = localPath(ref);
  const buffer = await readFile(filePath);
  const form = new FormData();
  form.set("image", new File([buffer], path.basename(filePath)));
  form.set("cdn", "default");

  const response = await fetch(apiEndpoint, {
    method: "POST",
    body: form
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 300)}`);
  }

  const url = extractUrl(json);
  if (!response.ok || !url) {
    throw new Error(`Upload failed (${response.status}): ${JSON.stringify(json).slice(0, 500)}`);
  }

  return url;
}

await mkdir(path.dirname(mappingPath), { recursive: true });
const mapping = await readExistingMap();

for (const ref of imageRefs) {
  if (mapping[ref]) {
    console.log(`skip ${ref} -> ${mapping[ref]}`);
    continue;
  }

  console.log(`upload ${ref}`);
  mapping[ref] = await uploadImage(ref);
  await writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);
  console.log(`done ${ref} -> ${mapping[ref]}`);
  await sleep(1300);
}

console.log(`saved ${path.relative(root, mappingPath)}`);
