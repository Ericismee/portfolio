import type { InboxMessage } from './schema';

// Keep user-provided text inside encoded query values, never mail headers.
export function inboxMailLink(message: InboxMessage, action: 'reply' | 'forward') {
  const subject = message.subject.replace(/[\r\n]+/g, ' ');
  const quote = [
    `From: ${message.name} <${message.email}>`,
    `Date: ${message.created_at}`,
    `Subject: ${subject}`,
    '',
    message.message,
  ].join('\n');
  const body =
    action === 'reply'
      ? '\n\n' +
        quote
          .split('\n')
          .map((line) => '> ' + line)
          .join('\n')
      : '\n\n---------- Forwarded message ----------\n' + quote;
  return (
    'mailto:' +
    (action === 'reply' ? encodeURIComponent(message.email) : '') +
    '?subject=' +
    encodeURIComponent((action === 'reply' ? 'Re: ' : 'Fwd: ') + subject) +
    '&body=' +
    encodeURIComponent(body)
  );
}
