// Only these reviewed originals and superseded candidates are excluded.
// Files remain untouched in public; no glob-based unused-file deletion.
export const excludedPublicMedia = [
  ...[
    "cover-01.png", "cover-02.jpg", "cover-03.png", "cover-04.png", "cover-05.png",
    "cover-06.jpg", "cover-07.jpg", "cover-08.jpg", "cover-09.png", "cover-10.jpg"
  ].map(name => `blog-covers/${name}`),
  ...["ayano-middle", "sharon-back", "shu-middle", "kisara-front"].flatMap(name => [
    `${name}-v2.png`, `${name}-v2.webp`, `${name}.webp`,
    ...[1, 2, 3, 4, 5].map(version => `${name}-generated-v${version}.webp`)
  ]).map(name => `themes/kisara/assets/blog/${name}`),
  ...["engage-kiss-layers-v2-qa.png", "engage-kiss-layers-v2-qa.webp", "engage-kiss-group-final.webp"]
    .map(name => `themes/kisara/assets/blog/${name}`),
  "themes/kisara/assets/fridge-opening-002.mp4"
];
