export const imageWidths = [96, 160, 320, 640, 960, 1440, 1920, 2560] as const;
export function responsiveImage(src: string, sizes = '(max-width: 600px) 100vw, 640px') {
  if (!/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(src)) return { src };
  return {
    src: src + '?w=640',
    srcSet: imageWidths.map((width) => `${src}?w=${width} ${width}w`).join(', '),
    sizes,
  };
}
