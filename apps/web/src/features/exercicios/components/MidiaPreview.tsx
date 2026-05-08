import { ImageIcon } from 'lucide-react';
import { TIPO_MIDIA, type TipoMidia } from '@amfit/shared';

type Props = {
  url?: string | null;
  tipo?: TipoMidia | null;
  alt: string;
  className?: string;
  controls?: boolean;
};

export function MidiaPreview({
  url,
  tipo,
  alt,
  className,
  controls = false,
}: Props) {
  const baseClasses =
    'flex h-full w-full items-center justify-center bg-[--color-bg-muted] text-[--color-text-muted]';
  const wrapperClasses = className ?? baseClasses;

  if (!url || !tipo) {
    return (
      <div className={wrapperClasses} role="img" aria-label={`${alt} sem mídia`}>
        <ImageIcon aria-hidden="true" className="h-8 w-8" />
      </div>
    );
  }

  if (tipo === TIPO_MIDIA.VIDEO) {
    return (
      <video
        src={url}
        className={className ?? 'h-full w-full object-cover'}
        controls={controls}
        muted
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    );
  }

  // GIF e IMAGEM renderizam como <img>
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className ?? 'h-full w-full object-cover'}
    />
  );
}
