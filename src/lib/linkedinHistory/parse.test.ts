import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalArticleUrl, mapUnipilePost, parseArticleHtml, pickIssueTopics, summarizeHistory } from "./parse";

const owner = { providerId: "ACo123", name: "Pamela Tracey Woodford" };
const me = { id: "ACo123", name: "Pamela Tracey Woodford", public_identifier: "theprofitcoach" };

function post(extra: Record<string, unknown>) {
  return {
    id: "7517903077266575362",
    social_id: "urn:li:ugcPost:1",
    share_url: "https://www.linkedin.com/posts/theprofitcoach_x?utm_source=a",
    parsed_datetime: "2026-10-19T11:02:49.505Z",
    text: "Hello",
    is_repost: false,
    author: me,
    attachments: [],
    impressions_counter: 49,
    reaction_counter: 3,
    comment_counter: 1,
    repost_counter: 0,
    ...extra,
  };
}

describe("mapUnipilePost", () => {
  it("maps the coach's own post and strips tracking from the link", () => {
    const out = mapUnipilePost(post({}), owner);
    assert.equal(out?.row.kind, "post");
    assert.equal(out?.row.share_url, "https://www.linkedin.com/posts/theprofitcoach_x");
    assert.equal(out?.row.impressions, 49);
    assert.equal(out?.article, null);
  });

  it("keeps group posts matched by name when the author id is missing", () => {
    const out = mapUnipilePost(post({ author: { name: "Pamela Tracey Woodford" } }), owner);
    assert.equal(out?.row.kind, "post");
  });

  it("skips posts someone else wrote", () => {
    assert.equal(mapUnipilePost(post({ author: { id: "other", name: "Someone Else" } }), owner), null);
  });

  it("marks reposts", () => {
    assert.equal(mapUnipilePost(post({ is_repost: true, author: { id: "x", name: "X" } }), owner)?.row.kind, "repost");
  });

  it("turns a share of the coach's own article into a newsletter post with its article", () => {
    const out = mapUnipilePost(
      post({
        article: {
          id: "7517893742091976704",
          title: "Your Weekly  Profit Power-Up",
          author: "Pamela Tracey Woodford",
          url: "https://www.linkedin.com/pulse/your-weekly-profit-power-up-pamela-tracey-woodford-qhdhe?trackingId=abc",
          published_at: "2026-10-19T10:25:43.826Z",
          excerpt: "Hi",
        },
      }),
      owner
    );
    assert.equal(out?.row.kind, "newsletter");
    assert.equal(out?.row.article_id, "7517893742091976704");
    assert.equal(out?.article?.url, "https://www.linkedin.com/pulse/your-weekly-profit-power-up-pamela-tracey-woodford-qhdhe");
    assert.equal(out?.article?.title, "Your Weekly Profit Power-Up");
  });

  it("leaves shared links to other people's articles as ordinary posts", () => {
    const out = mapUnipilePost(
      post({ article: { id: "1", title: "Forbes", author: "forbes.com", url: "https://forbes.com/x", published_at: "2026-01-01T00:00:00Z" } }),
      owner
    );
    assert.equal(out?.row.kind, "post");
    assert.equal(out?.article, null);
  });
});

