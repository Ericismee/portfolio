'use client';
import { useState } from 'react';
import { request } from '../lib/client';
import { useLanguage } from './language';

type Connection = {
  connected: boolean;
  login: string;
  source: 'account' | 'environment' | 'none';
  remaining?: number;
  limit?: number;
};
export function GithubConnection({ onChange }: { onChange?: () => void }) {
  const { t } = useLanguage();
  const [state, setState] = useState<Connection | null>(null);
  const [token, setToken] = useState('');
  const [replaceToken, setReplaceToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function update(method = 'GET') {
    setBusy(true);
    setError('');
    try {
      const session = method === 'GET' ? null : await request<{ csrf: string }>('/api/session');
      const result = await request<Connection>(
        '/api/admin/github-connection',
        method,
        method === 'POST' ? { token } : undefined,
        session?.csrf,
      );
      setState(result);
      if (method !== 'GET') {
        setToken('');
        setReplaceToken(false);
        onChange?.();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : t('Không kết nối được.', 'Connection failed.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="github-account-connection"
      onToggle={(event) => {
        if (event.currentTarget.open && !state && !busy) void update();
      }}
    >
      <summary>{t('Kết nối tài khoản GitHub', 'Connect GitHub account')}</summary>
      {state?.connected && (
        <p role="status">
          {state.login ? '@' + state.login : t('Đã cấu hình trên máy chủ', 'Configured on server')}{' '}
          · {t('Đã kết nối', 'Connected')}
          {state.limit
            ? ` · ${state.remaining}/${state.limit} ${t('lượt còn lại', 'requests remaining')}`
            : ''}
        </p>
      )}
      {state?.source === 'account' && (
        <p className="muted">
          {t(
            'Đã lưu an toàn. Kết nối được ghi nhớ khi mở lại trang hoặc khởi động lại máy chủ; bạn không cần nhập lại token.',
            'Saved securely. Your connection is remembered across page visits and server restarts; you do not need to enter the token again.',
          )}
        </p>
      )}
      <p className="muted">
        {t(
          'Kết nối một lần cho admin. Đọc được các kho mã mà tài khoản đã cấp quyền, kể cả kho riêng tư. Token được lưu mã hóa trên máy chủ, không nằm trong bản sao lưu nội dung.',
          'Connect once for admin. Read repositories granted to the account, including private repositories. The token is encrypted on the server and excluded from content backups.',
        )}
      </p>
      <a
        href="https://github.com/settings/personal-access-tokens/new"
        target="_blank"
        rel="noreferrer"
      >
        {t('Tạo token trên GitHub ↗', 'Create a GitHub token ↗')}
      </a>
      <p className="muted">
        {t(
          'Chọn tài khoản sở hữu, các kho mã cần đọc (hoặc All repositories) và quyền Contents: Read-only. Kho mã của tổ chức có thể cần được tổ chức chấp thuận.',
          'Select the resource owner, repositories to read (or All repositories), and Contents: Read-only. Organization repositories may require approval.',
        )}
      </p>
      {(!state?.connected || replaceToken) && (
        <label>
          {t('Token truy cập GitHub', 'GitHub access token')}
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            disabled={busy}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (token.trim()) void update('POST');
              }
            }}
            placeholder="github_pat_…"
          />
        </label>
      )}
      <div className="github-connection-actions">
        {state?.connected && !replaceToken ? (
          <button
            type="button"
            className="btn neutral"
            disabled={busy}
            onClick={() => setReplaceToken(true)}
          >
            {t('Thay token', 'Replace token')}
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={busy || !token.trim()}
            onClick={() => void update('POST')}
          >
            {busy ? t('Đang kết nối…', 'Connecting…') : t('Kết nối GitHub', 'Connect GitHub')}
          </button>
        )}
        {state?.source === 'account' && (
          <button
            type="button"
            className="btn neutral"
            disabled={busy}
            onClick={() => void update('DELETE')}
          >
            {t('Ngắt kết nối', 'Disconnect')}
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
