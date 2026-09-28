// Each chapter gets equal rail space, even when its document height differs.
export function getHomeChapterProgress(tops: readonly number[], scrollY: number) {
  if (tops.length < 2 || scrollY < tops[0] - 2) return null;
  let index = 0;
  while (index < tops.length - 1 && scrollY >= tops[index + 1] - 2) index++;
  const span = (tops[index + 1] ?? tops[index]) - tops[index];
  const local = span > 0 ? Math.max(0, Math.min(1, (scrollY - tops[index]) / span)) : 0;
  return { index, progress: (index + local) / (tops.length - 1) };
}
