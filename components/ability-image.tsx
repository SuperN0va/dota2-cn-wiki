const INNATE_ICON = '/assets/innate-ability.png';

export function AbilityImage({ src, alt, isInnate = false }: { src: string; alt: string; isInnate?: boolean }) {
  return (
    <img
      src={isInnate ? INNATE_ICON : src}
      alt={alt}
      className={isInnate ? 'is-innate-icon' : undefined}
    />
  );
}
