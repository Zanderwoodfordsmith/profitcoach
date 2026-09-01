export function isValidHttpsMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

export function happyScribeTranscriptionPayload(input: {
  organizationId: number;
  name: string;
  language: string;
  sourceUrl: string;
  service: "auto" | "pro";
  tag?: string;
}): Record<string, unknown> {
  const tags = input.tag?.trim() ? [input.tag.trim().slice(0, 100)] : undefined;
  return {
    transcription: {
      name: input.name,
      language: input.language,
      tmp_url: input.sourceUrl,
      is_subtitle: false,
      service: input.service,
      organization_id: String(input.organizationId),
      ...(tags ? { tags } : {}),
    },
  };
}

export function happyScribeJsonExportPayload(transcriptionId: string): Record<string, unknown> {
  return {
    export: {
      format: "json",
      transcription_ids: [transcriptionId],
    },
  };
}
