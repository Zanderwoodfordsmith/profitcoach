/** Default TTS model. UI selection can come later (v-studio / v-flash / v-lite). */
export const VOCALLAB_MODEL = "v-pro";

export function getVocallabConfig() {
  const apiKey = process.env.VOCALLAB_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model: VOCALLAB_MODEL,
  };
}
