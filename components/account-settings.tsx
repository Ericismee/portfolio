'use client';
import { useEffect, useRef, useState } from 'react';
import { request } from '../lib/client';
import { localizedError } from '../lib/i18n';
import { FieldsForm, type Field } from './admin-form';
import { useLanguage } from './language';
import { Icon } from './icon';

type Account = { username: string; email: string };
export function AccountSettings({
  csrf,
  onSessionChange,
  onDirty,
}: {
  csrf: string;
  onSessionChange: (csrf: string) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const [account, setAccount] = useState<Account | null>(null),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [revision, setRevision] = useState(0),
    [active, setActive] = useState<'username' | 'email' | 'password' | null>(null),
    [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  function open(section: 'username' | 'email' | 'password') {
    if (busy) return;
    if (dirty.current && !confirm(t('Bỏ các thay đổi chưa lưu?', 'Discard unsaved changes?'))) return;
    dirty.current = false;
    onDirty(false);
    setSaved(false);
    setActive(active === section ? null : section);
    setRevision((value) => value + 1);
  }
  useEffect(() => {
    let active = true;
    void request<Account>('/api/admin/account')
      .then((value) => {
        if (active) setAccount(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const fields: Field[] = [
    {
      key: 'username',
      label: t('Tên đăng nhập / ID', 'Username / ID'),
      required: true,
      autoComplete: 'username',
      help: t(
        'Tối đa 40 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.',
        'Up to 40 characters: letters, numbers, dots, underscores or hyphens.',
      ),
    },
    {
      key: 'email',
      label: t('Email tài khoản', 'Account email'),
      type: 'email',
      autoComplete: 'email',
      help: t(
        'Lưu riêng cho tài khoản admin; không thay đổi email hồ sơ công khai. Email này chưa dùng để đăng nhập hoặc khôi phục mật khẩu.',
        'Private to your admin account; your public profile email stays separate. This email is not used for sign-in or password recovery.',
      ),
    },
    {
      key: 'currentPassword',
      label: t('Mật khẩu hiện tại', 'Current password'),
      type: 'password',
      required: true,
    },
    {
      key: 'newPassword',
      label: t('Mật khẩu mới', 'New password'),
      type: 'password',
      autoComplete: 'new-password',
      required: active === 'password',
      help: t(
        '12–256 ký tự. Để trống nếu chỉ đổi tên đăng nhập hoặc email.',
        '12–256 characters. Leave blank to update only your username or email.',
      ),
    },
    {
      key: 'confirmPassword',
      label: t('Nhập lại mật khẩu mới', 'Confirm new password'),
      type: 'password',
      autoComplete: 'new-password',
      required: active === 'password',
    },
  ];
  return (
    <div className="account-settings">
      {account && <div className="account-actions">
        {([
          ['username', t('Tên đăng nhập / ID', 'Username / ID'), account.username, t('Đổi tên đăng nhập', 'Change username'), 'user'],
          ['email', t('Email tài khoản', 'Account email'), account.email || t('Chưa thêm email', 'No email added'), t('Đổi email', 'Change email'), 'mail'],
          ['password', t('Mật khẩu', 'Password'), t('Xác nhận bằng mật khẩu hiện tại', 'Confirm with your current password'), t('Đổi mật khẩu', 'Change password'), 'lock'],
        ] as const).map(([key, label, value, button, icon]) => <div className="account-action-row" key={key}>
          <Icon name={icon} />
          <div><strong>{label}</strong><p>{value}</p></div>
          <button type="button" className="btn neutral" aria-expanded={active === key} aria-controls="account-change-panel" disabled={busy} onClick={() => open(key)}>{active === key ? t('Đóng', 'Close') : button}</button>
        </div>)}
      </div>}
      {active && <div className="account-notice">
        <Icon name="lock" />
        <p>
          {t(
            'Xác nhận bằng mật khẩu hiện tại để lưu thay đổi. Các phiên đăng nhập cũ sẽ bị đăng xuất; bạn tiếp tục sử dụng phiên mới trên trình duyệt này.',
            'Confirm your current password to save changes. Previous sessions will be signed out; you will stay signed in with a new session in this browser.',
          )}
        </p>
      </div>}
      {error && (
        <p role="alert" className="form-error">
          {localizedError(error, language)}
        </p>
      )}
      {saved && (
        <p role="status" className="account-success">
          {t(
            'Đã cập nhật tài khoản. Các phiên cũ đã được đăng xuất.',
            'Account updated. Previous sessions have been signed out.',
          )}
        </p>
      )}
      {account && active ? (
        <div id="account-change-panel">
        <FieldsForm
          key={revision}
          fields={fields.filter((field) => field.key === active || field.key === 'currentPassword' || (active === 'password' && ['newPassword', 'confirmPassword'].includes(field.key)))}
          initial={{ ...account, currentPassword: '', newPassword: '', confirmPassword: '' }}
          csrf={csrf}
          onBusyChange={setBusy}
          onDirty={(value) => { dirty.current = value; onDirty(value); }}
          submitLabel={t('Lưu tài khoản', 'Save account')}
          submit={async (values) => {
            setSaved(false);
            const result = await request<Account & { csrf: string }>(
              '/api/admin/account',
              'PUT',
              { ...account, currentPassword: '', newPassword: '', confirmPassword: '', ...values },
              csrf,
            );
            onSessionChange(result.csrf);
            setAccount({ username: result.username, email: result.email });
            setRevision((value) => value + 1);
            setSaved(true);
            setActive(null);
            dirty.current = false;
            onDirty(false);
          }}
        />
        </div>
      ) : (
        !account && !error && <p role="status">{t('Đang tải tài khoản…', 'Loading account…')}</p>
      )}
    </div>
  );
}
