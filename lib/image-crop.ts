export type CropPosition = { x: number; y: number; zoom: number };
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// One geometry calculation drives both the preview and exported pixels. The
// crop always stays inside the source, so dragging cannot reveal empty edges.
export function cropRectangle(width: number, height: number, aspect: number, crop: CropPosition) {
  const zoom = clamp(crop.zoom, 1, 4);
  const cropWidth = Math.min(width, height * aspect) / zoom;
  const cropHeight = cropWidth / aspect;
  return {
    x: (width - cropWidth) * clamp(crop.x),
    y: (height - cropHeight) * clamp(crop.y),
    width: cropWidth,
    height: cropHeight,
  };
}
