(function () {
  var root = document.documentElement;
  var langButtons = document.querySelectorAll('[data-set-lang]');

  // ----- 언어 전환 -----
  function setLang(lang) {
    root.lang = lang;
    try { localStorage.setItem('lang', lang); } catch (e) {}
    langButtons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.setLang === lang));
    });
  }

  langButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setLang(btn.dataset.setLang); });
  });
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
