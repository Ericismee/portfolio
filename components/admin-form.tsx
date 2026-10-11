'use client';
import { localizedError } from '../lib/i18n';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLanguage } from './language';
import { ImageFramePicker } from './image-frame-picker';
import { RichTextEditor } from './rich-text-editor';
import { GithubProjectPicker } from './github-project-picker';
import { applyGithubFields, applyGithubPostFields } from '../lib/github-project-fields';
import { MarkdownEditor } from './markdown-editor';
import { uploadMime } from '../lib/upload-client';
import { CvDocument } from './cv-document';
export type Field = {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'textarea'
    | 'richtext'
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
  rows?: number;
};
export type Values = Record<string, string | boolean>;
export type Editor = {
  githubUsername?: string;
  title: string;
  fields?: Field[];
  values?: Values;
  body?: ReactNode;
  renderBody?: (onDirty: (dirty: boolean) => void) => ReactNode;
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
  formId,
  githubUsername,
}: {
  fields: Field[];
  initial: Values;
  submit: (values: Values) => Promise<void>;
  csrf: string;
  onDirty?: (dirty: boolean) => void;
  footer?: boolean;
  submitLabel?: string;
  formId?: string;
  githubUsername?: string;
}) {
  const { t, language } = useLanguage(),
    [values, setValues] = useState<Values>(initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(0),
    [pendingCrops, setPendingCrops] = useState<Set<string>>(new Set());
  const dirty = pendingCrops.size > 0 || JSON.stringify(values) !== JSON.stringify(initial);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  async function upload(key: string, file: File, done?: (url: string) => void) {
    setUploading((n) => n + 1);
    setError('');
    try {
      const mime = await uploadMime(file);
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': mime, 'x-csrf-token': csrf },
        body: file,
        signal: AbortSignal.timeout(60000),
      });
      const result = (await response.json()) as { url: string; error?: string };
      if (!response.ok) throw Error(result.error);
      if (done) done(result.url);
      else
        setValues((v) => ({
          ...v,
          [key]: result.url,
          ...(key === 'thumbnail' ? { imageFrame: 'original' } : {}),
          ...(mime === 'application/pdf' ? { [key + 'Name']: file.name.slice(0, 200) } : {}),
        }));
      return true;
    } catch (e) {
      setError(
        e instanceof TypeError ||
          (e instanceof Error && ['TimeoutError', 'AbortError'].includes(e.name))
          ? t(
              'Kết nối tải file bị gián đoạn. Dữ liệu biểu mẫu vẫn được giữ; hãy chọn lại file để thử lại.',
              'Upload connection interrupted. Your form is preserved; select the file again to retry.',
            )
          : e instanceof Error
            ? e.message
            : t('Không tải được file', 'Unable to upload'),
      );
      return false;
    } finally {
      setUploading((n) => n - 1);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || uploading || pendingCrops.size) return;
    setBusy(true);
    setError('');
    try {
      // Native date controls and browser autofill can update the displayed
      // value before React receives a change event. Save the form as displayed.
      const formData = new FormData(e.currentTarget);
      const next = { ...values };
      for (const field of fields) {
        if (field.type === 'image' || field.type === 'pdf') continue;
        next[field.key] =
          field.type === 'checkbox'
            ? formData.has(field.key)
            : String(formData.get(field.key) ?? values[field.key] ?? '');
      }
      await submit(next);
      onDirty?.(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Không thể lưu', 'Unable to save'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form id={formId} onSubmit={save} className="admin-form">
      {githubUsername && (
        <GithubProjectPicker
          kind={fields.some((f) => f.key === 'richText') ? 'posts' : 'projects'}
          username={githubUsername}
          disabled={busy || uploading > 0}
          apply={(incoming, replace) =>
            setValues((current) =>
              fields.some((f) => f.key === 'richText')
                ? applyGithubPostFields(current, incoming, replace)
                : applyGithubFields(current, incoming, replace),
            )
          }
        />
      )}
      {fields.map((field) => {
        const value = values[field.key] ?? '',
          update = (value: string | boolean) =>
            setValues((prev) => ({ ...prev, [field.key]: value }));
        if (field.type === 'richtext')
          return (
            <div key={field.key}>
              <h3>{field.label}</h3>
              <div className="content-format-switch">
                <label>
                  {t('Cách soạn nội dung', 'Content format')}
                  <select
                    name="bodyFormat"
                    value={String(values.bodyFormat || 'rich')}
                    onChange={(e) => setValues((v) => ({ ...v, bodyFormat: e.target.value }))}
                  >
                    <option value="rich">{t('Soạn trực quan', 'Visual editor')}</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </label>
              </div>
              {values.bodyFormat === 'markdown' ? (
                <MarkdownEditor
                  value={String(values.markdown || '')}
                  base={String(values.markdownBase || '')}
                  change={(markdown) => setValues((v) => ({ ...v, markdown }))}
                />
              ) : (
                <RichTextEditor
                  name={field.key}
                  label={field.label}
                  value={String(value)}
                  change={update}
                  upload={(file, done) => upload(field.key, file, done)}
                />
              )}
            </div>
          );
        if (field.type === 'image')
          return (
            <div key={field.key}>
              <h3 className="image-field-title">{field.label}</h3>
              <ImageFramePicker
                name={field.key}
                label={field.label}
                value={String(value)}
                busy={busy || uploading > 0}
                upload={(file) => upload(field.key, file)}
                change={update}
                onEditingChange={(editing) =>
                  setPendingCrops((previous) => {
                    const next = new Set(previous);
                    if (editing) next.add(field.key);
                    else next.delete(field.key);
                    return next;
                  })
                }
              />
            </div>
          );
        return (
          <div
            key={field.key}
            className={
              ['textarea', 'pdf'].includes(field.type || '') ||
              ['name', 'title'].includes(field.key)
                ? 'field-wide'
                : 'field-compact'
            }
          >
            <label className={field.type === 'checkbox' ? 'check' : ''}>
              {field.type !== 'checkbox' && field.label}
              {field.type === 'textarea' ? (
                <textarea
                  rows={field.rows || 6}
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
              ) : field.type === 'pdf' ? (
                <>
                  <input
                    type="file"
                    name={field.key + '-upload'}
                    accept=".pdf,application/pdf"
                    disabled={busy || uploading > 0}
                    onChange={(e) => {
                      if (e.target.files?.[0]) void upload(field.key, e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                  <small className="admin-help">{t('PDF tối đa 20 MB', 'PDF up to 20 MB')}</small>
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
                  onInput={
                    field.type === 'datetime-local'
                      ? (e) => update(e.currentTarget.value)
                      : undefined
                  }
                />
              )}
              {field.help && <small className="admin-help">{field.help}</small>}
            </label>
            {field.type === 'pdf' && value && (
              <CvDocument
                url={String(value)}
                name={String(values[field.key + 'Name'] || 'CV.pdf')}
              />
            )}
            {['image', 'pdf'].includes(field.type || '') && value && (
              <button type="button" className="btn neutral" onClick={() => update('')}>
                {t('Gỡ file', 'Remove file')}
              </button>
            )}
          </div>
        );
      })}
      <p className="form-error" role="alert">
        {localizedError(error, language)}
      </p>
      {footer && (
        <div className="actions">
          <button
            type="submit"
            className="btn primary"
            disabled={busy || uploading > 0 || pendingCrops.size > 0}
          >
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
    [discarding, setDiscarding] = useState(false),
    lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    // Cancel the native close synchronously. A React state update alone cannot
    // prevent every browser from closing its dialog after an Escape key release.
    const preventNativeClose = (event: Event) => event.preventDefault();
    dialog?.addEventListener('cancel', preventNativeClose);
    lastFocus.current = document.activeElement as HTMLElement;
    ref.current?.showModal();
    const firstField = ref.current?.querySelector<HTMLElement>(
      'input:not([type=file]),textarea,select',
    );
    (firstField || ref.current?.querySelector<HTMLElement>('button'))?.focus();
    return () => {
      dialog?.removeEventListener('cancel', preventNativeClose);
      if (lastFocus.current?.isConnected) lastFocus.current.focus();
      else document.querySelector<HTMLButtonElement>('[aria-controls="site-menu"]')?.focus();
    };
  }, []);
  useEffect(() => {
    if (discarding) ref.current?.querySelector<HTMLButtonElement>('[role=alert] button')?.focus();
  }, [discarding]);
  const requestClose = () => {
    if (dirty) setDiscarding(true);
    else close();
  };
  return (
    <dialog
      className="content-editor"
      ref={ref}
      aria-labelledby="editor-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          requestClose();
          return;
        }
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
        {discarding && (
          <div className="admin-intro" role="alert">
            <strong>{t('Bạn có thay đổi chưa lưu.', 'You have unsaved changes.')}</strong>
            <p>
              {t(
                'Tiếp tục chỉnh sửa hoặc bỏ thay đổi để đóng biểu mẫu.',
                'Continue editing, or discard your changes to close the form.',
              )}
            </p>
            <div className="actions">
              <button
                className="btn neutral"
                type="button"
                onClick={() => {
                  setDiscarding(false);
                  ref.current
                    ?.querySelector<HTMLElement>('input:not([type=file]),textarea,select')
                    ?.focus();
                }}
              >
                {t('Tiếp tục chỉnh sửa', 'Continue editing')}
              </button>
              <button className="btn danger" type="button" onClick={close}>
                {t('Bỏ thay đổi', 'Discard changes')}
              </button>
            </div>
          </div>
        )}
        {editor.body}
        {editor.renderBody?.(setDirty)}
        {editor.submit && (
          <FieldsForm
            formId="editor-content-form"
            githubUsername={editor.githubUsername}
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
        <div className="actions">
          <button className="btn neutral" type="button" onClick={requestClose}>
            {t('Đóng', 'Close')}
          </button>
          {editor.submit && (
            <button className="btn primary" type="submit" form="editor-content-form">
              {editor.submitLabel || t('Lưu', 'Save')}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
