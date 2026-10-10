'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { clamp, cropRectangle, type CropPosition } from '../lib/image-crop';
import { useLanguage } from './language';
import { Icon } from './icon';

type Source = { image: HTMLImageElement; url: string; owned: boolean };
// Already cropped uploads can exactly fit the frame. A small initial zoom gives
// repositioning room on both axes without permitting blank edges.
const centered: CropPosition = { x: 0.5, y: 0.5, zoom: 1.1 };

export function ImageFramePicker({
  name,
  label,
  value,
  busy,
  upload,
  change,
  onEditingChange,
}: {
  name: string;
  label: string;
  value: string;
  busy: boolean;
  upload: (file: File) => Promise<boolean>;
  change: (url: string) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const { t } = useLanguage();
  const [source, setSource] = useState<Source | null>(null);
  const [crop, setCrop] = useState<CropPosition>(centered);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const drag = useRef<{ x: number; y: number; crop: CropPosition } | null>(null);
  const sourceRef = useRef<Source | null>(null);
  const loadSequence = useRef(0);
  const avatar = name === 'avatar';
  const aspect = avatar ? 1 : name === 'cover' ? 4 : 16 / 9;
  useEffect(() => {
    if (!source || !frame.current) return;
    const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [source]);
  useEffect(
    () => () => {
      loadSequence.current++;
      if (sourceRef.current?.owned) URL.revokeObjectURL(sourceRef.current.url);
    },
    [],
  );

  function close() {
    loadSequence.current++;
    if (sourceRef.current?.owned) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = null;
    setSource(null);
    setLoading(false);
    onEditingChange(false);
  }
  async function select(file?: File) {
    setError('');
    if (
      file &&
      (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
        file.size > 3 * 1024 * 1024)
    ) {
      setError(
        t(
          'Chọn ảnh PNG, JPG, WebP hoặc GIF tối đa 3 MB.',
          'Choose a PNG, JPG, WebP or GIF up to 3 MB.',
        ),
      );
      return;
    }
    const sequence = ++loadSequence.current;
    const url = file ? URL.createObjectURL(file) : value;
    if (!url) return;
    setLoading(true);
    onEditingChange(true);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    try {
      await image.decode();
      if (sequence !== loadSequence.current) {
        if (file) URL.revokeObjectURL(url);
        return;
      }
      if (sourceRef.current?.owned) URL.revokeObjectURL(sourceRef.current.url);
      const next = { image, url, owned: !!file };
      sourceRef.current = next;
      setSource(next);
      setCrop(centered);
    } catch {
      if (file) URL.revokeObjectURL(url);
      if (sequence === loadSequence.current) {
        setError(
          t(
            'Không đọc được ảnh. Hãy chọn file ảnh trên thiết bị.',
            'Unable to read this image. Choose an image from your device.',
          ),
        );
        if (!sourceRef.current) onEditingChange(false);
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }
  const rectangle = source
    ? cropRectangle(source.image.naturalWidth, source.image.naturalHeight, aspect, crop)
    : null;
  const scale = rectangle ? frameWidth / rectangle.width : 1;
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !source || !rectangle || busy) return;
    const extraX = source.image.naturalWidth * scale - frameWidth;
    const extraY = source.image.naturalHeight * scale - frameWidth / aspect;
    setCrop({
      ...drag.current.crop,
      x: extraX > 0 ? clamp(drag.current.crop.x - (event.clientX - drag.current.x) / extraX) : 0.5,
      y: extraY > 0 ? clamp(drag.current.crop.y - (event.clientY - drag.current.y) / extraY) : 0.5,
    });
  }
  async function commit() {
    if (!source || !rectangle || busy) return;
    setError('');
    setLoading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = avatar ? 800 : 1600;
      canvas.height = Math.round(canvas.width / aspect);
      const context = canvas.getContext('2d');
      if (!context) throw Error('Canvas unavailable');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        source.image,
        rectangle.x,
        rectangle.y,
        rectangle.width,
        rectangle.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(Error('Unable to export image'))),
          'image/jpeg',
          0.9,
        ),
      );
      if (await upload(new File([blob], name + '.jpg', { type: 'image/jpeg' }))) close();
    } catch {
      setError(
        t(
          'Không thể lưu khung ảnh. Thử tải ảnh từ thiết bị lên lại.',
          'Unable to save this crop. Try choosing an image from your device.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="image-frame-picker">
      {!source && value && (
        <img className={'frame-current ' + (avatar ? 'is-avatar' : '')} src={value} alt={label} />
      )}
      <label className="image-upload-label">
        {t('Chọn ảnh từ thiết bị', 'Choose an image from your device')}
        <input
          name={name + '-upload'}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={busy || loading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void select(file);
            event.target.value = '';
          }}
        />
      </label>
      {!source && value && (
        <div className="actions">
          <button
            className="btn neutral"
            type="button"
            onClick={() => void select()}
            disabled={busy || loading}
          >
            {t('Chỉnh khung ảnh', 'Adjust framing')}
          </button>
          <button
            className="btn neutral"
            type="button"
            onClick={() => change('')}
            disabled={busy || loading}
          >
            {t('Gỡ ảnh', 'Remove image')}
          </button>
        </div>
      )}
      {source && rectangle && (
        <div className="frame-workspace">
          <p id={'frame-help-' + name} className="admin-help">
            {t(
              'Kéo ảnh trong lưới để căn vị trí. Phóng to để có thêm khoảng kéo; dùng phím mũi tên để chỉnh chính xác.',
              'Drag within the grid to position. Zoom in for more room; use arrow keys for precise adjustments.',
            )}
          </p>
          <div
            ref={frame}
            className={'crop-frame ' + (avatar ? 'is-avatar' : '')}
            style={{ aspectRatio: aspect }}
            role="group"
            tabIndex={0}
            aria-label={t('Vùng chọn khung ảnh', 'Image framing area')}
            aria-describedby={'frame-help-' + name}
            onPointerDown={(event) => {
              if (busy || loading) return;
              event.preventDefault();
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY, crop };
            }}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
            onKeyDown={(event) => {
              if (
                busy ||
                loading ||
                !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
              )
                return;
              event.preventDefault();
              const step = event.shiftKey ? 0.1 : 0.02;
              setCrop((c) => ({
                ...c,
                x: clamp(
                  c.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
                ),
                y: clamp(
                  c.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
                ),
              }));
            }}
          >
            <img
              src={source.url}
              alt={label}
              draggable={false}
              style={{
                width: source.image.naturalWidth * scale,
                height: source.image.naturalHeight * scale,
                left: -rectangle.x * scale,
                top: -rectangle.y * scale,
              }}
            />
            <div className="crop-grid-guide" aria-hidden="true" />
            {avatar && <div className="crop-circle-guide" aria-hidden="true" />}
          </div>
          <label className="crop-zoom">
            <Icon name="search" />
            {t('Phóng to', 'Zoom')}
            <input
              name={name + '-zoom'}
              aria-label={t('Phóng to ảnh', 'Image zoom')}
              type="range"
              min="1"
              max="4"
              step="0.01"
              value={crop.zoom}
              disabled={busy || loading}
              onChange={(event) => setCrop((c) => ({ ...c, zoom: Number(event.target.value) }))}
            />
            <output>{crop.zoom.toFixed(1)}×</output>
          </label>
          <div className="crop-position-controls">
            {(['x', 'y'] as const).map((axis) => (
              <label className="crop-zoom" key={axis}>
                {axis === 'x'
                  ? t('Vị trí ngang', 'Horizontal position')
                  : t('Vị trí dọc', 'Vertical position')}
                <input
                  type="range"
                  name={name + '-position-' + axis}
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(crop[axis] * 100)}
                  disabled={busy || loading}
                  onChange={(event) =>
                    setCrop((c) => ({ ...c, [axis]: Number(event.target.value) / 100 }))
                  }
                />
                <output>{Math.round(crop[axis] * 100)}%</output>
              </label>
            ))}
          </div>
          <div className="actions">
            <button
              className="btn primary"
              type="button"
              disabled={busy || loading}
              onClick={() => void commit()}
            >
              {busy || loading
                ? t('Đang xử lý…', 'Processing…')
                : t('Dùng khung ảnh này', 'Use this framing')}
            </button>
            <button
              className="btn neutral"
              type="button"
              disabled={busy || loading}
              onClick={() => setCrop(centered)}
            >
              {t('Đặt lại', 'Reset')}
            </button>
            <button
              className="btn neutral"
              type="button"
              disabled={busy || loading}
              onClick={() => setCrop({ x: 0.5, y: 0.5, zoom: 1 })}
            >
              {t('Thu về 1×', 'Zoom out to 1×')}
            </button>
            <button
              className="btn neutral"
              type="button"
              disabled={busy || loading}
              onClick={close}
            >
              {t('Hủy', 'Cancel')}
            </button>
          </div>
        </div>
      )}
      {loading && <p role="status">{t('Đang xử lý ảnh…', 'Processing image…')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <small className="admin-help">
        {t(
          'Ảnh tối đa 3 MB. Chọn khung → dùng khung → lưu để công khai. Muốn lấy lại vùng đã cắt, hãy chọn ảnh gốc. GIF được lưu thành ảnh tĩnh.',
          'Images up to 3 MB. Frame → apply → save to publish. Choose the original image to recover previously cropped areas. GIF is saved as a still image.',
        )}
      </small>
    </div>
  );
}
