'use client';
import { useState, type ComponentProps } from 'react';
import { Icon } from './icon';
import { useLanguage } from './language';

export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();
  const label = visible ? t('Ẩn mật khẩu', 'Hide password') : t('Hiện mật khẩu', 'Show password');
  return (
    <span className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={label}
        title={label}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible((value) => !value)}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} />
      </button>
    </span>
  );
}
