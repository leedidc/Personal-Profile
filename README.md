# 이찬형 포트폴리오

한국어 포트폴리오와 GitHub에 직접 저장하는 관리자 화면입니다. HTML, CSS, JavaScript만 사용하며 빌드 과정이나 서버 설치 없이 GitHub Pages에서 동작합니다.

## 화면

- index.html: 학력, 경력, 자격, 프로젝트, 대외활동을 가로형 표로 표시합니다. 모바일에서는 로고·이름 아래에 기간과 내용을 배치합니다.
- /admin/ (admin/index.html): 항목 추가·수정·삭제, 순서 변경, 로고 선택·업로드, 프로필 수정, 미리보기, 사이트 저장.
- html/certification.html: 첫 화면의 자격 목록으로 이동하는 이전 주소입니다.
- 기존 기술 글과 게시글 관리 화면은 html/article.html, html/article-view.html, html/admin.html에 남아 있습니다.

GitHub Pages는 /admin을 /admin/으로 연결합니다. 저장소의 기존 CNAME을 유지합니다.

## 관리자 사용

1. [GitHub 토큰 만들기](https://github.com/settings/personal-access-tokens/new)에서 fine-grained personal access token을 만듭니다.
2. Resource owner는 leedidc, Repository access는 **Only select repositories → Personal-Profile**을 선택합니다.
3. Repository permissions에서 **Contents: Read and write**를 선택합니다. Metadata 읽기 권한도 포함됩니다.
4. 사이트 주소 뒤에 /admin을 붙이고 토큰으로 로그인합니다.
5. 학력·경력·자격·프로젝트·대외활동 중 하나를 선택하고 **+ 추가** 또는 **수정**을 누릅니다.
6. 로고는 기존 목록에서 선택하거나 PNG·JPG·WebP 파일을 업로드할 수 있습니다. 5MB 이하 이미지를 최대 160px로 줄여 데이터에 포함합니다. HTTPS 이미지 주소도 사용할 수 있습니다.
7. **적용**으로 편집 내용을 반영하고 **미리보기**로 확인합니다. **사이트에 저장**을 누르면 main 브랜치의 data/portfolio.json이 커밋되며 GitHub Pages 배포 후 공개 화면에 반영됩니다.

토큰은 열린 관리자 페이지 메모리에만 유지합니다. 파일, 쿠키, localStorage, sessionStorage에 저장하지 않으므로 새로고침하면 다시 로그인해야 합니다. **적용**만 누른 내용은 아직 저장되지 않았으며, 저장하지 않고 페이지를 떠나면 브라우저가 확인합니다.

저장은 GitHub Contents API와 기존 파일 SHA를 사용합니다. 다른 편집으로 파일이 변경되면 덮어쓰지 않고 충돌을 표시합니다. 이때 편집 내용을 별도로 보관한 후 **새로 불러오기**로 최신 내용을 받아 수정합니다. API 오류가 나도 화면의 편집 내용은 유지됩니다. 쓰기 권한·토큰 만료·브랜치 보호 정책은 GitHub가 검사합니다. GitHub에 저장한 이력은 저장소의 커밋 내역에서 확인할 수 있습니다.

API 계약: [GitHub 저장소 콘텐츠 API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).

## 내용과 파일

- data/portfolio.json: 프로필과 다섯 목록의 단일 데이터 원본.
- js/portfolio-core.js: 데이터 검증, 안전한 URL·텍스트 처리, 공통 표 표시.
- js/portfolio.js: 공개 화면과 현재 메뉴 표시.
- js/portfolio-editor.js: 편집, 로고 업로드, GitHub 인증·저장.
- css/resume.css, css/editor.css: 공개 화면과 관리자 화면 스타일.

PDF 이력서의 경력·학력·자격·활동·회사 프로젝트를 반영했습니다. PDF에 없는 개인정보 확장 프로그램, IREB 자격, 개인정보보호위원회 국민평가단, DIDC 배치 기간은 기존 사이트 내용을 유지했습니다. PDF와 기존 사이트의 자격 취득일이 다른 경우 PDF의 연·월을 우선했습니다. 회사 프로젝트의 정확한 기간은 원문에 없어 비워 두었습니다.

PDF 원본, 연봉, 집 주소, 전화번호, 자격 식별번호는 저장소에 추가하지 않았습니다.

학교·회사·기존 자격 발급기관 로고는 저장소의 image/, issuer/를 사용합니다. 추가 로고의 출처:

- CSA: [공식 사이트](https://cloudsecurityalliance.org/)의 CSA RGB 로고 → issuer/csa.svg
- ICQA: [공식 사이트](https://www.icqa.or.kr/cn/)의 로고 → issuer/icqa.png
- ISTQB: [공식 사이트](https://istqb.org/)의 헤더 로고 → issuer/istqb.svg

## 로컬 확인

저장소 루트에서 정적 서버를 실행합니다. 파일을 직접 여는 file:// 방식은 JSON 요청을 차단하므로 사용하지 않습니다.

~~~sh
python -m http.server 8000
~~~

http://localhost:8000/ 과 http://localhost:8000/admin/ 을 확인합니다.

브라우저 검증:

~~~sh
uv run --with playwright python -X utf8 tests/browser_check.py
~~~

Windows에 설치된 Chrome을 우선 사용하며, 그 외 환경에서는 Playwright Chromium이 필요합니다. 테스트는 GitHub 응답을 모의하므로 실제 저장소를 변경하지 않습니다. 공개 목록·이미지, 1440/390/320px 화면, 상세 펼치기, 관리자 접근, 추가·수정·삭제·순서 변경, 로고 업로드, 미리보기, 권한 오류·충돌 시 편집 유지, UTF-8 저장, 로그아웃을 확인합니다. 캡처는 Git에서 제외한 .test-artifacts/에 저장됩니다.
