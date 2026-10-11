# Personal Profile

정보보안 담당자 이찬형의 경력, 교육 이수현황, 기술, 프로젝트와 대외·연구 활동을 소개하는 개인 포트폴리오 웹사이트입니다. 게시글과 관리자 편집, 공식 보안 자료실, AI 안내 챗봇, 터미널 탐색, 자물쇠 인트로, 연결 보안 시각화와 국가별 방문 지도를 제공합니다.

자료실의 분류·목록·출처·판본·다운로드 링크·확인일은 [data/resources.json](data/resources.json)에서 편집합니다.

글 페이지의 공부 기록 연결 지도는 관리자가 저장한 분류와 게시글을 자동으로 연결합니다. 표시와 배치는 [js/study-map.js](js/study-map.js), 디자인은 [css/study-map.css](css/study-map.css)에서 수정합니다.

관리자의 **섹션 관리**에서 섹션 추가·이름·공개·삭제·복원·순서를, **기능 설정**에서 글·자료실·챗봇·터미널·모션·방문 정보 등을 설정합니다. 설정과 내용은 기존 `data/portfolio.json`에 함께 저장됩니다. 관련 코드는 `js/section-manager.js`, `js/site-feature-editor.js`, `js/site-features.js`입니다.

공식 자료는 [자동 점검 코드](scripts/check_resource_updates.py)와 [GitHub Actions](https://github.com/leedidc/Personal-Profile/actions/workflows/resource-updates.yml)로 매일 09:17(KST)에 확인합니다. 공개 자료실에는 기준일·점검일만 표시하고, 상세 기록은 로그인 후 **관리자 → 자료실 점검**에서 확인합니다.

[웹사이트 방문](https://lee.chanhyeong.kro.kr/)

전용 관리자에서 **보안 · 접속 기록**으로 로그인 제한·자동 로그아웃·기록 보관 기간을 설정하고 접속·인증·저장 이력을 확인합니다. 설정과 기록은 공개 JSON 대신 인증 서버의 비공개 저장소에 보관합니다. 화면은 `js/admin-security.js`, 서버 처리는 `server/admin-auth/admin-security.js`에서 수정합니다.

## 기술 스택

- **프런트엔드:** HTML5, CSS3, Vanilla JavaScript, SVG
- **글 편집기:** Quill
- **데이터 저장:** JSON, IndexedDB, Cloudflare Durable Objects(인증·보안 기록·국가별 방문 집계)
- **콘텐츠 관리:** GitHub REST API
- **관리자 인증·AI 챗봇·방문자 접속 정보:** Cloudflare Workers
- **호스팅:** Cloudflare Pages, GitHub Pages, Cloudflare Workers(관리자)
- **개발·검증:** Prettier, Playwright, Node.js, Python
