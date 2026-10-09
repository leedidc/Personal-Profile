# 이찬형 포트폴리오

한국어 포트폴리오와 GitHub에 직접 저장하는 관리자 화면입니다. HTML, CSS, JavaScript만 사용하며 빌드 과정이나 서버 설치 없이 GitHub Pages에서 동작합니다.

## 화면

- index.html: 이름·연락처·자기소개·관심분야 아래에 학력, 경력, 자격, 어학, 프로젝트, 대외활동, 수상을 가로형 표로 표시합니다. 모바일에서는 로고·이름 아래에 기간과 내용을 배치합니다.
- /admin/ (admin/index.html): 항목 추가·수정·삭제, 순서 변경, 로고 선택·업로드, 프로필 수정, 미리보기, 사이트 저장.
- html/certification.html: 첫 화면의 자격 목록으로 이동하는 이전 주소입니다.
- /posts/: 제목·게시일·관리자가 만든 분류를 표시하는 글 목록. 분류 필터와 제목 검색을 지원합니다.
- /posts/view.html?id=글-ID: 글 본문을 읽는 별도 페이지.
- /admin/posts.html: 서식 편집, 이미지 삽입, 초안 보관, 분류 관리, 글 게시·수정·삭제.
- html/article.html, html/article-view.html, html/admin.html은 새 글 페이지로 이동하는 이전 주소입니다. 기존 글 ID도 연결합니다.

GitHub Pages는 /admin을 /admin/으로 연결합니다. 저장소의 기존 CNAME을 유지합니다.

## 관리자 사용

