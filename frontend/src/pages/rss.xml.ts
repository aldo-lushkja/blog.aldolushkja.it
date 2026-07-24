import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts, postUrl } from '@/utils/posts';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({
    title: 'Aldo Lushkja — Blog',
    description: 'Notes on software engineering, cloud infrastructure, and the rest of the IT world.',
    site: context.site ?? 'https://blog.aldolushkja.it',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postUrl(post),
      categories: post.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}
