# Personal Profile

정보보안 담당자 이찬형의 경력, 교육 이수현황, 기술, 프로젝트와 대외·연구 활동을 소개하는 개인 포트폴리오 웹사이트입니다. 게시글과 관리자 편집, 공식 보안 자료실, AI 안내 챗봇, 터미널 탐색, 자물쇠 인트로, 연결 보안 시각화와 국가별 방문 지도를 제공합니다.

자료실의 분류·목록·출처·판본·다운로드 링크·확인일은 [data/resources.json](data/resources.json)에서 편집합니다.

공식 자료는 [자동 점검 코드](scripts/check_resource_updates.py)와 [GitHub Actions](https://github.com/leedidc/Personal-Profile/actions/workflows/resource-updates.yml)로 매일 09:17(KST)에 확인합니다. 공개 자료실에는 기준일·점검일만 표시하고, 상세 기록은 로그인 후 **관리자 → 자료실 점검**에서 확인합니다.

[웹사이트 방문](https://lee.chanhyeong.kro.kr/)

## 기술 스택

- **프런트엔드:** HTML5, CSS3, Vanilla JavaScript, SVG
- **글 편집기:** Quill
- **데이터 저장:** JSON, IndexedDB, Cloudflare Durable Objects(국가별 방문 집계)
- **콘텐츠 관리:** GitHub REST API
- **관리자 인증·AI 챗봇·방문자 접속 정보:** Cloudflare Workers
- **호스팅:** Cloudflare Pages, GitHub Pages, Cloudflare Workers(관리자)
- **개발·검증:** Prettier, Playwright, Node.js, Python
