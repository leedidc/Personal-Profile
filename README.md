# Chanhyeong Lee — Portfolio

Information security portfolio built with static HTML, CSS, and vanilla JavaScript. No build step or package installation is required. Serve the repository with a local static server (for example, your editor's Live Server) to preview the site.

## Pages

- `index.html`: introduction, selected work, experience, expertise, research, education, credentials, and activities.
- `html/article.html`: technical notes fetched from the existing articles API.
- `html/article-view.html`: article detail selected by the `id` query parameter.
- `html/certification.html`: complete credential list and validity dates.
- `html/admin.html`: existing token-based article management and Quill editor.

## Editing and languages

Public pages and the administration UI share `css/portfolio.css` and `js/i18n.js`. Korean is the initial language; the selection is saved under `portfolio_language` in localStorage and retained across pages. If storage is unavailable, switching still works for the current page. Without JavaScript, static portfolio content remains available in English.

English text is the HTML fallback. Add its Korean equivalent to `data-ko` on the same leaf element. Use `data-ko-placeholder` for inputs and `data-ko-aria` for accessible labels. Do not put `data-ko` on a parent containing links or other markup: translation replaces its text content. Dynamic scripts use `portfolioI18n.text(ko, en)` and respond to `languagechange`.

Article titles and body content remain in their authored language. Chat replies are supplied by the existing API; changing the UI language does not translate a conversation.

Edit portfolio copy in `index.html`. Edit credential dates and renewal periods in `html/certification.html`; `js/certificate.js` calculates validity from `data-date`, optional `data-last-update`, and `data-years` (zero means no expiry). Review dates against issuer records when updating them; the original pages contained differing issue dates, and the existing detail-page dates were retained.

## Integrations

- Articles: `https://profile-article-database.leedidc1227.workers.dev/articles`
- Admin verification: `/verify-admin` on the same Worker. Write requests retain the existing Bearer-token contract.
- Chat: `https://chatbot.leedidc1227.workers.dev`, POST `{ message }`, response `{ reply }`.
- Backend implementation is outside this repository.
- `CNAME` retains the existing custom domain.

`image/` holds organization images; `issuer/` holds credential logos. `css/article.css`, `css/certification.css`, and `css/chatbot.css` provide feature styles. The earlier `css/style.css`, `css/skill.css`, `js/skill.js`, and `js/experience.js` remain as legacy assets and are no longer loaded by the redesigned pages. The new expertise section describes work experience in place of numerical skill scores.

## Responsive behavior

The header keeps navigation and language controls available on phones. Grids collapse to a single column below 680px; long text wraps; chat height follows the dynamic viewport. Keyboard focus, native expandable experience details, a skip link, and reduced-motion preferences are supported.