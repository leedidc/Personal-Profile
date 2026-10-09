(() => {
  'use strict';

  // 화면 분류, 기본 로고, 저장 위치는 이 파일에서 관리합니다.
  const sections = [
    { key: 'education', title: '학력', columns: ['학교', '기간', '전공 · 학위'] },
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
    { key: 'projects', title: '프로젝트', columns: ['프로젝트', '기간', '내용'] },
    { key: 'activities', title: '대외활동', columns: ['기관 · 활동', '기간', '내용'] },
    { key: 'awards', title: '수상', columns: ['수상명', '수상일', '수여기관'] },
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

  window.PortfolioConfig = { sections, logoOptions, editorLabels, github };
})();
