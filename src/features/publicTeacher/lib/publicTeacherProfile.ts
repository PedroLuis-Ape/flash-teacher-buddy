export function isMissingDirectoryRpc(error: unknown) {
  const value = error as { code?: string; message?: string; details?: string } | null;
  const text = `${value?.message ?? ''} ${value?.details ?? ''}`.toLowerCase();

  return value?.code === 'PGRST202'
    || value?.code === '42883'
    || text.includes('get_public_teacher_');
}

export function shouldUsePreviewFallback(input: {
  error: unknown;
  slug: string;
  previewSlug: string;
  isDevelopment: boolean;
}) {
  return input.isDevelopment
    && isMissingDirectoryRpc(input.error)
    && input.slug.toLowerCase() === input.previewSlug.toLowerCase();
}
