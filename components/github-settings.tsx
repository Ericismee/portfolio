'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { GithubSettings } from '../lib/schema';
import type { GithubSkills } from '../lib/github-skills';
import { request } from '../lib/client';
import { useLanguage } from './language';

export function GithubSettingsForm({
  initial,
  initialUsername,
  save,
  onDirty,
  focusRepositories = false,
}: {
  initial: GithubSettings;
  initialUsername: string;
  save: (settings: GithubSettings, username: string) => Promise<void>;
  onDirty?: (dirty: boolean) => void;
  focusRepositories?: boolean;
}) {
  const { t } = useLanguage();
  const sectionId = useId();
  const repositoryFieldset = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!focusRepositories) return;
    const frame = requestAnimationFrame(() => {
      repositoryFieldset.current?.scrollIntoView({ block: 'start' });
      repositoryFieldset.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRepositories]);
  const [value, setValue] = useState(initial);
  const [username, setUsername] = useState(initialUsername);
  const [loadedUsername, setLoadedUsername] = useState(initialUsername);
  const [source, setSource] = useState<GithubSkills | null>(null);
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial) || username !== initialUsername;
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    let active = true;
    request<GithubSkills>('/api/admin/github?username=' + encodeURIComponent(loadedUsername))
      .then((data) => {
        if (active) {
          setSource(data);
          setLoadError(data.status === 'unavailable' ? 'unavailable' : '');
        }
      })
      .catch(() => {
        if (active) setLoadError('failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload, loadedUsername]);
  const change = <K extends keyof GithubSettings>(key: K, next: GithubSettings[K]) =>
    setValue((old) => ({ ...old, [key]: next }));
  const isHidden = (name: string) =>
    value.hiddenRepos.some((item) => item.toLowerCase() === name.toLowerCase());
  const isPinned = (name: string) =>
    value.featuredRepos.some((item) => item.toLowerCase() === name.toLowerCase());
  const toggles: [keyof GithubSettings, string][] = [
    ['showSidebar', t('Thẻ GitHub trên trang hồ sơ', 'GitHub card on the profile')],
    ['showStatistics', t('Thống kê tổng quan', 'Overview statistics')],
    ['showTechnologies', t('Công nghệ sử dụng', 'Technology stack')],
    ['showCalendar', t('Lịch đóng góp', 'Contribution calendar')],
    ['showFeatured', t('Kho mã nổi bật', 'Featured repositories')],
    ['showRepositories', t('Tab danh sách kho mã', 'Repositories tab')],
    ['showCommits', t('Lịch sử commit', 'Commit history')],
    ['showEvents', t('Hoạt động công khai', 'Public activity')],
  ];
  const repos =
    source?.repos.filter((repo) => repo.name.toLowerCase().includes(query.trim().toLowerCase())) ||
    [];
  return (
    <form
      className="github-settings-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (username !== loadedUsername) {
          setError(
            t(
              'Hãy tải kho mã của tài khoản mới trước khi lưu.',
              'Load the new account repositories before saving.',
            ),
          );
          return;
        }
        setBusy(true);
        setError('');
        try {
          await save(value, username);
        } catch (e) {
          setError(e instanceof Error ? e.message : t('Không lưu được.', 'Unable to save.'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <nav
        className="github-config-nav"
        aria-label={t('Đi đến phần cấu hình', 'Configuration sections')}
      >
        <a href={'#' + sectionId + '-account'}>{t('Tài khoản', 'Account')}</a>
        <a href={'#' + sectionId + '-repos'}>{t('Chọn kho mã', 'Choose repositories')}</a>
        <a href={'#' + sectionId + '-sections'}>{t('Các phần hiển thị', 'Visible sections')}</a>
      </nav>
      <fieldset id={sectionId + '-account'} disabled={busy}>
        <legend>{t('Nội dung & cập nhật', 'Content & updates')}</legend>
        <label>
          {t('Tài khoản GitHub công khai', 'Public GitHub username')}
          <input
            name="githubUsername"
            maxLength={39}
            pattern="[a-zA-Z0-9-]*"
            value={username}
            onChange={(event) => setUsername(event.target.value.trim())}
          />
        </label>
        <button
          className="btn neutral"
          type="button"
          disabled={loading}
          onClick={() => {
            if (!/^[a-zA-Z0-9-]{0,39}$/.test(username)) {
              setError(t('Tên tài khoản GitHub không hợp lệ.', 'Invalid GitHub username.'));
              return;
            }
            if (username.toLowerCase() !== loadedUsername.toLowerCase())
              setValue((old) => ({ ...old, hiddenRepos: [], featuredRepos: [] }));
            setSource(null);
            setLoading(true);
            setLoadError('');
            setError('');
            setLoadedUsername(username);
            setReload((n) => n + 1);
          }}
        >
          {t('Tải kho mã từ GitHub', 'Load GitHub repositories')}
        </button>
        <p className="muted">
          {t(
            'Đổi tài khoản sẽ xóa lựa chọn ẩn và ghim của tài khoản trước. Chỉ lấy dữ liệu công khai.',
            'Changing accounts clears the previous hidden and featured selections. Only public data is loaded.',
          )}
        </p>

        <label>
          {t('Tự làm mới khi trang đang mở', 'Refresh while the page is open')}
          <select
            name="githubRefresh"
            value={value.refreshMinutes}
            onChange={(e) =>
              change('refreshMinutes', Number(e.target.value) as GithubSettings['refreshMinutes'])
            }
          >
            {[5, 15, 30, 60].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 60 ? t('Mỗi 1 giờ', 'Every hour') : minutes + t(' phút', ' minutes')}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          {t(
            'GitHub có thể cập nhật trễ hoặc giới hạn lượt truy cập. Có thể làm mới thủ công bất cứ lúc nào.',
            'GitHub may delay updates or limit requests. You can also refresh manually.',
          )}
        </p>
      </fieldset>

      <fieldset ref={repositoryFieldset} tabIndex={-1} id={sectionId + '-repos'} disabled={busy}>
        <legend>{t('Chọn kho mã', 'Choose repositories')}</legend>
        <label className="github-check">
          <input
            type="checkbox"
            name="includeForks"
            checked={value.includeForks}
            onChange={(e) => change('includeForks', e.target.checked)}
          />
          {t('Bao gồm kho mã fork', 'Include forked repositories')}
        </label>
        <label>
          {t('Kho mã nổi bật', 'Featured repositories')}
          <select
            name="featuredMode"
            value={value.featuredMode}
            onChange={(e) =>
              change('featuredMode', e.target.value as GithubSettings['featuredMode'])
            }
          >
            <option value="auto">
              {t('Tự chọn theo stars & cập nhật', 'Automatic by stars & updates')}
            </option>
            <option value="selected">
              {t('Tôi tự chọn và sắp xếp', 'Choose and order manually')}
            </option>
          </select>
        </label>
        {value.featuredMode === 'selected' && (
          <div className="github-pinned-order">
            <h3>
              {t('Thứ tự nổi bật', 'Featured order')} · {value.featuredRepos.length}/12
            </h3>
            {!value.featuredRepos.length && (
              <p className="muted">
                {t(
                  'Chưa chọn kho mã nổi bật. Tích “Nổi bật” trong danh sách bên dưới.',
                  'No featured repositories selected. Check “Featured” below.',
                )}
              </p>
            )}
            <ol>
              {value.featuredRepos.map((name, index) => (
                <li key={name}>
                  <span>
                    {name}
                    {isHidden(name) ? t(' · đang ẩn', ' · hidden') : ''}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t('Đưa lên: ', 'Move up: ') + name}
                      disabled={index === 0}
                      onClick={() => {
                        const names = [...value.featuredRepos];
                        [names[index - 1], names[index]] = [names[index], names[index - 1]];
                        change('featuredRepos', names);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t('Đưa xuống: ', 'Move down: ') + name}
                      disabled={index === value.featuredRepos.length - 1}
                      onClick={() => {
                        const names = [...value.featuredRepos];
                        [names[index + 1], names[index]] = [names[index], names[index + 1]];
                        change('featuredRepos', names);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t('Bỏ nổi bật: ', 'Unpin: ') + name}
                      onClick={() =>
                        change(
                          'featuredRepos',
                          value.featuredRepos.filter((item) => item !== name),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
        <label>
          {t('Tìm kho mã', 'Search repositories')}
          <input
            type="search"
            name="githubRepoSearch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Nhập tên kho mã…', 'Repository name…')}
          />
        </label>
        {loading && <p role="status">{t('Đang tải từ GitHub…', 'Loading GitHub repositories…')}</p>}
        {loadError && (
          <p role="alert">
            {t('Không tải được danh sách kho mã từ GitHub.', 'Could not load GitHub repositories.')}{' '}
            <button
              className="text-action"
              type="button"
              onClick={() => {
                setLoading(true);
                setReload((n) => n + 1);
              }}
            >
              {t('Thử lại', 'Retry')}
            </button>
          </p>
        )}
        {source && (
          <p className="muted">
            @{source.username} · {source.repos.length} {t('kho mã đã tải', 'loaded repositories')}
            {source.partial ? t(' · dữ liệu một phần', ' · partial data') : ''}
          </p>
        )}
        <ul className="github-config-repos">
          {repos.map((repo) => (
            <li key={repo.name}>
              <div>
                <strong>{repo.name}</strong>
                <small>
                  {[repo.language, repo.fork && 'Fork', repo.archived && t('Lưu trữ', 'Archived')]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
              <div className="github-repo-options">
                <label className="github-check">
                  <input
                    type="checkbox"
                    aria-label={t('Hiển thị: ', 'Show: ') + repo.name}
                    checked={!isHidden(repo.name)}
                    onChange={(e) =>
                      change(
                        'hiddenRepos',
                        e.target.checked
                          ? value.hiddenRepos.filter(
                              (name) => name.toLowerCase() !== repo.name.toLowerCase(),
                            )
                          : [...value.hiddenRepos, repo.name],
                      )
                    }
                  />
                  {t('Hiển thị', 'Show')}
                </label>
                {value.featuredMode === 'selected' && (
                  <label className="github-check">
                    <input
                      type="checkbox"
                      aria-label={t('Nổi bật: ', 'Feature: ') + repo.name}
                      checked={isPinned(repo.name)}
                      disabled={
                        !isPinned(repo.name) &&
                        (isHidden(repo.name) ||
                          (!value.includeForks && repo.fork) ||
                          value.featuredRepos.length >= 12)
                      }
                      onChange={(e) =>
                        change(
                          'featuredRepos',
                          e.target.checked
                            ? [...value.featuredRepos, repo.name]
                            : value.featuredRepos.filter(
                                (name) => name.toLowerCase() !== repo.name.toLowerCase(),
                              ),
                        )
                      }
                    />
                    {t('Nổi bật', 'Featured')}
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!loading && !loadError && !repos.length && (
          <p className="muted">{t('Không có kho mã phù hợp.', 'No matching repositories.')}</p>
        )}
        <p className="muted">
          {t(
            'Kho mã bị ẩn cũng được loại khỏi lịch sử hiển thị trên website. Lịch đóng góp và ngôn ngữ vẫn tính trên toàn tài khoản GitHub. Thay đổi này không sửa dữ liệu trên GitHub.',
            'Hidden repositories are also excluded from this site’s history. Contributions and languages remain account-wide. These settings do not change GitHub data.',
          )}
        </p>
      </fieldset>
      <fieldset id={sectionId + '-sections'} disabled={busy}>
        <legend>{t('Các phần hiển thị', 'Visible sections')}</legend>
        <div className="github-setting-toggles">
          {toggles.map(([key, label]) => (
            <label key={key} className="github-check">
              <input
                type="checkbox"
                name={key}
                checked={Boolean(value[key])}
                onChange={(e) => change(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="btn" disabled={busy || !dirty}>
          {busy ? t('Đang lưu…', 'Saving…') : t('Lưu cấu hình GitHub', 'Save GitHub settings')}
        </button>
        <button
          className="btn neutral"
          type="button"
          disabled={busy || !dirty}
          onClick={() => {
            setError('');
            setValue(initial);
            setUsername(initialUsername);
            if (loadedUsername !== initialUsername) {
              setLoading(true);
              setSource(null);
              setLoadedUsername(initialUsername);
            }
          }}
        >
          {t('Hoàn tác', 'Reset changes')}
        </button>
      </div>
    </form>
  );
}
