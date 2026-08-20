export const VOICE_LANGUAGE_OPTIONS = [
  { value: "en-GB", label: "British English" },
  { value: "en-US", label: "American English" },
  { value: "auto", label: "Auto-detect" },
] as const;

export type VoiceLanguageCode =
  (typeof VOICE_LANGUAGE_OPTIONS)[number]["value"];

export function isVoiceLanguageCode(value: string): value is VoiceLanguageCode {
  return VOICE_LANGUAGE_OPTIONS.some((option) => option.value === value);
}

export function buildVoiceCloneScript(input: {
  fullName: string;
  location: string;
}): string {
  const fullName = input.fullName.trim() || "your full name";
  const location = input.location.trim() || "your location";

  return [
    `Hey, my name is ${fullName}. I am a Business coach from ${location} and I'm recording this sample to see how well the AI captures my natural cadence.`,
    `Honestly, I wasn't sure it would work at first...do you think it sounds just like me?`,
    `From quick everyday greetings to reading long numbers like 4,892 or technical words, every little detail helps the model learn.`,
    `The quick brown fox jumps over the lazy dog.`,
    `Type in the chat what do you think...`,
  ].join(" ");
}
