// Editorial snapshot of public README/API information, read 2026-10-10.
// These descriptions are repository claims, not verified individual outcomes.
export const publicProfile={
  summary:'Simplify everything.',
  about:'Các dự án trong hồ sơ tập trung vào AI cho nghiên cứu tài liệu, học ngôn ngữ và công cụ desktop. Xem từng dự án để tìm hiểu mục tiêu, công nghệ và mã nguồn công khai.',
};
export const publicLinks={github:'https://github.com/Ericismee',linkedin:'https://www.linkedin.com/in/nguyen-ngoc-han-eric-35700443b/'};
export const publicProjects=[
  {id:'notebooke',name:'NotebookE',description:'Workspace nghiên cứu với AI: tổ chức tài liệu, hỏi đáp theo ngữ cảnh và tạo podcast hoặc video từ nguồn nội dung.',tech:'Python',technologies:['Python','Next.js','React','FastAPI','SurrealDB'],status:'Kho mã công khai',sample:false,pinned:true,github:'https://github.com/Ericismee/NotebookE',problem:'Tổ chức nguồn tài liệu đa định dạng và khai thác chúng trong cùng một không gian nghiên cứu.',details:'Theo README, NotebookE hỗ trợ mô hình AI local hoặc cloud, tìm kiếm toàn văn/vector, hỏi đáp theo nguồn và quy trình tạo podcast/video. Đây là tóm tắt tài liệu dự án, chưa phải kết quả kiểm chứng của bản demo hồ sơ.',source:'https://github.com/Ericismee/NotebookE#readme'},
  {id:'lingora-ai',name:'LingoraAI',description:'Nền tảng học tiếng Anh với lộ trình theo chặng, gia sư AI, luyện kỹ năng và học từ tài liệu.',tech:'TypeScript',technologies:['TypeScript','Next.js','React','Supabase'],status:'Kho mã công khai',sample:false,pinned:true,github:'https://github.com/Ericismee/LingoraAI',demo:'https://lingora-ai.vercel.app',problem:'Kết hợp lộ trình học, luyện kỹ năng và gia sư AI trong một ứng dụng có dữ liệu riêng theo tài khoản.',details:'Theo README, LingoraAI có lộ trình tuần tự, AI Tutor, flashcards, luyện đọc/nghe/nói/viết và các công cụ học từ tài liệu. Địa chỉ demo lấy từ metadata của repo; chưa kiểm tra hoạt động của dịch vụ.',source:'https://github.com/Ericismee/LingoraAI#readme'},
  {id:'horune',name:'Horune',description:'Công cụ desktop hẹn giờ tác vụ, đồng hồ nổi và Theme Studio để tùy chỉnh giao diện đồng hồ.',tech:'TypeScript',technologies:['TypeScript','React','Tauri','Rust','SQLite'],status:'Đang phát triển',sample:false,pinned:false,github:'https://github.com/Ericismee/horune',problem:'Quản lý lịch tác vụ desktop và hiển thị thời gian bằng đồng hồ nổi có thể tùy chỉnh.',details:'Theo README, mã nguồn có scheduler, chế độ mô phỏng và Theme Studio. Chưa có bản phát hành công khai; tác vụ hệ thống thật còn cần kiểm chứng trên thiết bị. Không diễn giải trạng thái CI thành kết quả thử nghiệm cá nhân.',source:'https://github.com/Ericismee/horune#readme'},
];

export function upgradePublicContent(data){
  if(data.contentVersion>=1)return;
  if(!data.profile.summary)data.profile.summary=publicProfile.summary;
  if(!data.profile.about)data.profile.about=publicProfile.about;
  data.links={...publicLinks,...data.links};
  for(const [key,url]of Object.entries(publicLinks))if(!data.links[key])data.links[key]=url;
  if(!data.githubUsername)data.githubUsername='Ericismee';
  for(const seed of publicProjects){
    const old=data.projects.find(p=>p.id===seed.id||p.github===seed.github||(seed.id==='lingora-ai'&&p.id==='er-ai'&&p.name==='ER AI'&&p.description?.includes('minh họa')));
    if(!old){data.projects.push(structuredClone(seed));continue}
    const mockNames={notebooke:'NotebookE','er-ai':'ER AI',horune:'Horune'};
    const isMock=old.name===mockNames[old.id]&&old.description?.includes('Nội dung minh họa');
    if(isMock){const preserved={...old};Object.assign(old,structuredClone(seed),preserved,{id:seed.id,name:seed.name,description:seed.description,tech:seed.tech,sample:false,source:seed.source,technologies:seed.technologies});
      old.status=preserved.status==='Dữ liệu mẫu'?seed.status:preserved.status||seed.status;
      for(const key of ['github','demo','problem','details'])if(!old[key])old[key]=seed[key]||'';
      if(preserved.pinned===undefined)old.pinned=seed.pinned;
    }else{if(!old.github)old.github=seed.github}
  }
  data.contentVersion=1;
}
