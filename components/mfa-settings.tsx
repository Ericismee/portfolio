'use client';
import { useEffect, useState } from 'react';
import { request } from '../lib/client';
import { useLanguage } from './language';
import { localizedError } from '../lib/i18n';
export function MfaSettings({
  csrf,
  onSessionChange,
}: {
  csrf: string;
  onSessionChange: (csrf: string) => void;
}) {
  const { t, language } = useLanguage();
  const [enabled, setEnabled] = useState<boolean>();
  const [setup, setSetup] = useState<{ secret: string; uri: string }>();
  const [recovery, setRecovery] = useState<string[]>([]);
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState(''),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void request<{ enabled: boolean }>('/api/admin/mfa')
      .then((result) => {
        if (active) setEnabled(result.enabled);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="mfa-settings">
      <div className="account-action-row">
        <div>
          <strong>{t('Xác thực hai bước', 'Two-factor authentication')}</strong>
          <p>
            {enabled === undefined
              ? t('Đang kiểm tra…', 'Checking…')
              : enabled
                ? t('Đang bật · Ứng dụng xác thực', 'Enabled · Authenticator app')
                : t('Thêm mã xác thực khi đăng nhập', 'Add a verification code at sign-in')}
          </p>
        </div>
        <button
          className="btn neutral"
          disabled={busy || enabled === undefined}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            setSetup(undefined);
            setPassword('');
            setCode('');
            setError('');
          }}
        >
          {open
            ? t('Đóng', 'Close')
            : enabled
              ? t('Tắt 2FA', 'Disable 2FA')
              : t('Thiết lập 2FA', 'Set up 2FA')}
        </button>
      </div>
      {open && (
        <form
          className="admin-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const action = enabled ? 'disable' : setup ? 'confirm' : 'begin';
              const result = await request<{
                secret?: string;
                uri?: string;
                csrf?: string;
                enabled?: boolean;
                recoveryCodes?: string[];
              }>('/api/admin/mfa', 'POST', { action, password, code }, csrf);
              setPassword('');
              setCode('');
              if (result.secret && result.uri) setSetup({ secret: result.secret, uri: result.uri });
              else {
                setEnabled(!!result.enabled);
                setSetup(undefined);
                setOpen(false);
                setRecovery(result.recoveryCodes || []);
                if (result.csrf) onSessionChange(result.csrf);
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed');
            } finally {
              setBusy(false);
            }
          }}
        >
          {setup ? (
            <>
              <p>
                {t(
                  'Trong ứng dụng Authenticator, thêm tài khoản bằng khóa thiết lập bên dưới. Sau đó nhập mã 6 số để bật.',
                  'In your authenticator app, add an account using the setup key below. Then enter its 6-digit code to enable 2FA.',
                )}
              </p>
              <label>
                {t('Khóa thiết lập', 'Setup key')}
                <input value={setup.secret} readOnly autoComplete="off" />
              </label>
              <a href={setup.uri}>{t('Mở ứng dụng xác thực', 'Open authenticator app')}</a>
            </>
          ) : (
            <label>
              {t('Mật khẩu hiện tại', 'Current password')}
              <input
                type="password"
                value={password}
                required
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {(setup || enabled) && (
            <label>
              {t('Mã xác thực', 'Verification code')}
              <input
                value={code}
                required
                maxLength={32}
                autoComplete="one-time-code"
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          <button className="btn primary" disabled={busy}>
            {busy
              ? t('Đang xử lý…', 'Working…')
              : setup
                ? t('Xác nhận và bật', 'Confirm and enable')
                : enabled
                  ? t('Xác nhận tắt', 'Confirm disable')
                  : t('Tiếp tục', 'Continue')}
          </button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {localizedError(error, language)}
        </p>
      )}
      {recovery.length > 0 && (
        <div className="mfa-recovery" role="status">
          <strong>{t('Lưu các mã khôi phục ngay', 'Save your recovery codes now')}</strong>
          <p>
            {t(
              'Mỗi mã chỉ dùng một lần. Cất trong trình quản lý mật khẩu; mã chỉ được hiển thị lần này.',
              'Each code works once. Store them in your password manager; these codes are shown only now.',
            )}
          </p>
          <pre>{recovery.join('\n')}</pre>
          <button className="btn neutral" onClick={() => setRecovery([])}>
            {t('Đã lưu mã', 'I saved these codes')}
          </button>
        </div>
      )}
    </section>
  );
}
