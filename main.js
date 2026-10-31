(function () {
  var root = document.documentElement;
  var windows = document.querySelectorAll('.window');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var stacked = window.matchMedia('(max-width: 1180px)');   // style.css의 세로 쌓기 구간과 일치
  var topZ = 10;

  // ----- 언어 전환 (기존 사이트와 동일) -----
  var langButtons = document.querySelectorAll('[data-set-lang]');

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

  // ----- 창 포커스 / 열기 / 닫기 -----
  function focusWindow(win) {
    windows.forEach(function (w) { w.classList.remove('active'); });
    win.classList.add('active');
    win.style.zIndex = ++topZ;
  }

  function openWindow(win) {
    win.hidden = false;
    win.classList.remove('closing');
    focusWindow(win);
  }

  function closeWindow(win) {
    win.classList.add('closing');
    // style.css의 win-out 길이(.14s)와 일치
    setTimeout(function () {
      if (win.classList.contains('closing')) win.hidden = true;
      win.classList.remove('closing');
    }, reduceMotion.matches ? 0 : 140);
  }

  // 아이콘·내비·START: 세로 쌓기 구간에서는 해당 창으로 스크롤
  document.querySelectorAll('[data-open]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var win = document.getElementById(el.dataset.open);
      e.preventDefault();
      if (stacked.matches) {
        win.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      if (win.hidden) openWindow(win);
      else focusWindow(win);
    });
  });

  // ----- 드래그: 마우스·터치를 포인터 이벤트 하나로 처리 -----
  windows.forEach(function (win) {
    var bar = win.querySelector('.title-bar');
    var offsetX = 0;
    var offsetY = 0;

    win.addEventListener('pointerdown', function () { if (!stacked.matches) focusWindow(win); });
    win.querySelector('.btn-close').addEventListener('click', function () { closeWindow(win); });

    bar.addEventListener('pointerdown', function (e) {
      if (stacked.matches || e.target.closest('button')) return;
      var rect = win.getBoundingClientRect();
      var parent = win.offsetParent.getBoundingClientRect();
      offsetX = e.clientX - rect.left + parent.left;
      offsetY = e.clientY - rect.top + parent.top;
      // CSS의 right/bottom 배치를 left/top으로 고정한 뒤 움직인다
      win.style.left = rect.left - parent.left + 'px';
      win.style.top = rect.top - parent.top + 'px';
      win.style.right = 'auto';
      win.style.bottom = 'auto';
      win.classList.add('dragging');
      bar.setPointerCapture(e.pointerId);
    });

    bar.addEventListener('pointermove', function (e) {
      if (!win.classList.contains('dragging')) return;
      // 제목 표시줄이 화면 밖으로 나가 다시 못 잡는 일이 없도록 제한
      var maxX = win.offsetParent.clientWidth - 60;
      var maxY = win.offsetParent.clientHeight - bar.offsetHeight;
      var x = Math.min(Math.max(e.clientX - offsetX, 60 - win.offsetWidth), maxX);
      var y = Math.min(Math.max(e.clientY - offsetY, 0), maxY);
      win.style.left = x + 'px';
      win.style.top = y + 'px';
    });

    function stopDrag() { win.classList.remove('dragging'); }
    bar.addEventListener('pointerup', stopDrag);
    bar.addEventListener('pointercancel', stopDrag);
  });

  focusWindow(document.getElementById('win-rdp'));

  // ----- 레이더 블립: 무작위 위치에 원을 만들고 애니메이션 후 제거 -----
  var radar = document.getElementById('radar');

  function createBlip() {
    var blip = document.createElement('div');
    var size = Math.random() * 50 + 20;
    blip.className = 'blip';
    blip.style.left = Math.random() * 100 + '%';
    blip.style.top = Math.random() * 100 + '%';
    blip.style.width = blip.style.height = size + 'px';
    blip.innerHTML = '<i></i><i></i>';
    radar.appendChild(blip);
    setTimeout(function () { blip.remove(); }, 4000);
  }

  if (!reduceMotion.matches) setInterval(createBlip, 2600);

  // ----- 정렬 시각화 -----
  var sorter = document.querySelector('.sorter');
  if (reduceMotion.matches) SortViz.showStatic(sorter);
  else SortViz.start(sorter);

  // ----- 연도 -----
  document.getElementById('year').textContent = new Date().getFullYear();
})();
