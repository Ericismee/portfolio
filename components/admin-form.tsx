'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLanguage } from './language';
export type Field = {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'textarea'
    | 'url'
    | 'email'
    | 'password'
    | 'color'
    | 'select'
    | 'checkbox'
    | 'datetime-local'
    | 'image'
    | 'pdf';
  required?: boolean;
  options?: [string, string][];
  help?: string;
};
export type Values = Record<string, string | boolean>;
export type Editor = {
  title: string;
  fields?: Field[];
  values?: Values;
  body?: ReactNode;
  submit?: (values: Values) => Promise<void>;
  submitLabel?: string;
};
export function FieldsForm({
  fields,
  initial,
  submit,
  csrf,
  onDirty,
  footer = true,
  submitLabel,
}: {
  fields: Field[];
  initial: Values;
  submit: (values: Values) => Promise<void>;
  csrf: string;
  onDirty?: (dirty: boolean) => void;
  footer?: boolean;
  submitLabel?: string;
}) {
  const { t } = useLanguage(),
    [values, setValues] = useState<Values>(initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(0);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  async function upload(key: string, file: File) {
    setUploading((n) => n + 1);
    setError('');
    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'x-csrf-token': csrf },
        body: file,
      });
      const result = (await response.json()) as { url: string; error?: string };
      if (!response.ok) throw Error(result.error);
      setValues((v) => ({ ...v, [key]: result.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Không tải được file', 'Unable to upload'));
    } finally {
      setUploading((n) => n - 1);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || uploading) return;
    setBusy(true);
    setError('');
    try {
      await submit(values);
      onDirty?.(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Không thể lưu', 'Unable to save'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="admin-form">
      {fields.map((field) => {
        const value = values[field.key] ?? '',
          update = (value: string | boolean) =>
            setValues((prev) => ({ ...prev, [field.key]: value }));
        return (
          <div key={field.key}>
            <label className={field.type === 'checkbox' ? 'check' : ''}>
              {field.type !== 'checkbox' && field.label}
              {field.type === 'textarea' ? (
                <textarea
                  name={field.key}
                  value={String(value)}
                  required={field.required}
                  onChange={(e) => update(e.target.value)}
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.key}
                  value={String(value)}
                  onChange={(e) => update(e.target.value)}
                >
                  {field.options?.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <>
                  <input
                    name={field.key}
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => update(e.target.checked)}
                  />
                  {field.label}
                </>
              ) : ['image', 'pdf'].includes(field.type || '') ? (
                <>
                  {value && field.type === 'image' && (
                    <img className="admin-asset" src={String(value)} alt={field.label} />
                  )}
                  <input
                    type="file"
                    name={field.key + '-upload'}
                    accept={
                      field.type === 'pdf'
                        ? 'application/pdf'
                        : 'image/png,image/jpeg,image/webp,image/gif'
                    }
                    disabled={busy || uploading > 0}
                    onChange={(e) => {
                      if (e.target.files?.[0]) void upload(field.key, e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                  <small className="admin-help">
                    {field.type === 'pdf'
                      ? t('PDF tối đa 2 MB', 'PDF up to 2 MB')
                      : t('PNG, JPG, WebP, GIF tối đa 3 MB', 'PNG, JPG, WebP, GIF up to 3 MB')}
                  </small>
                </>
              ) : (
                <input
                  name={field.key}
                  type={field.type || 'text'}
                  value={String(value)}
                  required={field.required}
                  autoComplete={
                    field.type === 'password'
                      ? 'current-password'
                      : field.key === 'username'
                        ? 'username'
                        : undefined
                  }
                  onChange={(e) => update(e.target.value)}
                />
              )}
              {field.help && <small className="admin-help">{field.help}</small>}
            </label>
            {['image', 'pdf'].includes(field.type || '') && value && (
              <button type="button" className="btn neutral" onClick={() => update('')}>
                {t('Gỡ file', 'Remove file')}
              </button>
            )}
          </div>
        );
      })}
      <p className="form-error" role="alert">
        {error}
      </p>
      {footer && (
        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy || uploading > 0}>
            {uploading
              ? t('Đang tải file…', 'Uploading…')
              : busy
                ? t('Đang lưu…', 'Saving…')
                : submitLabel || t('Lưu', 'Save')}
          </button>
          <span className="admin-help">
            {dirty && onDirty ? t('Có thay đổi chưa lưu', 'Unsaved changes') : ''}
          </span>
        </div>
      )}
    </form>
  );
}
export function EditorDialog({
  editor,
  close,
  csrf,
}: {
  editor: Editor;
  close: () => void;
  csrf: string;
}) {
  const { t } = useLanguage(),
    ref = useRef<HTMLDialogElement>(null),
    [dirty, setDirty] = useState(false),
    lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    lastFocus.current = document.activeElement as HTMLElement;
    ref.current?.showModal();
    const firstField = ref.current?.querySelector<HTMLElement>(
      'input:not([type=file]),textarea,select',
    );
    (firstField || ref.current?.querySelector<HTMLElement>('button'))?.focus();
    return () => {
      lastFocus.current?.focus();
    };
  }, []);
  const requestClose = () => {
    if (!dirty || confirm(t('Bỏ các thay đổi chưa lưu?', 'Discard unsaved changes?'))) close();
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby="editor-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        // Keep keyboard focus within the editor, including browsers that move
        // focus to their address bar at the end of a native dialog's tab order.
        const controls = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
          ) || [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
    >
      <div className="editor-head">
        <h2 id="editor-title">{editor.title}</h2>
        <button
          className="btn neutral"
          type="button"
          onClick={requestClose}
          aria-label={t('Đóng', 'Close')}
        >
          ×
        </button>
      </div>
      <div className="editor-fields">
        {editor.body}
        {editor.submit && (
          <FieldsForm
            fields={editor.fields || []}
            initial={editor.values || {}}
            csrf={csrf}
            onDirty={setDirty}
            submitLabel={editor.submitLabel}
            submit={async (values) => {
              await editor.submit!(values);
              close();
            }}
          />
        )}
      </div>
      <div className="editor-foot">
        <span className="admin-help">
          {t('Khu vực quản trị riêng tư', 'Private administration')}
        </span>
        <button className="btn neutral" type="button" onClick={requestClose}>
          {t('Đóng', 'Close')}
        </button>
      </div>
    </dialog>
  );
}
