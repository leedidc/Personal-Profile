(() => {
  'use strict';

  // 화면 분류, 기본 로고, 저장 위치는 이 파일에서 관리합니다.
  const sections = [
    { key: 'education', title: '학력', columns: ['학교', '기간', '전공 · 학위'] },
    {
      key: 'training',
      title: '교육 이수현황',
      columns: ['교육명 · 교육기관', '이수기간', '이수시간 · 교육내용'],
      optional: true,
    },
    { key: 'experience', title: '경력', columns: ['회사', '기간', '부서 · 업무'] },
    {
      key: 'certifications',
      title: '자격',
      columns: ['자격명', '취득일', '발급기관', '자격증 번호'],
      numberLabel: '자격증 번호',
    },
    {
      key: 'languages',
      title: '어학',
      columns: ['시험명', '취득일', '점수 · 등급', '등록번호'],
      numberLabel: '등록번호',
    },
    { key: 'skills', title: 'SKILL', columns: ['도구 · 용도', '숙련도'], optional: true },
    { key: 'projects', title: '프로젝트', columns: ['프로젝트', '기간', '내용'] },
    { key: 'activities', title: '대외활동', columns: ['기관 · 활동', '기간', '내용'] },
    { key: 'awards', title: '수상', columns: ['수상명', '수상일', '수여기관 · 수상 내용'] },
  ];
  const logoOptions = [
    ['로고 없음', ''],
    ['Arizona State University', 'image/asu.webp'],
    ['숭실대학교', 'image/ssu.png'],
    ['한국전자통신연구원', 'image/etri.jpg'],
    ['중소기업은행', 'image/ibk.png'],
    ['한국산업은행', 'image/kdb.png'],
    ['국방통합데이터센터', 'image/didc.jpg'],
    ['ETS · TOEIC', 'issuer/toeic.svg'],
    ['YBM · TOEIC', 'issuer/ybm.png'],
    ['경찰청 · 경기남부경찰청', 'image/police.png'],
    ['개인정보보호위원회', 'image/pipc.png'],
    ['한국사회보장정보원', 'image/ssis.png'],
    ['한국시스템보증', 'image/kosyas.jpg'],
    ['한국정보보호산업협회', 'image/kisia.png'],
    ['행정안전부', 'image/mois.png'],
    ['한국정보보호학회', 'image/kiisc.png'],
    ['DB김준기문화재단', 'image/db-foundation.png'],
    ['한국인터넷진흥원', 'issuer/kisa.png'],
    ['한국방송통신전파진흥원', 'issuer/kca.png'],
    ['한국산업인력공단', 'issuer/hrdk.png'],
    ['한국데이터산업진흥원', 'issuer/kdata.png'],
    ['한국CPO포럼', 'issuer/cpo.jpg'],
    ['ISTQB', 'issuer/istqb.svg'],
    ['IREB', 'issuer/ireb.png'],
    ['한국산업기술보호협회', 'issuer/kait.png'],
    ['한국정보통신기술협회', 'issuer/tta.jpg'],
    ['한국정보통신진흥협회', 'issuer/kait_ict.png'],
    ['한국정보통신자격협회', 'issuer/icqa.png'],
    ['한국지능형사물인터넷협회', 'issuer/kiot.jpg'],
    ['한국소프트웨어저작권협회', 'issuer/spc.png'],
    ['Microsoft', 'issuer/ms.png'],
    ['Cloud Security Alliance', 'issuer/csa.svg'],
    ['개인정보 확장 프로그램', 'image/extension.jpg'],
    ['직접 선택', '__custom__'],
  ];

  const editorLabels = {
    education: ['학교 정식 명칭', '영문 학교명 (전체 명칭)', '전공 · 학위'],
    training: ['교육기관', '과정명', '이수시간 (예: 4시간)'],
    experience: ['회사 정식 명칭', '영문 회사명 (전체 명칭)', '부서 · 직책'],
    certifications: ['자격 정식 명칭', '영문 전체 명칭 (한글 자격만)', '발급기관'],
    languages: ['시험명', '시행기관 · 언어', '점수 · 등급'],
    projects: ['프로젝트명', '소속 · 구분', '프로젝트 내용'],
    activities: ['기관명', '활동명 · 소속', '활동 내용'],
    awards: ['수상명', '대회명', '수여기관'],
  };

  const github = {
    repository: 'leedidc/Personal-Profile',
    branch: 'main',
    contentPath: 'data/portfolio.json',
    apiVersion: '2022-11-28',
    requestTimeoutMs: 20000,
  };

  const chatbot = {
    endpoint: 'https://chatbot.leedidc1227.workers.dev',
    requestTimeoutMs: 30000,
    maxQuestionLength: 1000,
    historyTurns: 4,
  };

  const admin = {
    origin: 'https://personal-profile-admin-auth.leedidc1227.workers.dev',
    publicOrigin: 'https://lee.chanhyeong.kro.kr',
  };

  const visitor = {
    endpoint: admin.origin + '/api/visitor',
    statsEndpoint: admin.origin + '/api/visitor-stats',
    connectionEndpoint: admin.origin + '/api/connection',
    requestTimeoutMs: 6000,
  };

  const skillCategories = [
    { value: 'office', label: 'OA' },
    { value: 'languages', label: '언어' },
    { value: 'engineering', label: '공학 도구' },
  ];
  const skillGroups = [
    { value: 'development', label: '개발 · 협업' },
    { value: 'security-analysis', label: '보안 분석 · 진단' },
    { value: 'security-solutions', label: '보안 솔루션' },
    { value: 'systems', label: '시스템 · 가상화' },
    { value: 'cloud-data', label: '클라우드 · 데이터' },
  ];
  const skillLevels = ['상', '중', '하', '미정'];
  const siteFeatures = [
    { key: 'posts', label: '글 페이지', description: '글 메뉴와 공개 글 열기' },
    { key: 'studyMap', label: '공부 기록 연결 지도', description: '글 페이지의 주제별 연결 지도' },
    { key: 'resources', label: '자료실', description: '자료실 메뉴와 공식 자료 목록' },
    { key: 'chatbot', label: 'AI 안내 챗봇', description: '포트폴리오 질문과 답변' },
    { key: 'terminal', label: '터미널', description: '명령어로 포트폴리오 탐색' },
    { key: 'intro', label: '자물쇠 인트로', description: '첫 화면의 잠금 해제 애니메이션' },
    { key: 'motion', label: '화면 모션', description: '인트로·방패·연결선·스크롤 전환 효과' },
    { key: 'security', label: '보안 연결 시각화', description: '연결 흐름도와 방패 표시' },
    {
      key: 'visitorInfo',
      label: '방문자 접속 정보',
      description: '방문자 자신의 시간·IP·국가 표시',
    },
    {
      key: 'visitorStatistics',
      label: '국가별 방문 지도',
      description: '국가별 방문 집계와 지도 표시',
    },
  ];

  globalThis.PortfolioConfig = {
    sections,
    logoOptions,
    editorLabels,
    github,
    chatbot,
    admin,
    visitor,
    skillCategories,
    skillGroups,
    skillLevels,
    siteFeatures,
  };
})();
