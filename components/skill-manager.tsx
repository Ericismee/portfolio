'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from './language';
import { localizedError } from '../lib/i18n';
import { normalizedName } from '../lib/content-management';
import { Icon } from './icon';
export function SkillManager({
  skills,
  hidden,
  save,
  onDirty,
}: {
  skills: string[];
  hidden: string[];
  save: (skills: string[], hidden: string[]) => Promise<void>;
  onDirty?: (dirty: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const [items, setItems] = useState(skills),
    [hiddenItems, setHiddenItems] = useState(hidden),
    [editing, setEditing] = useState<string | null>(null),
    [value, setValue] = useState(''),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    onDirty?.(value.trim() !== (editing || ''));
  }, [value, editing, onDirty]);
  async function commit(next: string[], hiddenNext: string[]) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await save(next, hiddenNext);
      setItems(next);
      setHiddenItems(hiddenNext);
      setValue('');
      setEditing(null);
      setNotice(t('Đã lưu kỹ năng.', 'Skills saved.'));
    } catch (error) {
      setError(
        localizedError(error instanceof Error ? error.message : 'Unable to connect', language),
      );
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    setNotice('');
    setError('');
    const name = value.trim();
    if (!name) {
      setError(t('Nhập tên kỹ năng.', 'Enter a skill name.'));
      return;
    }
    if (items.some((item) => item !== editing && normalizedName(item) === normalizedName(name))) {
      setError(t('Kỹ năng đã tồn tại.', 'This skill already exists.'));
      return;
    }
    void commit(
      editing ? items.map((item) => (item === editing ? name : item)) : [...items, name],
      hiddenItems.map((item) => (item === editing ? name : item)),
    );
  }
  return (
    <div className="resource-manager">
      <p className="admin-help">
        {t(
          'Thêm và quản lý riêng từng kỹ năng. Kỹ năng ẩn chỉ hiển thị cho quản trị viên.',
          'Add and manage each skill. Hidden skills are visible only to administrators.',
        )}
      </p>
      <div className="resource-add">
        <label>
          {editing ? t('Sửa kỹ năng', 'Edit skill') : t('Thêm kỹ năng', 'Add skill')}
          <input
            value={value}
            maxLength={100}
            disabled={busy}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                apply();
              }
            }}
          />
        </label>
        <button type="button" className="btn primary" disabled={busy} onClick={apply}>
          {editing ? t('Lưu', 'Save') : t('Thêm', 'Add')}
        </button>
        {(editing || value) && (
          <button
            type="button"
            className="btn neutral"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setValue('');
              setError('');
              setNotice('');
            }}
          >
            {t('Hủy', 'Cancel')}
          </button>
        )}
      </div>
      <label>
        {t('Tìm kỹ năng', 'Search skills')}
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <p className="muted">
        {items.length} {t('kỹ năng đã thêm', 'skills added')}
      </p>
      <div className="inline-entry-list">
        {items
          .filter((item) => normalizedName(item).includes(normalizedName(query)))
          .map((item) => (
            <div
              className="inline-entry-row"
              data-publication={hiddenItems.includes(item) ? 'hidden' : 'public'}
              key={item}
            >
              <div>
                <strong>{item}</strong>
                <small>
                  {hiddenItems.includes(item) ? t('Đã ẩn', 'Hidden') : t('Công khai', 'Public')}
                </small>
              </div>
              <div className="inline-section-actions">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={busy || value.trim() !== (editing || '')}
                  aria-label={t('Sửa ', 'Edit ') + item}
                  title={t('Sửa', 'Edit')}
                  onClick={() => {
                    setEditing(item);
                    setValue(item);
                  }}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={busy || value.trim() !== (editing || '')}
                  aria-label={
                    (hiddenItems.includes(item) ? t('Hiện ', 'Show ') : t('Ẩn ', 'Hide ')) + item
                  }
                  title={hiddenItems.includes(item) ? t('Hiện', 'Show') : t('Ẩn', 'Hide')}
                  onClick={() =>
                    void commit(
                      items,
                      hiddenItems.includes(item)
                        ? hiddenItems.filter((v) => v !== item)
                        : [...hiddenItems, item],
                    )
                  }
                >
                  <Icon name={hiddenItems.includes(item) ? 'eye' : 'lock'} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  disabled={busy || value.trim() !== (editing || '')}
                  aria-label={t('Xóa ', 'Delete ') + item}
                  title={t('Xóa', 'Delete')}
                  onClick={() =>
                    void commit(
                      items.filter((v) => v !== item),
                      hiddenItems.filter((v) => v !== item),
                    )
                  }
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
