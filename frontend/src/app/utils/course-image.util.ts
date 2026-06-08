/** URLs e srcset adaptativos para imagens de capa dos cursos (cards). */

export const COURSE_CARD_WIDTHS = [320, 480, 640, 800, 1200] as const;

/** sizes para grid 1 col (mobile) → 2 (lg) → 3 (xl). */
export const COURSE_CARD_IMAGE_SIZES =
  '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 400px';

export const COURSE_THUMB_IMAGE_SIZES = '(max-width: 640px) 100vw, 320px';

const PLACEHOLDER_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
      <rect width="640" height="360" fill="#1a1a1b"/>
      <path d="M320 140l48 40h-96l48-40zm-80 100h160v20H240v-20z" fill="#d4af37" opacity="0.35"/>
    </svg>`,
  );

export function courseImagePlaceholder(): string {
  return PLACEHOLDER_SVG;
}

export function resolveCourseImageUrl(url: string | null | undefined): string | null {
  const clean = (url ?? '').trim();
  if (!clean) return null;
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
    return clean;
  }
  if (clean.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${clean}`;
  }
  return clean;
}

/** Desativado: este app usa FastAPI + SPA; /_vercel/image devolve HTML, não imagem. */
function useVercelImageOptimizer(): boolean {
  return false;
}

export function buildVercelOptimizedUrl(sourceUrl: string, width: number, quality = 75): string {
  return `/_vercel/image?url=${encodeURIComponent(sourceUrl)}&w=${width}&q=${quality}`;
}

export function buildCourseImageSrc(
  url: string | null | undefined,
  defaultWidth: number = 640,
): string {
  const resolved = resolveCourseImageUrl(url);
  if (!resolved) return courseImagePlaceholder();
  if (!useVercelImageOptimizer()) return resolved;
  return buildVercelOptimizedUrl(resolved, defaultWidth);
}

export function buildCourseImageSrcSet(
  url: string | null | undefined,
  widths: readonly number[] = COURSE_CARD_WIDTHS,
): string | null {
  const resolved = resolveCourseImageUrl(url);
  if (!resolved) return null;
  if (!useVercelImageOptimizer()) {
    return `${resolved} ${widths[widths.length - 1]}w`;
  }
  return widths.map((w) => `${buildVercelOptimizedUrl(resolved, w)} ${w}w`).join(', ');
}
