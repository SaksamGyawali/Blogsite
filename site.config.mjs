// Everything about your site lives here. Edit this first.
export default {
  title: 'Saksham Gyawali',
  tagline: 'Notes on software, systems, and things I am figuring out.',

  // Heading on the home page. The wordmark up top already carries your name,
  // so this names the section instead of repeating it.
  indexHeading: 'Writing',

  // Used for RSS + sitemap absolute URLs. No trailing slash.
  // Must match the domain the site is actually served from, or the feed and
  // sitemap will point somewhere else. Vercel gives you a <project>.vercel.app
  // address; swap in a custom domain here once you attach one.
  url: 'https://sakshamgyawaliblogsite.vercel.app',

  author: 'Saksham Gyawali',
  email: '',
  language: 'en',

  // Links in the header. `href` is relative to the site root.
  nav: [
    { label: 'Posts', href: '/' },
    { label: 'About', href: '/about/' },
    { label: 'Tags', href: '/tags/' },
  ],

  // Links in the footer.
  social: [
    { label: 'GitHub', href: 'https://github.com/SaksamGyawali' },
    { label: 'RSS', href: '/feed.xml' },
  ],

  // Words per minute used for the "N min read" estimate.
  wordsPerMinute: 200,
};
