const coverFocus: Record<string, string> = {
  "/blog-covers/cover-08.webp": "50% 30%"
};

export function getCoverStyle(cover: string | null | undefined) {
  const focus = coverFocus[cover ?? ""];
  return focus ? `--cover-focus: ${focus};` : undefined;
}