describe("parseArticleHtml", () => {
  const html = `
    <meta property="og:title" content="Fallback title">
    <meta property="og:image" content="https://media.licdn.com/cover.jpg?e=2147483647&amp;v=beta">
    <h1 class="pulse-title text-display-md">Your Weekly Profit Power-Up
    </h1>
    <div data-test-id="article-content-blocks">
      <div class="article-main__content" data-test-id="publishing-text-block">
        <p><span class>Hi,</span><!----></p>
      </div>
      <h2 data-test-id="pulse-publishing-h1"><span class>5 Strategies &amp; more</span></h2>
      <div class="article-main__content" data-test-id="publishing-text-block"><h3><span class>1. Document it</span></h3></div>
      <div class="article-main__content" data-test-id="publishing-text-block"><p><span>Signs:<ul>
        <li><span class> The owner handles it</span></li>
        <li><span class> A process stays undocumented</span></li>
      </ul></span></p></div>
      <div data-test-id="publishing-image-block"><figure><img data-delayed-url="https://media.licdn.com/inline.jpg"></figure></div>
      <div class="inline-articles" data-nosnippet="true"><h2 class="text-xl">Recommended by LinkedIn</h2>
        <div><a href="https://www.linkedin.com/pulse/other"><div class="inline-article-title">Someone else's article</div></a></div></div>
      <div class="article-main__content" data-test-id="publishing-text-block"><ol><li>First</li><li>Second</li></ol></div>
      <div class="article-main__content" data-test-id="publishing-text-block"><p><span>I&#x2019;m done.</span></p></div>
    </div>
    </article>
    <a class="base-card__full-link" href="https://www.linkedin.com/newsletters/profit-patter-7029113740000165889" data-tracking-will-navigate>
      <span class="sr-only"> Profit Patter </span>
    </a>`;

  it("reads the title, cover and newsletter", () => {
    const out = parseArticleHtml(html);
    assert.equal(out.title, "Your Weekly Profit Power-Up");
    assert.equal(out.cover_url, "https://media.licdn.com/cover.jpg?e=2147483647&v=beta");
    assert.equal(out.newsletter_name, "Profit Patter");
    assert.equal(out.newsletter_url, "https://www.linkedin.com/newsletters/profit-patter-7029113740000165889");    assert.equal(out.topic, "5 Strategies & more");
  });

  it("keeps headings, paragraphs and both kinds of list, without images or LinkedIn's recommendations", () => {
    assert.deepEqual(parseArticleHtml(html).blocks, [
      { type: "paragraph", text: "Hi," },
      { type: "heading", text: "5 Strategies & more" },
      { type: "heading", text: "1. Document it" },
      { type: "paragraph", text: "Signs:" },
      { type: "bullets", items: ["The owner handles it", "A process stays undocumented"] },
      { type: "numbered", items: ["First", "Second"] },
      { type: "paragraph", text: "I’m done." },
    ]);
  });

  it("reads older articles that keep the whole piece in one content div", () => {
    const old = `<h1 class="pulse-title text-display-md">Is data your friend or foe?</h1>
      <article><div class="article-main__content max-w-[744px]"><p>Data killed off Kodak.&nbsp;Really.</p>
      <div class="inline-articles" data-nosnippet="true"><h2>Recommended by LinkedIn</h2><div><div>Other</div></div></div>
      <h2>Why it matters</h2><ul><li>One</li><li>Two</li></ul><p>See <a href="https://example.com">this</a>.</p></div>
      <div>Footer</div></article>`;
    assert.deepEqual(parseArticleHtml(old).blocks, [
      { type: "paragraph", text: "Data killed off Kodak. Really." },
      { type: "heading", text: "Why it matters" },
      { type: "bullets", items: ["One", "Two"] },
      { type: "paragraph", text: "See this." },
    ]);
  });

  it("returns no blocks for a page without an article body", () => {
    assert.deepEqual(parseArticleHtml("<html>Sign in</html>").blocks, []);
  });
});

describe("summarizeHistory", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

  it("counts recent posts and takes the median reach of posts with impressions", () => {
    const out = summarizeHistory(
      [
        { posted_at: daysAgo(2), impressions: 100, reactions: 4 },
        { posted_at: daysAgo(20), impressions: 300, reactions: 10 },
        { posted_at: daysAgo(60), impressions: 0, reactions: 1 },
        { posted_at: daysAgo(400), impressions: 0, reactions: 2 },
      ],
      [{ published_at: daysAgo(5) }, { published_at: daysAgo(120) }],
      now
    );
    assert.equal(out.total_posts, 4);
    assert.equal(out.posts_30d, 2);
    assert.equal(out.posts_90d, 3);
    assert.equal(out.last_post_days, 2);
    assert.equal(out.issues_90d, 1);
    assert.equal(out.last_issue_days, 5);
    assert.equal(out.median_impressions_90d, 200);
    assert.equal(out.median_reactions_90d, 4);
  });

  it("handles a coach with no history", () => {
    const out = summarizeHistory([], [], now);
    assert.equal(out.last_post_days, null);
    assert.equal(out.median_impressions_90d, null);
  });
});

describe("canonicalArticleUrl", () => {
  it("drops the query and trailing slash", () => {
    assert.equal(canonicalArticleUrl("https://www.linkedin.com/pulse/x/?trackingId=1"), "https://www.linkedin.com/pulse/x");
  });
});

describe("pickIssueTopics", () => {
  it("skips headings the coach reuses in most issues", () => {
    const template = "5 Practical Strategies to Improve Profit";
    const out = pickIssueTopics([
      { id: "a", title: "Weekly", topic: template, headings: [template, "The Hidden Cost of Rushing"] },
      { id: "b", title: "Weekly", topic: template, headings: [template, "Your 90-Day Priority"] },
      { id: "c", title: "Weekly", topic: template, headings: [template] },
      { id: "d", title: "A standalone piece", topic: null, headings: [] },
    ]);
    assert.equal(out.get("a"), "The Hidden Cost of Rushing");
    assert.equal(out.get("b"), "Your 90-Day Priority");
    assert.equal(out.get("c"), template);
    assert.equal(out.get("d"), "A standalone piece");
  });
});
