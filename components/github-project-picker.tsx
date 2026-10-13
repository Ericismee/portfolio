'use client';
import { repositoryIdentity } from '../lib/content-management';
import { localizedError } from '../lib/i18n';
import { useId, useState } from 'react';
import { request } from '../lib/client';
import type { GithubSkills } from '../lib/github-skills';
import type { GithubProject } from '../lib/github-project';
import { useLanguage } from './language';
import { GithubConnection } from './github-connection';
import { MarkdownContent } from './markdown-content';
import { Icon } from './icon';
import { searchRepositories } from '../lib/repository-search';

export function GithubProjectPicker({
  username,
  apply,
  disabled,
  kind = 'projects',
  knownRepositories = [],
}: {
  username: string;
  apply: (fields: Record<string, string>, replace: boolean) => void;
  disabled: boolean;
  kind?: 'projects' | 'posts';
  knownRepositories?: string[];
}) {
  const { t, language } = useLanguage();
  const [repos, setRepos] = useState<
    (GithubSkills['repos'][number] & { fullName?: string; private?: boolean })[] | null
  >(null);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState<GithubProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const [notice, setNotice] = useState('');
  const choiceName = useId();
  const known = new Set(knownRepositories.map(repositoryIdentity));
  const matches = searchRepositories(repos || [], query, visibility);
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
        const [owner, repo] = selected.includes('/') ? selected.split('/') : [username, selected];
        const result = await request<GithubProject>(
          '/api/admin/github-project?username=' +
            encodeURIComponent(owner) +
            '&repo=' +
            encodeURIComponent(repo),
        );
        const role =
          result.ownership === 'owner'
            ? t('Chủ kho mã trên GitHub', 'GitHub repository owner')
            : result.ownership === 'fork-owner'
              ? t('Chủ bản fork trên GitHub', 'GitHub fork owner')
              : '';
        setPreview({ ...result, fields: { ...result.fields, role } });
      } else {
        setSelected('');
        setPreview(null);
        const connection = await request<{ connected: boolean }>('/api/admin/github-connection');
        if (connection.connected) {
          const result = await request<{
            repos: (GithubSkills['repos'][number] & { fullName: string; private: boolean })[];
            partial: boolean;
          }>('/api/admin/github-repositories');
          setRepos(result.repos);
          if (!result.repos.length)
            setNotice(
              t(
                'Không có kho mã được cấp quyền. Kiểm tra quyền của token.',
                'No authorized repositories. Check token permissions.',
              ),
            );
          else if (result.partial)
            setNotice(t('Đã tải 1.000 kho mã đầu tiên.', 'Loaded the first 1,000 repositories.'));
          return;
        }
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
      aria-label={
        kind === 'posts'
          ? t('Nhập bài viết từ GitHub', 'Import post from GitHub')
          : t('Nhập dự án từ GitHub', 'Import project from GitHub')
      }
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
      <GithubConnection
        onChange={() => {
          setRepos(null);
          setSelected('');
          setPreview(null);
          setError('');
          void load();
        }}
      />
      {repos !== null && repos.length > 0 && (
        <>
          <label>
            {t('Tìm kho mã', 'Search repositories')}
            <input
              type="search"
              value={query}
              disabled={busy || disabled}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                'Tìm theo tên, chủ kho mã hoặc công nghệ…',
                'Search name, owner or technology…',
              )}
            />
          </label>
          <div
            className="repo-visibility-tabs"
            aria-label={t('Quyền riêng tư kho mã', 'Repository visibility')}
          >
            {(['all', 'public', 'private'] as const).map((value) => (
              <button
                type="button"
                key={value}
                disabled={busy || disabled}
                aria-pressed={visibility === value}
                onClick={() => {
                  setVisibility(value);
                  setSelected('');
                  setPreview(null);
                }}
              >
                {
                  {
                    all: t('Tất cả', 'All'),
                    public: t('Công khai', 'Public'),
                    private: t('Riêng tư', 'Private'),
                  }[value]
                }{' '}
                <span>
                  {
                    repos.filter(
                      (repo) => value === 'all' || (value === 'private') === !!repo.private,
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <p className="repo-result-count" role="status">
            {matches.length} {t('kho mã phù hợp', 'matching repositories')}
          </p>
          <div
            className="repo-choice-list"
            role="group"
            aria-label={t('Kho mã GitHub', 'GitHub repository')}
          >
            {matches.map((repo) => {
              const value = repo.fullName || repo.name;
              const owner = repo.fullName?.split('/')[0] || username;
              return (
                <label
                  key={value}
                  className={'repo-choice' + (selected === value ? ' is-selected' : '')}
                  data-visibility={repo.private ? 'private' : 'public'}
                >
                  <input
                    type="radio"
                    name={choiceName}
                    value={value}
                    checked={selected === value}
                    disabled={busy || disabled}
                    onChange={() => {
                      setSelected(value);
                      setPreview(null);
                      setError('');
                      setNotice('');
                    }}
                  />
                  <Icon name="projects" />
                  <span className="repo-choice-text">
                    {known.has('/' + value.toLowerCase()) && (
                      <small className="duplicate-note">
                        {kind === 'projects'
                          ? t('Đã thêm dự án', 'Project already added')
                          : t('Đã có bài viết', 'Referenced in a post')}
                      </small>
                    )}
                    <strong>{repo.name}</strong>
                    <small>
                      {owner}
                      {repo.language ? ' · ' + repo.language : ''}
                      {repo.fork ? ' · Fork' : ''}
                    </small>
                  </span>
                  <span
                    className={'repository-visibility ' + (repo.private ? 'private' : 'public')}
                  >
                    <Icon name={repo.private ? 'lock' : 'globe'} />
                    {repo.private ? t('Riêng tư', 'Private') : t('Công khai', 'Public')}
                  </span>
                </label>
              );
            })}
            {!matches.length && (
              <p className="repo-no-results">
                {t(
                  'Không tìm thấy kho mã. Thử tên khác hoặc đổi bộ lọc.',
                  'No repositories found. Try another name or filter.',
                )}
              </p>
            )}
          </div>
          <div className="repo-selection-actions">
            <p>
              {selected ? (
                <>
                  {t('Đã chọn', 'Selected')}: <strong>{selected}</strong>
                </>
              ) : (
                t(
                  'Chọn một kho mã để đọc thông tin.',
                  'Choose a repository to read its information.',
                )
              )}
            </p>
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
          {localizedError(error, language)}
        </p>
      )}
      {notice && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
      {preview && (
        <div
          className="github-import-preview"
          data-visibility={preview.private ? 'private' : 'public'}
        >
          <h4>{t('Thông tin từ kho mã', 'Repository information')}</h4>
          {known.has(repositoryIdentity(preview.fields.github || '')) && (
            <p className="duplicate-note" role="status">
              {kind === 'projects'
                ? t(
                    'Kho mã này đã có trong danh sách dự án. Sửa dự án hiện có để tránh trùng.',
                    'This repository is already in your projects. Edit the existing project to avoid duplicates.',
                  )
                : t(
                    'Đã có bài viết tham chiếu kho mã này. Bạn vẫn có thể tạo cập nhật mới.',
                    'A post already references this repository. You can still write a new update.',
                  )}
            </p>
          )}
          <span className={'repository-visibility ' + (preview.private ? 'private' : 'public')}>
            {preview.private
              ? t('Kho mã riêng tư', 'Private repository')
              : t('Kho mã công khai', 'Public repository')}
          </span>
          {preview.private && (
            <p className="private-note">
              {t(
                'Đây là kho mã riêng tư. Ảnh GitHub có thể không hiển thị cho người xem. Để chia sẻ ảnh, chọn Đính kèm file trong trình soạn thảo để tải từng ảnh được phép công khai, giữ bản nháp và xem trước khi xuất bản.',
                'This repository is private. GitHub images may not load for visitors. Use Attach file in the editor to upload individual images you may share, keep a draft and preview before publishing.',
              )}
            </p>
          )}
          <dl>
            {Object.entries(preview.fields)
              .filter(([key, v]) => v && labels[key])
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{labels[key]}</dt>
                  <dd>
                    {key === 'details' ? (
                      <MarkdownContent value={value} base={preview.fields.detailsBase} />
                    ) : (
                      value
                    )}
                  </dd>
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
                  'Đã điền vào biểu mẫu. Kiểm tra nội dung rồi nhấn Lưu.',
                  'Form filled. Review the content and Save.',
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
