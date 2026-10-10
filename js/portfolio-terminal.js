(() => {
  'use strict';
  const { createElement, getSafeUrl } = Portfolio;
  const dialog = document.getElementById('portfolio-terminal');
  const launcher = document.getElementById('terminal-launcher');
  const output = document.getElementById('terminal-output');
  const input = document.getElementById('terminal-input');
  const form = document.getElementById('terminal-form');
  const touchPointer = matchMedia('(pointer: coarse)');
  let portfolio;
  let history = [];
  let historyIndex = 0;
  let draft = '';

  function addText(entry, text, style = '') {
    entry.append(createElement('p', 'terminal-response ' + style, text));
  }

  function addLink(entry, label, href) {
    const internal = href === 'posts/' || /^#[a-z-]+$/.test(href);
    const email = /^mailto:[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(href);
    const safeUrl = internal || email ? href : getSafeUrl(href);
    if (!safeUrl) {
      return;
    }
    let links = entry.querySelector('.terminal-links');
    if (!links) {
      links = createElement('div', 'terminal-links');
      entry.append(links);
    }
    const link = createElement('a', '', label);
    link.href = safeUrl;
    if (href.startsWith('#')) {
      link.addEventListener('click', () => dialog.close());
    } else if (!internal && !email) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    links.append(link);
  }

  function addSectionLink(entry, section, label) {
    if (document.getElementById(section)) {
      addLink(entry, label + ' 본문 보기 ↗', '#' + section);
    }
  }

  function showWelcome() {
    const entry = createElement('div', 'terminal-entry');
    addText(entry, portfolio.profile.name + '의 포트폴리오에 오신 것을 환영합니다.');
    addText(entry, 'whoami로 소개를, help로 명령어를 확인해 보세요.', 'is-muted');
    output.append(entry);
  }

  function clearTerminal() {
    output.replaceChildren();
    history = [];
    historyIndex = 0;
    draft = '';
    input.value = '';
    showWelcome();
  }

  function showProfile(entry) {
    const profile = portfolio.profile;
    addText(entry, [profile.name, profile.englishName].filter(Boolean).join(' / '));
    if (profile.introduction) {
      addText(entry, '\n' + profile.introduction);
    }
    if (profile.interests?.length) {
      addText(entry, '\n관심분야\n' + profile.interests.join(' · '), 'is-muted');
    }
    addSectionLink(entry, 'profile', '소개');
  }

  function showSkills(entry, query) {
    const categories = PortfolioSkills.getCategories(portfolio);
    const skills = (portfolio.skills || []).filter((skill) => {
      const category = PortfolioSkills.categoryLabel(skill, categories);
      return [skill.name, skill.description, category].join(' ').toLowerCase().includes(query);
    });
    if (!skills.length) {
      addText(entry, query ? '검색한 스킬이 없습니다.' : '등록된 스킬이 없습니다.', 'is-muted');
      return;
    }
    for (const category of categories) {
      const rows = skills.filter((skill) => skill.category === category.value);
      if (!rows.length) {
        continue;
      }
      addText(entry, '[' + category.label + ']');
      const lines = rows.map((skill) => {
        const group = category.groups.find((item) => item.value === skill.group)?.label;
        return (
          skill.name +
          ' · ' +
          skill.level +
          (group ? ' · ' + group : '') +
          (skill.description ? '\n  ' + skill.description : '')
        );
      });
      addText(entry, lines.join('\n') + '\n');
    }
    addSectionLink(entry, 'skills', '스킬');
  }

  function showProjects(entry, query) {
    const projects = portfolio.projects.filter((project) =>
      [project.name, project.summary, ...project.technologies]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
    if (!projects.length) {
      addText(
        entry,
        query ? '검색한 프로젝트가 없습니다.' : '등록된 프로젝트가 없습니다.',
        'is-muted',
      );
      return;
    }
    for (const project of projects) {
      const lines = [
        project.name,
        project.summary,
        ...project.details.map((detail) => '  · ' + detail),
      ];
      if (project.technologies.length) {
        lines.push('  ' + project.technologies.join(' / '));
      }
      addText(entry, lines.filter(Boolean).join('\n') + '\n');
    }
    addSectionLink(entry, 'projects', '프로젝트');
  }

  function showCertifications(entry) {
    const lines = portfolio.certifications.map(
      (row) => row.name + (row.period ? ' · ' + row.period : ''),
    );
    addText(entry, lines.length ? lines.join('\n') : '등록된 자격이 없습니다.');
    addSectionLink(entry, 'certifications', '자격');
  }

  function showContact(entry) {
    const profile = portfolio.profile;
    addText(entry, profile.name + '의 연락처');
    if (profile.email) {
      addLink(entry, profile.email, 'mailto:' + profile.email);
    }
    addLink(entry, 'GitHub ↗', profile.github);
    addLink(entry, 'LinkedIn ↗', profile.linkedin);
  }

  const commands = new Map([
    ['help', { description: '사용 가능한 명령어', run: showHelp }],
    ['whoami', { description: '소개와 관심분야', run: showProfile }],
    ['skills', { description: '스킬 · 검색 예: skills Python', search: true, run: showSkills }],
    [
      'projects',
      { description: '프로젝트 · 검색 예: projects Python', search: true, run: showProjects },
    ],
    ['certs', { description: '보유 자격', run: showCertifications }],
    ['contact', { description: '이메일과 소셜 링크', run: showContact }],
    [
      'posts',
      {
        description: '공부한 내용과 게시글',
        run: (entry) => addLink(entry, '글 목록 열기 ↗', 'posts/'),
      },
    ],
    ['clear', { description: '화면과 명령 기록 지우기', run: clearTerminal }],
    ['exit', { description: '터미널 닫기', run: () => dialog.close() }],
  ]);

  function showHelp(entry) {
    const lines = [...commands].map(([name, command]) => name.padEnd(10) + command.description);
    addText(entry, lines.join('\n'));
  }

  function runCommand(value) {
    const text = value.trim();
    if (!text || text.length > 120) {
      return;
    }
    history.push(text);
    history = history.slice(-30);
    historyIndex = history.length;
    draft = '';
    input.value = '';
    const [name, ...words] = text.toLowerCase().split(/\s+/);
    const command = commands.get(name);
    const entry = createElement('div', 'terminal-entry');
    entry.append(createElement('p', 'terminal-command', 'visitor@portfolio ~$ ' + text));
    if (!command) {
      addText(
        entry,
        '알 수 없는 명령어입니다. help로 사용 가능한 명령어를 확인하세요.',
        'is-error',
      );
    } else if (words.length && !command.search) {
      addText(
        entry,
        name + '만 입력해 주세요. 검색은 skills와 projects에서 사용할 수 있습니다.',
        'is-error',
      );
    } else {
      // 등록한 탐색 명령만 실행하며 입력값을 코드로 해석하지 않습니다.
      command.run(entry, words.join(' '));
    }
    if (name !== 'clear' || words.length) {
      output.append(entry);
      while (output.children.length > 24) {
        output.firstElementChild.remove();
      }
      output.scrollTop = entry.offsetTop - output.offsetTop;
    }
    if (dialog.open && !touchPointer.matches) {
      input.focus({ preventScroll: true });
    }
  }

  function updateVisibleViewport() {
    if (!dialog.open) {
      return;
    }
    const viewport = window.visualViewport;
    const keyboardOpen = viewport && viewport.scale === 1 && innerHeight - viewport.height > 120;
    dialog.classList.toggle('is-keyboard-open', Boolean(keyboardOpen));
    if (keyboardOpen) {
      dialog.style.setProperty('--terminal-viewport-height', viewport.height + 'px');
      dialog.style.setProperty('--terminal-viewport-top', viewport.offsetTop + 'px');
    }
  }

  launcher.addEventListener('click', () => {
    dialog.showModal();
    document.documentElement.classList.add('terminal-open');
    launcher.setAttribute('aria-expanded', 'true');
    updateVisibleViewport();
    if (!touchPointer.matches) {
      input.focus({ preventScroll: true });
    }
  });
  document.getElementById('terminal-close').addEventListener('click', () => dialog.close());
  document.getElementById('terminal-clear').addEventListener('click', () => {
    clearTerminal();
    if (!touchPointer.matches) {
      input.focus({ preventScroll: true });
    }
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('terminal-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus({ preventScroll: true });
  });
  dialog.querySelectorAll('[data-terminal-command]').forEach((button) => {
    button.addEventListener('click', () => runCommand(button.dataset.terminalCommand));
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runCommand(input.value);
  });
  input.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229) {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      form.requestSubmit();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === history.length) {
        draft = input.value;
      }
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + direction));
      input.value = historyIndex === history.length ? draft : history[historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (event.key === 'Tab' && !event.shiftKey && /^[a-z]+$/i.test(input.value)) {
      const matches = [...commands.keys()].filter((name) =>
        name.startsWith(input.value.toLowerCase()),
      );
      if (matches.length === 1 && input.value !== matches[0]) {
        event.preventDefault();
        input.value = matches[0];
      }
    }
  });
  window.visualViewport?.addEventListener('resize', updateVisibleViewport);
  window.visualViewport?.addEventListener('scroll', updateVisibleViewport);
  window.addEventListener('resize', updateVisibleViewport);

  function initialize(data) {
    portfolio = data;
    clearTerminal();
    launcher.hidden = false;
  }

  window.PortfolioTerminal = { initialize };
})();