1. [GitHub 토큰 만들기](https://github.com/settings/personal-access-tokens/new)에서 fine-grained personal access token을 만듭니다.
2. Resource owner는 leedidc, Repository access는 **Only select repositories → Personal-Profile**을 선택합니다.
3. Repository permissions에서 **Contents: Read and write**를 선택합니다. Metadata 읽기 권한도 포함됩니다.
4. 사이트 주소 뒤에 /admin을 붙이고 토큰으로 로그인합니다.
5. 학력·경력·자격·어학·프로젝트·대외활동·수상 중 하나를 선택하고 **+ 추가** 또는 **수정**을 누릅니다.
6. 로고는 기존 목록에서 선택하거나 PNG·JPG·WebP 파일을 업로드할 수 있습니다. 5MB 이하 이미지를 최대 160px로 줄여 데이터에 포함합니다. HTTPS 이미지 주소도 사용할 수 있습니다.
7. **적용**으로 편집 내용을 반영하고 **미리보기**로 확인합니다. **사이트에 저장**을 누르면 main 브랜치의 data/portfolio.json이 커밋되며 GitHub Pages 배포 후 공개 화면에 반영됩니다.

토큰은 열린 관리자 페이지 메모리에만 유지합니다. 파일, 쿠키, localStorage, sessionStorage에 저장하지 않으므로 새로고침하면 다시 로그인해야 합니다. **적용**만 누른 내용은 아직 저장되지 않았으며, 저장하지 않고 페이지를 떠나면 브라우저가 확인합니다.

각 항목의 **표시 순서**에서 원하는 위치를 선택하거나 **↑·↓** 버튼으로 한 칸씩 이동합니다. 자격·경력을 포함한 모든 목록에 적용되며, 저장한 순서는 공개 화면과 미리보기에서도 유지됩니다. 프로젝트는 개인·회사로 나눈 뒤 각 그룹 안에서 지정한 순서를 따릅니다.

관리자에서 저장한 내용·표시 순서·삭제 상태를 이후 개발 작업에서도 유지합니다. 작업 시작 전과 푸시 직전에 최신 원격 데이터를 비교하고, 기능·디자인 변경만 하는 경우 콘텐츠 JSON을 다시 만들지 않습니다. 콘텐츠 변경은 기존 ID를 기준으로 요청받은 항목만 수정합니다. 관리자가 지운 항목은 이전 이력서나 커밋에서 자동으로 다시 추가하지 않습니다.

2026.10.09 사용자 정정으로 자격 앞부분을 **개인정보영향평가 전문인력 → 정보보안기사 → 정보처리기사 → 빅데이터분석기사 → 산업보안관리사 → 개인정보관리사(CPPG)** 순서로 복구했습니다. 나머지는 클라우드·보안(CCSK, Microsoft), 테스트·요구공학(ISTQB 2개, CSTS, CPRE), 데이터(ADsP, SQLD), 시스템·네트워크(리눅스마스터, 네트워크관리사, RFID) 순서로 관련 자격끼리 배치했습니다. PC정비사·지능형홈관리사·소프트웨어자산관리사는 사용자가 삭제한 상태를 복구해 제외했습니다. 이 순서는 초기 정정 기록이며, 이후 관리자에서 변경한 순서를 우선합니다.

**프로필 수정**에서 이름·영문 이름·이메일·GitHub·LinkedIn·자기소개·관심분야를 편집합니다. 관심분야는 한 줄에 하나씩 입력합니다. 자기소개나 관심분야를 비우면 해당 부분은 표시하지 않습니다. 상단 이니셜은 영문 이름에서 자동으로 만들며, 영문 이름이 없으면 이름의 첫 글자를 사용합니다. 이름과 GitHub 주소를 바꾸면 메뉴·하단 표시와 상단 링크에도 반영됩니다.

회사·학교는 한글 이름 위주로 표시하고 바로 아래에 영문 전체 명칭을 적습니다. 한글 자격은 정식 명칭 아래에 영문명을 표시하며, 영문 자격은 전체 명칭을 한 번만 표시합니다. SQL·PC·RFID·AI처럼 정식 명칭에 포함된 표기는 유지합니다. 관리자 목록에서도 명칭·영문명·내용·기간을 확인할 수 있습니다. 학력의 **영문 전공 · 학위**, 경력의 **영문 부서 · 직책**은 입력하면 내용 바로 아래에 표시됩니다.

학력 편집의 **이수과목** 입력란에 한 줄에 한 과목씩 적습니다. 공개 화면의 **이수과목**을 누르면 목록을 펼치거나 접을 수 있습니다. 3개 이하인 목록은 처음부터 펼쳐집니다.

자격 편집에는 **자격증 번호**, 어학 편집에는 **등록번호** 입력란이 있습니다. 입력한 번호의 마지막 3자리 이상을 제거하고, 앞부분은 최대 12자까지만 남겨 뒤에 \*\*\*를 붙입니다. 이미 마스킹된 번호는 그대로 유지됩니다. 짧은 번호는 전부 가립니다. 공개 JSON과 GitHub 저장 요청에는 마스킹된 값만 포함하며, 원문 번호는 보관하지 않습니다. 번호를 입력하지 않은 항목은 번호 열에 `—`로 표시합니다.

저장은 GitHub Contents API와 기존 파일 SHA를 사용합니다. 다른 편집으로 파일이 변경되면 덮어쓰지 않고 충돌을 표시합니다. 이때 편집 내용을 별도로 보관한 후 **새로 불러오기**로 최신 내용을 받아 수정합니다. API 오류가 나도 화면의 편집 내용은 유지됩니다. 쓰기 권한·토큰 만료·브랜치 보호 정책은 GitHub가 검사합니다. GitHub에 저장한 이력은 저장소의 커밋 내역에서 확인할 수 있습니다.

API 계약: [GitHub 저장소 콘텐츠 API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).

## 내용과 파일

### 글 작성과 게시

1. 포트폴리오 상단의 **글**을 누르면 공개 목록이 열립니다. 관리자 화면의 **글 관리** 또는 `/admin/posts.html`에서 같은 GitHub 토큰으로 로그인합니다.
2. **분류**에 이름을 입력하고 **분류 추가 → 분류 저장**을 누릅니다. 분류 이름을 바꾸면 그 분류를 사용하는 글에도 적용됩니다. 글 또는 이 브라우저의 초안에서 사용 중인 분류는 먼저 글의 분류를 바꾼 후 삭제합니다.
3. **새 글**에서 제목·게시일·분류를 선택하고 본문을 작성합니다. 제목 서식, 굵게·기울임·밑줄·취소선, 글자색·강조색, 번호·글머리·체크 목록, 정렬, 인용, 코드 블록, HTTPS 링크, 실행 취소·다시 실행을 지원합니다.
4. 그림 버튼, 붙여넣기 또는 끌어 놓기로 PNG·JPEG·WebP 이미지를 넣습니다. 입력 파일은 15MB 이하이며, 긴 변 1600px 이하의 WebP로 줄여 본문에 포함합니다. **글 한 편은 이미지 포함 3MB까지**입니다.
5. 작성 중인 글은 약 0.8초 후 이 브라우저의 IndexedDB에 자동 보관됩니다. **초안 보관**으로 즉시 보관할 수도 있습니다. 초안은 공개하거나 GitHub에 올리지 않습니다. 새로고침 후 다시 로그인하고 왼쪽 초안 목록에서 열면 본문·이미지·분류를 복구합니다. 아직 저장하지 않은 새 분류도 초안과 함께 복구됩니다.
6. 브라우저 데이터 삭제나 다른 기기 사용에 대비하려면 **초안 내려받기**로 JSON 파일을 보관합니다. **초안 파일 불러오기**로 복원할 수 있습니다. 토큰은 초안과 파일에 포함하지 않습니다. 저장 공간 부족 시 화면에 오류를 표시하고 현재 편집 내용을 유지합니다.
7. **미리보기**로 확인한 뒤 **게시하기**를 누릅니다. 게시일은 표시용이며 예약 게시 기능은 아닙니다. **수정 게시**는 이미 게시한 글을 갱신합니다. GitHub Pages 배포 후 공개 화면에 반영됩니다. **글 삭제**는 본문과 목록을 함께 제거하며, 별도로 보관한 초안은 남깁니다.

글 저장은 [Git 트리 API](https://docs.github.com/en/rest/git/trees#create-a-tree)와 [브랜치 참조 API](https://docs.github.com/en/rest/git/refs#update-a-reference)를 사용합니다. 불러온 커밋과 트리 SHA를 기준으로 목록·본문을 하나의 커밋에 저장하고 `force: false`로 갱신합니다. 다른 변경사항이 생기면 덮어쓰지 않고 오류를 표시합니다. **새로 불러오기**는 목록만 갱신하므로 현재 초안은 유지됩니다. 기존 글의 오래된 초안은 자동으로 덮어쓰지 못하게 막습니다. 초안을 내려받아 보관하고, 게시한 최신 글을 열어 필요한 변경사항을 옮긴 뒤 게시하세요.

본문은 [Quill 2.0.3](vendor/quill/README.md)의 Delta JSON으로 보관합니다. 공개 화면과 미리보기는 허용된 서식만 DOM으로 만들고 텍스트는 `textContent`로 표시합니다. 임의 HTML, 스크립트 URL, SVG 업로드는 허용하지 않습니다. 토큰은 열린 페이지 메모리에만 유지하며 새로고침·로그아웃 시 다시 입력합니다.

이전 글 API에 있던 3개 글(`test`, `create`, `SC-200 Study Notes`)의 본문·이미지·게시일을 `legacy-4`, `legacy-2`, `legacy-1`로 옮겼습니다. 기존 Microsoft 분류와 분류가 없던 글의 상태도 유지합니다. 이전 API의 데이터는 변경하지 않았으며 이후 관리는 GitHub 데이터로 합니다.

### 파일 역할

직접 편집할 때는 아래 표에서 수정할 부분에 맞는 파일을 찾으면 됩니다. 파일명은 기능 이름(`portfolio`, `posts`)과 역할(`config`, `editor`, `github`, `drafts`)을 조합합니다. JSON 배열의 순서가 화면 순서이므로 이름·날짜를 수정할 때 배열을 정렬하지 않습니다.

| 수정할 부분                       | 열 파일                                    | 찾을 항목                                        |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| 이름·연락처·자기소개              | data/portfolio.json                        | profile                                          |
| 자격·어학·대외활동 내용과 순서    | data/portfolio.json                        | certifications, languages, activities            |
| 메뉴 이름·관리자 필드·로고 선택지 | js/portfolio-config.js                     | sections, editorLabels, logoOptions              |
| 색상·글꼴·상단 메뉴·포트폴리오 표 | css/site-common.css                        | :root와 각 화면 클래스                           |
| 관리자 로그인·입력란·편집 창      | css/admin-common.css                       | .login-card, .field, dialog                      |
| 포트폴리오 편집 동작              | js/portfolio-editor.js                     | 항목 편집·순서 변경·미리보기 함수                |
| GitHub 불러오기·저장              | js/portfolio-github.js, js/posts-github.js | loadPortfolio, savePortfolio, loadSnapshot, save |
| 글 읽기·글 편집 화면              | css/posts.css, css/posts-editor.css        | 본문과 편집기 스타일                             |

세부 역할은 다음과 같습니다.

- data/portfolio.json: 프로필과 일곱 목록의 단일 데이터 원본. 자기소개는 `profile.introduction`, 관심분야는 `profile.interests` 배열, 영문 전공·학위는 학력 항목의 `summaryEnglish`에서 관리합니다.
- js/portfolio-config.js: 화면 분류, 편집 필드 이름, 기본 로고, GitHub 저장 위치.
- js/portfolio-core.js: 데이터 검증, 안전한 URL·텍스트 처리, 공개 화면과 미리보기의 공통 프로필·표 표시.
- js/portfolio.js: 공개 화면과 현재 메뉴 표시.
- js/portfolio-editor.js: 편집 화면, 로고 업로드, 미리보기.
- js/portfolio-github.js: GitHub 접근 확인·불러오기·저장 및 오류 처리.
- css/site-common.css: 사이트 공통 색상·글꼴·헤더와 포트폴리오 표. css/admin-common.css: 포트폴리오·글 관리자가 공유하는 로그인·입력란·편집 창 스타일.
- data/posts/index.json: 분류 `{id, name}`와 글 목록 `{id, title, date, categoryId}`. 분류 ID가 빈 문자열이면 미분류입니다.
- data/posts/{id}.json: 글 본문 `{version: 1, id, content: {ops: [...]}}`. 글 목록은 본문과 이미지를 내려받지 않으므로 가볍게 열립니다.
- js/posts-core.js: 글 데이터·URL·서식 검증과 본문 표시.
- js/posts.js: 공개 글 목록·검색·필터·읽기 화면.
- js/posts-editor.js: 관리자 분류·초안·게시 흐름.
- js/posts-rich-editor.js: Quill 설정, 링크·이미지 편집, 붙여넣기 처리.
- js/posts-drafts.js: 이 브라우저의 IndexedDB 초안 보관.
- js/posts-github.js: GitHub 접근 확인과 여러 글 파일의 동시 저장.
- js/posts-redirect.js: 이전 글 ID를 새 주소로 연결.
- css/posts.css, css/posts-editor.css: 글 읽기와 글 관리 스타일.
- vendor/quill/: 고정 버전의 편집기와 라이선스. CDN 연결 없이 동작합니다.

PDF 이력서의 경력·학력·자격·활동·수상·회사 프로젝트를 반영했습니다. 개인정보 확장 프로그램, IREB 자격, DIDC 배치 기간은 기존 사이트 내용을 유지했습니다. 자격명·취득일·발급기관은 사용자가 마지막으로 제공한 자격 목록을 우선하며, 번호를 제공하지 않은 기존 CCSK·SC-900도 유지합니다. 회사 프로젝트의 정확한 기간은 원문에 없어 비워 두었습니다. 수상 4건의 명칭·수상일·수여기관과 관련 논문명은 PDF를 기준으로 작성했습니다.

숭실대 이수과목 10개와 자문단·개인정보 처리방침 평가단·사이버 명예경찰·블록체인 누리단의 기간·활동 내용, IBK기업은행·한국산업은행 인턴 기간은 사용자가 제공한 「ETRI 기술직-정보보호.pdf」를 참고했습니다. 문서에 날짜가 있는 항목은 `YYYY.MM.DD – YYYY.MM.DD`로 표기하고, 월만 확인되는 기존 활동은 월 단위를 유지합니다. 기존에 반영한 최신 학점·졸업 상태·자격 취득일은 이전 지원서 내용으로 덮어쓰지 않습니다. TOEIC 800점과 취득일 2026.08.30은 사용자가 마지막으로 제공한 정보를 따릅니다.

사이버 명예경찰(`act-police`)의 소속은 사용자 정정에 따라 **경기남부경찰청**으로 표기합니다. 제공한 지원서에서 활동명과 기간(2025.04.18 – 2026.04.17)을 다시 확인했으며, 기관명은 [경기남부경찰청 공식 사이트](https://www.ggpolice.go.kr/main/)의 표기와 맞췄습니다. 기존 경찰 로고를 사용합니다.

ASU 과목명은 [공식 MS Information Technology 교육과정](https://degrees.asu.edu/masters-phd/major/ASU00/TSIFTMS/information-technology-ms)에서 확인했습니다. 사용자가 IFT 501을 IFT 510으로 정정한 내용을 반영해 `IFT 510 — Principles of Computer and Information Technology Architecture`, `IFT 520 — Advanced Information Systems Security`를 기록합니다. 학력의 `courses` 배열에서 과목을 편집할 수 있습니다.

이메일은 사용자가 정정한 `leedidc1227@gmail.com`을 사용합니다. 자기소개는 제공한 이력서의 업무와 개발 경험을 요약했으며, 관심분야는 같은 자료의 개인정보보호 정책·클라우드 보안·국가망보안체계 연구와 실무 내용을 바탕으로 정리했습니다.

자격 명칭은 [Microsoft](https://learn.microsoft.com/credentials/certifications/security-compliance-and-identity-fundamentals/), [ISTQB 보안 테스트](https://istqb.org/certifications/certified-tester-security-test-engineer/), [ISTQB AI 테스트](https://istqb.org/certifications/certified-tester-ai-testing-ct-ai/), [IREB](https://cpre.ireb.org/en), [TTA](https://edu.tta.or.kr/edu/contents.do?key=57), [산업보안관리사 등록 정보](https://www.pqi.or.kr/inf/qul/infQulBasDetail.do?qulId=742), [Q-Net 정보처리기사](https://www.q-net.or.kr/crf005.do?id=crf00505&jmCd=1320), [Q-Net 정보보안기사](https://www.q-net.or.kr/crf005.do?id=crf00505&jmCd=1325), [데이터자격 안내](https://www.dataq.or.kr/www/dataq_brochure_2022.pdf), [소프트웨어자산관리사](https://www.spc.or.kr/en/business/csam/sw_sub3211), [리눅스마스터](https://www.ihd.or.kr/introducesubject1.do), [개인정보관리사](https://cpptest.or.kr/new/privacy/cpp2.php) 자료를 참고했습니다. 취득일과 등급은 사용자 자료를 유지하며 최신 시험 버전이나 새 등급을 추가하지 않습니다.

공식 영문 표기를 확인하지 못한 개인정보영향평가 전문인력·PC정비사·지능형홈관리사·네트워크관리사의 영문 보조명과 정보보호 융합전공의 영문은 한국어 명칭을 풀어 쓴 설명 번역입니다. 발급기관의 공식 영문 자격명으로 단정하지 않으며, 자격증에 적힌 영문명을 확인하면 관리자에서 교체할 수 있습니다.

PDF 원본, 연봉, 집 주소, 전화번호, 자격증 번호·어학 등록번호 원문은 저장소에 추가하지 않았습니다. 자격·어학 번호는 `maskedNumber` 필드에 마스킹된 값만 저장합니다.

학교·회사·기존 자격 발급기관 로고는 저장소의 image/, issuer/를 사용합니다. 추가 로고의 출처:

- TOEIC: [ETS 공식 사이트](https://www.ets.org/toeic.html)의 TOEIC 로고 → issuer/toeic.svg
- YBM: [YBM 공식 사이트](https://www.ybm.co.kr/)의 [상단 로고 원본](https://imagesisa.ybmnet.co.kr/platform/www_ybmnet/201705/logo_fix.png) → issuer/ybm.png. 사용자 요청에 따라 TOEIC 항목에는 이 로고를 사용합니다.
- 경찰청: [공식 사이트](https://www.police.go.kr/index.do)의 헤더 로고 → image/police.png
- CSA: [공식 사이트](https://cloudsecurityalliance.org/)의 CSA RGB 로고 → issuer/csa.svg
- ICQA: [공식 사이트](https://www.icqa.or.kr/cn/)의 로고 → issuer/icqa.png
- ISTQB: [공식 사이트](https://istqb.org/)의 헤더 로고 → issuer/istqb.svg
- 행정안전부: [공식 사이트](https://www.mois.go.kr/frt/sub/a07/miBanner/screen.do)의 로고 → image/mois.png
- 한국정보보호학회: [공식 사이트](https://kiisc.or.kr/)의 로고 → image/kiisc.png
- DB김준기문화재단: [공식 사이트](https://www.dbfoundation.or.kr/intro/summary)의 로고 → image/db-foundation.png
- 한국소프트웨어저작권협회: [공식 사이트](https://www.spc.or.kr/ko/introduction/sw_sub17)의 로고 → issuer/spc.png

## 로컬 확인

저장소 루트에서 정적 서버를 실행합니다. 파일을 직접 여는 file:// 방식은 JSON 요청을 차단하므로 사용하지 않습니다.

```sh
python -m http.server 8000
```

http://localhost:8000/ 과 http://localhost:8000/admin/ 을 확인합니다.

번호 마스킹 및 GitHub 전송 검증(Node.js):

```sh
node --test tests/credential-number.test.cjs
node --test tests/posts.test.cjs
```

브라우저 검증:

```sh
uv run --with playwright python -X utf8 tests/browser_check.py
```

Windows에 설치된 Chrome을 우선 사용하며, 그 외 환경에서는 Playwright Chromium이 필요합니다. 테스트는 GitHub 응답을 모의하므로 실제 저장소를 변경하지 않습니다. 공개 목록·이미지, 1440/390/320px 화면, 이수과목·상세 펼치기, 어학 등록번호 마스킹, 관리자 접근, 추가·수정·삭제·순서 선택, 로고 업로드, 프로필 전체 편집, 미리보기, 권한 오류·충돌 시 편집 유지, UTF-8 저장, 로그아웃·재로그인 후 순서와 프로필 유지를 확인합니다. 자기소개·관심분야의 HTML 입력을 텍스트로 표시하는지, 빈 항목을 숨기는지, 새 필드가 없는 이전 데이터도 열리는지 검증합니다. 캡처는 Git에서 제외한 .test-artifacts/에 저장됩니다.

## 코드 편집 기준

글 검사는 `tests/posts_browser_check.py`를 통해 같은 브라우저 검사에서 실행합니다. 기존 글 이전·이미지 보존, 목록 필터·검색·본문, 서식·이미지 업로드·미리보기, 초안 복구, 분류 수정·삭제 제한, 글 게시·수정·삭제, 충돌 시 보존, 접근 권한과 모바일 너비를 확인합니다. GitHub 저장은 모의 응답만 사용합니다.

파일 역할과 작업 규칙은 [AGENTS.md](AGENTS.md)에 정리했습니다. HTML·CSS·JavaScript는 2칸, Python은 4칸 들여쓰기와 UTF-8·LF를 사용합니다. CSS 속성과 JavaScript 문장은 한 줄씩 작성하고 함수·변수 이름에 역할을 드러냅니다.

문구·경력 등 내용은 data/portfolio.json, 메뉴·로고·저장소 설정은 js/portfolio-config.js에서 수정합니다. 화면 스타일은 css/site-common.css와 css/admin-common.css에서 수정합니다. 화면 표시와 GitHub 통신은 별도 파일로 관리합니다.

[Prettier 설정](https://prettier.io/docs/configuration)은 .prettierrc.json, 편집기 기본 규칙은 .editorconfig에 있습니다. Node.js/npm을 사용할 수 있는 환경에서 수정한 파일에 다음 명령을 실행합니다. 서식 도구는 개발할 때만 사용하며 사이트 실행에는 필요하지 않습니다.

```sh
npx prettier@3.6.2 --write index.html admin/index.html "js/portfolio*.js" css/site-common.css css/admin-common.css
npx prettier@3.6.2 --check index.html admin/index.html "js/portfolio*.js" css/site-common.css css/admin-common.css
```
