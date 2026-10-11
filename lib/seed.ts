export const initial = {
  profile: {
    name: 'Eric',
    headline: 'Software Engineer',
    summary:
      'Software developer building AI-powered research, learning experiences, and thoughtful desktop tools.',
    about:
      "I'm Eric, also known as Nguyen Ngoc Han, a software developer based in Vietnam. I turn ideas into practical tools that make learning, research, and everyday work simpler.\n\nMy projects explore AI-assisted document research, language learning, and desktop productivity. I enjoy connecting thoughtful interfaces with reliable systems, from the first prototype to the details that make an application comfortable to use.\n\nI care about clarity, privacy, and continuous improvement. This portfolio is where I share what I'm building, what I'm learning, and the thinking behind each project.",
    location: '',
    avatar: '',
    cover: '',
  },
  theme: 'light',
  accent: '#4264da',
  density: 'comfortable',
  sections: [
    'Giới thiệu',
    'Nổi bật',
    'Kinh nghiệm',
    'Dự án',
    'Kỹ năng',
    'Học vấn',
    'Chứng chỉ',
    'Hoạt động',
  ],
  hidden: [],
  projects: [
    {
      id: 'notebooke',
      name: 'NotebookE',
      description:
        'Workspace nghiên cứu với AI: tổ chức tài liệu, hỏi đáp theo ngữ cảnh và tạo podcast hoặc video từ nguồn nội dung.',
      tech: 'Python',
      technologies: ['Python', 'Next.js', 'React', 'FastAPI', 'SurrealDB'],
      status: 'Kho mã công khai',
      sample: false,
      pinned: true,
      github: 'https://github.com/Ericismee/NotebookE',
      problem:
        'Tổ chức nguồn tài liệu đa định dạng và khai thác chúng trong cùng một không gian nghiên cứu.',
      details:
        'Theo README, NotebookE hỗ trợ mô hình AI local hoặc cloud, tìm kiếm toàn văn/vector, hỏi đáp theo nguồn và quy trình tạo podcast/video. Đây là tóm tắt tài liệu dự án, chưa phải kết quả kiểm chứng của bản demo hồ sơ.',
      source: 'https://github.com/Ericismee/NotebookE#readme',
    },
    {
      id: 'lingora-ai',
      name: 'LingoraAI',
      description:
        'Nền tảng học tiếng Anh với lộ trình theo chặng, gia sư AI, luyện kỹ năng và học từ tài liệu.',
      tech: 'TypeScript',
      technologies: ['TypeScript', 'Next.js', 'React', 'Supabase'],
      status: 'Kho mã công khai',
      sample: false,
      pinned: true,
      github: 'https://github.com/Ericismee/LingoraAI',
      demo: 'https://lingora-ai.vercel.app',
      problem:
        'Kết hợp lộ trình học, luyện kỹ năng và gia sư AI trong một ứng dụng có dữ liệu riêng theo tài khoản.',
      details:
        'Theo README, LingoraAI có lộ trình tuần tự, AI Tutor, flashcards, luyện đọc/nghe/nói/viết và các công cụ học từ tài liệu. Địa chỉ demo lấy từ metadata của repo; chưa kiểm tra hoạt động của dịch vụ.',
      source: 'https://github.com/Ericismee/LingoraAI#readme',
    },
    {
      id: 'horune',
      name: 'Horune',
      description:
        'Công cụ desktop hẹn giờ tác vụ, đồng hồ nổi và Theme Studio để tùy chỉnh giao diện đồng hồ.',
      tech: 'TypeScript',
      technologies: ['TypeScript', 'React', 'Tauri', 'Rust', 'SQLite'],
      status: 'Đang phát triển',
      sample: false,
      pinned: false,
      github: 'https://github.com/Ericismee/horune',
      problem:
        'Quản lý lịch tác vụ desktop và hiển thị thời gian bằng đồng hồ nổi có thể tùy chỉnh.',
      details:
        'Theo README, mã nguồn có scheduler, chế độ mô phỏng và Theme Studio. Chưa có bản phát hành công khai; tác vụ hệ thống thật còn cần kiểm chứng trên thiết bị. Không diễn giải trạng thái CI thành kết quả thử nghiệm cá nhân.',
      source: 'https://github.com/Ericismee/horune#readme',
    },
  ],
  posts: [
    {
      id: 'welcome',
      sample: true,
      type: 'Bài viết',
      title: 'Một không gian cho những điều đang xây dựng',
      text: 'Đây là bài viết mẫu để thử cách hiển thị nội dung, chỉnh sửa và chia sẻ. Bạn có thể thay bằng câu chuyện của mình.',
    },
    {
      id: 'update',
      sample: true,
      type: 'Cập nhật dự án',
      title: 'Ghi lại hành trình, từng bước một',
      text: 'Dữ liệu mẫu · Khám phá một cách trình bày tiến độ dự án rõ ràng, với các ghi chú và công nghệ liên quan.',
    },
  ],
  items: {},
  links: {
    github: 'https://github.com/Ericismee',
    linkedin: 'https://www.linkedin.com/in/nguyen-ngoc-han-eric-35700443b/',
  },
  githubUsername: 'Ericismee',
  contentVersion: 1,
};
export const skills = [
  'Python',
  'TypeScript',
  'React',
  'Next.js',
  'FastAPI',
  'SurrealDB',
  'Supabase',
  'Rust',
  'Tauri',
];
