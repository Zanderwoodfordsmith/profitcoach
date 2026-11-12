import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emailHtmlToText, stripEmailQuotedReply } from "./ingestEmailReply";

describe("emailHtmlToText", () => {
  it("keeps only the new words of an HTML-only Apple Mail reply (SUP-0610)", () => {
    const html =
      '<html class="apple-mail-supports-explicit-dark-mode"><head><meta http-equiv="content-type" content="text/html; charset=utf-8"></head><body dir="auto"><div dir="ltr"></div><div dir="ltr">Many thanks Zander</div><div dir="ltr"><br></div><div dir="ltr">Best</div><div dir="ltr">Andrew.&nbsp;</div><div dir="ltr"><br><blockquote type="cite">On 6 Nov 2026, at 13:53, Profit Coach Support &lt;support@businesscoachacademy.com&gt; wrote:<br><br></blockquote></div><blockquote type="cite"><div dir="ltr"><p>Hi Andrew,</p></div></blockquote></body></html>';
    assert.equal(stripEmailQuotedReply(emailHtmlToText(html)), "Many thanks Zander\n\nBest\nAndrew.");
  });

  it("cuts a Gmail quote and decodes entities", () => {
    const html = '<div dir="ltr">Fish &amp; chips? Yes &#39;please&#39;</div><br><div class="gmail_quote">On Mon wrote: old</div>';
    assert.equal(emailHtmlToText(html), "Fish & chips? Yes 'please'");
  });

  it("leaves plain text alone", () => {
    assert.equal(emailHtmlToText("Thanks <3\nBob"), "Thanks <3\nBob");
  });
});
