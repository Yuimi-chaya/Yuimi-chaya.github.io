import { getCollection, type CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export async function getPublishedPosts() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.sort((a, b) => {
    const dateA = (a.data.updatedDate ?? a.data.pubDate).valueOf();
    const dateB = (b.data.updatedDate ?? b.data.pubDate).valueOf();
    return dateB - dateA;
  });
}

export async function getPublishedPostPaths() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post }
  }));
}

