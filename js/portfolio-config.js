(() => {
  'use strict';

  // 화면 분류, 기본 로고, 저장 위치는 이 파일에서 관리합니다.
  const sections = [
    { key: 'education', title: '학력', columns: ['학교', '기간', '전공 · 학위'] },
    { key: 'experience', title: '경력', columns: ['회사', '기간', '부서 · 업무'] },
    { key: 'certifications', title: '자격', columns: ['자격명', '취득', '발급기관'] },
    { key: 'projects', title: '프로젝트', columns: ['프로젝트', '기간', '내용'] },
    { key: 'activities', title: '대외활동', columns: ['기관 · 활동', '기간', '내용'] },
  ];
  const logoOptions = [
    ['로고 없음', ''],
    ['Arizona State University', 'image/asu.webp'],
    ['숭실대학교', 'image/ssu.png'],
    ['한국전자통신연구원', 'image/etri.jpg'],
    ['IBK기업은행', 'image/ibk.png'],
    ['한국산업은행', 'image/kdb.png'],
    ['국방통합데이터센터', 'image/didc.jpg'],
    ['개인정보보호위원회', 'image/pipc.png'],
    ['한국정보보호산업협회', 'image/kisia.png'],
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
    ['Microsoft', 'issuer/ms.png'],
    ['Cloud Security Alliance', 'issuer/csa.svg'],
    ['개인정보 확장 프로그램', 'image/extension.jpg'],
    ['직접 선택', '__custom__'],
  ];

  const editorLabels = {
    education: ['학교명', '영문 학교명 · 단과대학', '전공 · 학위'],
    experience: ['회사명', '영문명 · 약칭', '부서 · 직책'],
    certifications: ['자격명', '영문명 · 약칭', '발급기관'],
    projects: ['프로젝트명', '소속 · 구분', '프로젝트 내용'],
    activities: ['기관명', '활동명 · 소속', '활동 내용'],
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
