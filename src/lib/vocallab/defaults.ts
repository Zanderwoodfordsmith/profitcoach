const DEFAULT_MODEL = "v-pro";

export function getVocallabConfig() {
  const apiKey = process.env.VOCALLAB_API_KEY?.trim();
  const model = process.env.VOCALLAB_MODEL?.trim() || DEFAULT_MODEL;

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model,
  };
}
