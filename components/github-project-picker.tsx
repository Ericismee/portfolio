'use client';
import { useState } from 'react';
import { request } from '../lib/client';
import type { GithubSkills } from '../lib/github-skills';
import type { GithubProject } from '../lib/github-project';
import { useLanguage } from './language';

export function GithubProjectPicker({
  username,
  apply,
  disabled,
}: {
  username: string;
  apply: (fields: Record<string, string>, replace: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const [repos, setRepos] = useState<GithubSkills['repos'] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState<GithubProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const [notice, setNotice] = useState('');
  const labels: Record<string, string> = {
    name: t('Tên dự án', 'Project name'),
    description: t('Mô tả', 'Description'),
    tech: t('Công nghệ chính', 'Primary technology'),
    technologies: t('Công nghệ', 'Technologies'),
    github: 'GitHub',
    source: t('Nguồn', 'Source'),
    demo: 'Demo',
    details: t('Trích README', 'README excerpt'),
    role: t('Vai trò', 'Role'),
  };
  async function load(detail = false) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (detail) {
        const result = await request<GithubProject>(
          '/api/admin/github-project?username=' +
            encodeURIComponent(username) +
            '&repo=' +
            encodeURIComponent(selected),
        );
        const role =
          result.ownership === 'owner'
            ? t('Chủ kho mã trên GitHub', 'GitHub repository owner')
            : result.ownership === 'fork-owner'
              ? t('Chủ bản fork trên GitHub', 'GitHub fork owner')
              : '';
        setPreview({ ...result, fields: { ...result.fields, role } });
      } else {
        const result = await request<GithubSkills>(
          '/api/admin/github?username=' + encodeURIComponent(username),
        );
        if (result.status === 'unavailable')
          throw Error(
            t('Chưa tải được GitHub. Hãy thử lại.', 'GitHub is unavailable. Please retry.'),
          );
        setRepos(result.repos);
        if (!result.repos.length)
          setNotice(t('Tài khoản chưa có kho mã công khai.', 'No public repositories found.'));
        else if (result.partial)
          setNotice(
            t(
              'Đã tải một phần danh sách kho mã.',
              'Only part of the repository list is available.',
            ),
          );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t('Không tải được GitHub.', 'Unable to load GitHub.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="github-project-picker"
      aria-label={t('Nhập dự án từ GitHub', 'Import project from GitHub')}
    >
      <div className="github-import-heading">
        <div>
          <h3>{t('Điền nhanh từ GitHub', 'Fill from GitHub')}</h3>
          <p>
            @{username} ·{' '}
            {t(
              'Chọn kho mã, xem thông tin rồi đưa vào biểu mẫu.',
              'Select a repository, review its information, then apply it to the form.',
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn neutral"
          disabled={disabled || busy}
          onClick={() => void load()}
        >
          {busy ? t('Đang đọc…', 'Loading…') : t('Tải kho mã', 'Load repositories')}
        </button>
      </div>
      {repos !== null && repos.length > 0 && (
        <>
          <label>
            {t('Tìm kho mã', 'Search repositories')}
            <input
              type="search"
              value={query}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Nhập tên kho mã…', 'Repository name…')}
            />
          </label>
          <div className="github-import-select">
            <label>
              {t('Kho mã GitHub', 'GitHub repository')}
              <select
                value={selected}
                disabled={busy}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setPreview(null);
                  setError('');
                  setNotice('');
                }}
              >
                <option value="">{t('Chọn kho mã…', 'Select repository…')}</option>
                {repos
                  .filter(
                    (repo) =>
                      repo.name === selected ||
                      repo.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((repo) => (
                    <option key={repo.name} value={repo.name}>
                      {repo.name}
                      {repo.language ? ' · ' + repo.language : ''}
                      {repo.fork ? ' · Fork' : ''}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="btn"
              disabled={!selected || busy || disabled}
              onClick={() => void load(true)}
            >
              {t('Đọc thông tin', 'Read information')}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {preview && (
        <div className="github-import-preview">
          <h4>{t('Thông tin từ kho mã', 'Repository information')}</h4>
          <dl>
            {Object.entries(preview.fields)
              .filter(([, v]) => v)
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{labels[key]}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          <p className="muted">
            {t(
              'Vai trò chỉ phản ánh chủ kho mã, không xác nhận đóng góp cá nhân. Trích README là thông tin của dự án; bạn có thể chỉnh lại trước khi lưu.',
              'Role indicates repository ownership, not personal contributions. The README describes the project; review and edit before saving.',
            )}
            {preview.partial &&
              ' ' + t('Một số thông tin chưa đọc được.', 'Some information could not be loaded.')}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            {t('Thay cả các trường đã có nội dung', 'Replace existing fields too')}
          </label>
          <button
            type="button"
            className="btn primary"
            disabled={busy || disabled}
            onClick={() => {
              apply(preview.fields, replace);
              setNotice(
                t(
                  'Đã điền vào biểu mẫu. Kiểm tra rồi nhấn Lưu để tạo hoặc cập nhật dự án.',
                  'Form filled. Review and Save to create or update the project.',
                ),
              );
            }}
          >
            {t('Đưa vào biểu mẫu', 'Apply to form')}
          </button>
        </div>
      )}
    </section>
  );
}
