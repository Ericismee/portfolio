'use client';
import { useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { readRichText, safeMediaUrl, youtubeEmbed } from '../lib/rich-text';
import { useLanguage } from './language';

export function RichTextEditor({
  name,
  label,
  value,
  change,
  upload,
}: {
  name: string;
  label: string;
  value: string;
  change: (value: string) => void;
  upload: (file: File, done: (url: string) => void) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const [insert, setInsert] = useState(''),
    [url, setUrl] = useState(''),
    [error, setError] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image,
      Youtube.configure({ nocookie: true }),
    ],
    content: readRichText(value),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => change(JSON.stringify(editor.getJSON())),
  });
  if (!editor) return <p>{t('Đang tải trình soạn thảo…', 'Loading editor…')}</p>;
  const tool = (text: string, action: () => void, active = false) => (
    <button
      type="button"
      aria-label={text}
      title={text}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
    >
      {text}
    </button>
  );
  function embed() {
    if (!editor) return;
    if (insert === 'video') {
      if (!youtubeEmbed(url)) {
        setError(t('Nhập liên kết video YouTube hợp lệ.', 'Enter a valid YouTube video URL.'));
        return;
      }
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    } else {
      const safe = safeMediaUrl(url);
      if (!safe) {
        setError(t('Nhập liên kết http hoặc https hợp lệ.', 'Enter a valid http or https URL.'));
        return;
      }
      if (insert === 'image') editor.chain().focus().setImage({ src: safe }).run();
      else editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
    }
    setInsert('');
    setUrl('');
    setError('');
  }
  return (
    <div className="rich-editor">
      <input type="hidden" name={name} value={value} />
      <div
        className="rich-toolbar"
        role="toolbar"
        aria-label={t('Định dạng nội dung', 'Content formatting')}
      >
        {tool(
          'B · Ctrl+B',
          () => editor.chain().focus().toggleBold().run(),
          editor.isActive('bold'),
        )}
        {tool(
          'I · Ctrl+I',
          () => editor.chain().focus().toggleItalic().run(),
          editor.isActive('italic'),
        )}
        {tool(
          'U · Ctrl+U',
          () => editor.chain().focus().toggleUnderline().run(),
          editor.isActive('underline'),
        )}
        {tool(
          'H2',
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          editor.isActive('heading', { level: 2 }),
        )}
        {tool(
          t('• Danh sách', '• List'),
          () => editor.chain().focus().toggleBulletList().run(),
          editor.isActive('bulletList'),
        )}
        {tool(
          '1. ' + t('Danh sách', 'List'),
          () => editor.chain().focus().toggleOrderedList().run(),
          editor.isActive('orderedList'),
        )}
        {tool(
          t('Trích dẫn', 'Quote'),
          () => editor.chain().focus().toggleBlockquote().run(),
          editor.isActive('blockquote'),
        )}
        {tool(t('Liên kết', 'Link'), () => {
          setInsert('link');
          setUrl(String(editor.getAttributes('link').href || ''));
        })}
        {tool(t('Bỏ liên kết', 'Unlink'), () => editor.chain().focus().unsetLink().run())}
        {tool(t('Ảnh từ URL', 'Image URL'), () => setInsert('image'))}
        {tool('YouTube', () => setInsert('video'))}
        {tool('↶ ' + t('Hoàn tác', 'Undo'), () => editor.chain().focus().undo().run())}
        {tool('↷ ' + t('Làm lại', 'Redo'), () => editor.chain().focus().redo().run())}
      </div>
      {insert && (
        <div className="rich-insert">
          <input
            aria-label={t('Địa chỉ nhúng', 'Embed URL')}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
          <button type="button" className="btn neutral" onClick={embed}>
            {t('Chèn', 'Insert')}
          </button>
          <button
            type="button"
            onClick={() => {
              setInsert('');
              setError('');
            }}
          >
            {t('Hủy', 'Cancel')}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
      <label className="rich-upload">
        {t('Chèn ảnh từ thiết bị', 'Insert image from device')}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (file) await upload(file, (src) => editor.chain().focus().setImage({ src }).run());
            input.value = '';
          }}
        />
      </label>
      <p className="admin-help">
        {t(
          'Ctrl+B/I/U để định dạng; Ctrl+Z để hoàn tác. Chọn chữ trước khi chèn liên kết.',
          'Ctrl+B/I/U to format; Ctrl+Z to undo. Select text before inserting a link.',
        )}
      </p>
    </div>
  );
}
