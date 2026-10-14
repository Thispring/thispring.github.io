(function () {
  var root = document.documentElement;
  var langButtons = document.querySelectorAll('[data-set-lang]');
  var themeToggle = document.querySelector('.theme-toggle');

  // ----- 테마 전환 (system: 시스템 설정 따름) -----
  var THEMES = ['system', 'light', 'dark'];
  var THEME_LABELS = {
    ko: { system: '테마: 시스템 설정', light: '테마: 라이트', dark: '테마: 다크' },
    en: { system: 'Theme: System', light: 'Theme: Light', dark: 'Theme: Dark' }
  };

  function updateThemeLabel() {
    var label = THEME_LABELS[root.lang === 'en' ? 'en' : 'ko'][themeToggle.dataset.mode];
    themeToggle.setAttribute('aria-label', label);
    themeToggle.title = label;
  }

  function setTheme(theme) {
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', theme);
    } catch (e) {}
    themeToggle.dataset.mode = theme;
    updateThemeLabel();
  }

  themeToggle.addEventListener('click', function () {
    var next = THEMES[(THEMES.indexOf(themeToggle.dataset.mode) + 1) % THEMES.length];
    setTheme(next);
  });

  // ----- 언어 전환 -----
  function setLang(lang) {
    root.lang = lang;
    try { localStorage.setItem('lang', lang); } catch (e) {}
    langButtons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.setLang === lang));
    });
    updateThemeLabel();
  }

  langButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setLang(btn.dataset.setLang); });
  });
  setTheme(root.dataset.theme || 'system');
  setLang(root.lang === 'en' ? 'en' : 'ko');

  // ----- 모바일 메뉴 -----
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('menu');

  function closeMenu() {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    var open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  // ----- 푸터 연도 -----
  document.getElementById('year').textContent = new Date().getFullYear();
})();
