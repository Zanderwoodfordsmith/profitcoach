import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSupportReplyEmailHtml,
  supportReplyEmailSubject,
} from "./notifyCoachOfReply";

describe("supportReplyEmailSubject", () => {
  it("includes the ticket number so a reply can be matched", () => {
    assert.equal(
      supportReplyEmailSubject("Incompetence, confusion & ineptitude", 510),
      "RE: Incompetence, confusion & ineptitude (SUP-0510)"
    );
  });

  it("does not stack Re: or a second ticket tag", () => {
    assert.equal(
      supportReplyEmailSubject("RE: Calendar (SUP-0445)", 445),
      "RE: Calendar (SUP-0445)"
    );
  });
});

describe("buildSupportReplyEmailHtml", () => {
  it("uses the staff reply as the email body with a name signature", () => {
    const html = buildSupportReplyEmailHtml({
      replyBody:
        "Hi Andy, Sorry for the delay in replying. We are still using the same link https://businesscoachacademy.com/calls",
      signatureName: "Zander",
      supportUrl: "https://app.profitcoach.com/coach/support",
    });

    assert.match(html, /Hi Andy, Sorry for the delay in replying/);
    assert.match(html, />Zander</);
    assert.match(
      html,
      /You can reply to this email or <a href="https:\/\/app\.profitcoach\.com\/coach\/support"/
    );
    assert.match(html, /open Support in the app/);
    assert.doesNotMatch(html, /Book a support call/);
    assert.doesNotMatch(html, /replied to your request/);
    assert.doesNotMatch(html, /Profit Coach Support/);
    assert.doesNotMatch(html, /<blockquote/);
  });

  it("escapes HTML in the reply and falls back when there is no signature", () => {
    const html = buildSupportReplyEmailHtml({
      replyBody: 'See <script>alert("x")</script>',
      signatureName: null,
      supportUrl: "https://example.com/coach/support",
    });

    assert.match(html, /See &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
    assert.match(html, />Profit Coach Support</);
    assert.doesNotMatch(html, /<script>/);
  });
});
