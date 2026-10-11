import type { Language } from './schema.ts';
const labels: Record<string, string> = {
  'Giới thiệu': 'About',
  'Nổi bật': 'Featured',
  'Kinh nghiệm': 'Experience',
  'Dự án': 'Projects',
  'Kỹ năng': 'Skills',
  'Học vấn': 'Education',
  'Chứng chỉ': 'Certifications',
  'Hoạt động': 'Activity',
  'Kho mã công khai': 'Public repository',
  'Đang phát triển': 'In development',
  'Hoàn thành': 'Completed',
  'Đang thực hiện': 'In progress',
};
export function uiLabel(value: string, language: Language) {
  return language === 'en' ? labels[value] || value : value;
}
export function sectionLabel(key: string, custom: string | undefined, language: Language) {
  return custom && custom !== key ? custom : uiLabel(key, language);
}

const errors: Record<string, string> = {
  'Invalid JSON': 'Dữ liệu JSON không hợp lệ',
  'Invalid backup file': 'Bản sao lưu không hợp lệ',
  'Invalid file': 'File không hợp lệ',
  'File too large': 'File quá lớn',
  'Invalid origin': 'Nguồn yêu cầu không hợp lệ',
  'Invalid session or CSRF token': 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  'Revision not found': 'Không tìm thấy bản lưu',
  'Invalid GitHub account': 'Tài khoản GitHub không hợp lệ',
  'Invalid GitHub repositories': 'Danh sách kho mã GitHub không hợp lệ',
  'Failed to fetch': 'Không thể kết nối. Vui lòng thử lại.',
  'Unable to connect': 'Không thể kết nối',
  'Unsupported imported file': 'File nhập vào không được hỗ trợ',
};
export function localizedError(message: string, language: Language) {
  const parts = message.split(' / ');
  if (parts.length === 2) {
    const vietnameseFirst = /[À-ỹĐđ]/u.test(parts[0]);
    return parts[(language === 'vi') === vietnameseFirst ? 0 : 1];
  }
  return language === 'vi' ? errors[message] || message : message;
}
