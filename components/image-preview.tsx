'use client';
import { FileDocument } from './file-document';
import { useLanguage } from './language';
import { responsiveImage } from '../lib/image-variants';

export function ImagePreview({
  src,
  alt = '',
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <FileDocument
      url={src}
      name={alt || t('Ảnh', 'Image')}
      image
      showDownload={false}
      triggerClassName="media-preview-trigger"
      trigger={
        <img
          {...responsiveImage(src)}
          className={className}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
      }
    />
  );
}
