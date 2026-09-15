import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bodyHasBroadcastMention,
  broadcastMentionNotifiesViewer,
  broadcastMentionTarget,
  buildMentionTarget,
  communityMentionNotificationTitle,
  extractBroadcastMentionGroups,
  extractMentionUserIds,
  mentionNotificationBodyOrFilter,
  parseMentionTarget,
  splitMentionSegments,
} from "./communityMentions";
import { communityPostCardPreview } from "./communityPostMarkdown";

describe("broadcast mention tokens", () => {
  const everyoneBody = "Hello [@everyone](mention:group:everyone) today";
  const coachesBody = "Hey [@Profit Coaches](mention:group:coaches)";
  const personBody =
    "Hi [@Pam](mention:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)";

  it("parses group targets", () => {
    assert.deepEqual(parseMentionTarget("group:everyone"), {
      type: "group",
      group: "everyone",
    });
    assert.deepEqual(parseMentionTarget("group:coaches"), {
      type: "group",
      group: "coaches",
    });
    assert.deepEqual(parseMentionTarget("group:profit-coaches"), {
      type: "group",
      group: "coaches",
    });
    assert.equal(buildMentionTarget({ type: "group", group: "everyone" }), "group:everyone");
    assert.equal(broadcastMentionTarget("coaches"), "group:coaches");
  });

  it("does not treat broadcasts as member ids", () => {
    assert.deepEqual(extractMentionUserIds(everyoneBody), []);
    assert.deepEqual(extractMentionUserIds(coachesBody), []);
    assert.deepEqual(extractMentionUserIds(personBody), [
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    ]);
  });

  it("extracts broadcast groups and splits segments", () => {
    assert.deepEqual(extractBroadcastMentionGroups(everyoneBody), ["everyone"]);
    assert.deepEqual(extractBroadcastMentionGroups(coachesBody), ["coaches"]);
    assert.equal(bodyHasBroadcastMention(personBody), false);

    const segs = splitMentionSegments(everyoneBody);
    const mention = segs.find((s) => s.kind === "mention");
    assert.equal(mention?.mentionType, "group");
    assert.equal(mention && "group" in mention ? mention.group : null, "everyone");
  });

  it("only notifies members who joined before the broadcast", () => {
    const at = "2026-09-01T00:00:00.000Z";
    assert.equal(broadcastMentionNotifiesViewer(everyoneBody, at, null), true);
    assert.equal(
      broadcastMentionNotifiesViewer(everyoneBody, at, "2026-08-01T00:00:00.000Z"),
      true
    );
    assert.equal(
      broadcastMentionNotifiesViewer(everyoneBody, at, "2026-10-01T00:00:00.000Z"),
      false
    );
    assert.equal(broadcastMentionNotifiesViewer(personBody, at, null), false);
  });

  it("builds inbox titles and preview text", () => {
    assert.equal(
      communityMentionNotificationTitle("Pam", "post", false, ["everyone"]),
      "Pam mentioned everyone in a post"
    );
    assert.equal(
      communityMentionNotificationTitle("Pam", "comment", false, ["coaches"]),
      "Pam mentioned Profit Coaches in a comment"
    );
    assert.equal(
      communityMentionNotificationTitle("Pam", "post", true, ["everyone"]),
      "Pam mentioned you in a post"
    );
    assert.equal(
      communityPostCardPreview(everyoneBody),
      "Hello @everyone today"
    );
    assert.equal(
      communityPostCardPreview(coachesBody),
      "Hey @Profit Coaches"
    );
  });

  it("includes broadcast needles in the notification or-filter", () => {
    const filter = mentionNotificationBodyOrFilter(["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]);
    assert.match(filter, /mention:group:everyone/);
    assert.match(filter, /mention:group:coaches/);
    assert.match(filter, /aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/);
  });
});
