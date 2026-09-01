import assert from "node:assert/strict";

import { HappyScribeError } from "../src/lib/happyScribe/error";
import { durationLabelToSeconds } from "../src/lib/happyScribe/candidates";
import {
  happyScribeJsonExportPayload,
  happyScribeTranscriptionPayload,
  isValidHttpsMediaUrl,
} from "../src/lib/happyScribe/payload";
import { happyScribeExportToTranscript } from "../src/lib/happyScribe/transcript";

async function main() {
  assert.equal(durationLabelToSeconds("1h 4m"), 3840);
  assert.equal(durationLabelToSeconds("1:02:03"), 3723);
  assert.equal(durationLabelToSeconds("90"), 5400);
  assert.equal(durationLabelToSeconds("45s"), 45);
  assert.equal(isValidHttpsMediaUrl("https://cdn.example.com/video.mp4"), true);
  assert.equal(isValidHttpsMediaUrl("http://cdn.example.com/video.mp4"), false);
  assert.equal(isValidHttpsMediaUrl("https://user:pass@cdn.example.com/video.mp4"), false);

  assert.equal(
    happyScribeExportToTranscript([
      {
        data_start: 0,
        data_end: 1.2,
        words: [{ text: "Hello" }, { text: "world." }],
      },
      {
        data_start: 62.4,
        words: [{ text: "Next" }, { text: "step!" }],
      },
    ]),
    "[00:00:00] Hello world.\n[00:01:02] Next step!",
  );
  assert.equal(
    happyScribeExportToTranscript({
      paragraphs: [{ data_start: 3600, text: "One hour in." }],
    }),
    "[01:00:00] One hour in.",
  );
  assert.throws(
    () => happyScribeExportToTranscript({ paragraphs: [] }),
    (error: unknown) =>
      error instanceof Error &&
      (error as HappyScribeError).name === "HappyScribeError" &&
      (error as HappyScribeError).status === 502,
  );

  const transcriptionPayload = happyScribeTranscriptionPayload({
    organizationId: 123,
    name: "Lesson",
    language: "en",
    sourceUrl: "https://cdn.example.com/video.mp4",
    service: "auto",
    tag: "queue-item",
  });
  assert.equal((transcriptionPayload.transcription as Record<string, unknown>).service, "auto");
  assert.equal((transcriptionPayload.transcription as Record<string, unknown>).language, "en");
  assert.deepEqual(
    happyScribeJsonExportPayload("transcription-1"),
    { export: { format: "json", transcription_ids: ["transcription-1"] } },
  );
  const exportBody = happyScribeJsonExportPayload("transcription-1");
  assert.equal((exportBody.export as Record<string, unknown>).format, "json");
  console.log("Happy Scribe tests passed.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
