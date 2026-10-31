// 정렬 시각화 위젯
// 각 알고리즘은 배열을 직접 정렬하면서 화면에 그릴 단계를 yield 하는 제너레이터다
var SortViz = (function () {
  var BAR_COUNT = 32;
  var TARGET_MS = 8000;     // 알고리즘이 달라도 한 판이 비슷한 시간에 끝나도록 맞춘다
  var MIN_DELAY = 12;
  var MAX_DELAY = 90;

  function swap(a, i, j) {
    var t = a[i];
    a[i] = a[j];
    a[j] = t;
  }

  function* bubble(a) {
    for (var end = a.length - 1; end > 0; end--) {
      for (var j = 0; j < end; j++) {
        yield ['compare', j, j + 1];
        if (a[j] > a[j + 1]) {
          swap(a, j, j + 1);
          yield ['swap', j, j + 1];
        }
      }
      yield ['done', end];
    }
    yield ['done', 0];
  }

  function* selection(a) {
    for (var i = 0; i < a.length; i++) {
      var min = i;
      yield ['pivot', min];
      for (var j = i + 1; j < a.length; j++) {
        yield ['compare', min, j];
        if (a[j] < a[min]) {
          min = j;
          yield ['pivot', min];
        }
      }
      if (min !== i) {
        swap(a, i, min);
        yield ['swap', i, min];
      }
      yield ['done', i];
    }
  }

  function* insertion(a) {
    for (var i = 1; i < a.length; i++) {
      for (var j = i; j > 0; j--) {
        yield ['compare', j - 1, j];
        if (a[j - 1] <= a[j]) break;
        swap(a, j - 1, j);
        yield ['swap', j - 1, j];
      }
    }
  }

  function* quickRange(a, lo, hi) {
    if (lo > hi) return;
    if (lo === hi) { yield ['done', lo]; return; }
    var store = lo;
    yield ['pivot', hi];
    for (var j = lo; j < hi; j++) {
      yield ['compare', j, hi];
      if (a[j] < a[hi]) {
        if (j !== store) {
          swap(a, j, store);
          yield ['swap', j, store];
        }
        store++;
      }
    }
    if (store !== hi) {
      swap(a, store, hi);
      yield ['swap', store, hi];
    }
    yield ['done', store];
    yield* quickRange(a, lo, store - 1);
    yield* quickRange(a, store + 1, hi);
  }

  function* quick(a) {
    yield* quickRange(a, 0, a.length - 1);
  }

  function* mergeRange(a, lo, hi) {
    if (hi - lo < 1) return;
    var mid = Math.floor((lo + hi) / 2);
    yield* mergeRange(a, lo, mid);
    yield* mergeRange(a, mid + 1, hi);

    var left = a.slice(lo, mid + 1);
    var right = a.slice(mid + 1, hi + 1);
    var l = 0;
    var r = 0;
    for (var k = lo; k <= hi; k++) {
      if (l < left.length && r < right.length) yield ['compare', lo + l, mid + 1 + r];
      if (r >= right.length || (l < left.length && left[l] <= right[r])) a[k] = left[l++];
      else a[k] = right[r++];
      yield ['write', k];
    }
  }

  function* merge(a) {
    yield* mergeRange(a, 0, a.length - 1);
  }

  function* siftDown(a, root, end) {
    while (root * 2 + 1 <= end) {
      var child = root * 2 + 1;
      if (child < end) {
        yield ['compare', child, child + 1];
        if (a[child] < a[child + 1]) child++;
      }
      yield ['compare', root, child];
      if (a[root] >= a[child]) return;
      swap(a, root, child);
      yield ['swap', root, child];
      root = child;
    }
  }

  function* heap(a) {
    var last = a.length - 1;
    for (var i = Math.floor((last - 1) / 2); i >= 0; i--) yield* siftDown(a, i, last);
    for (var end = last; end > 0; end--) {
      swap(a, 0, end);
      yield ['swap', 0, end];
      yield ['done', end];
      yield* siftDown(a, 0, end - 1);
    }
    yield ['done', 0];
  }

  var SORTS = [
    { id: 'bubble', name: 'BUBBLE', big: 'O(n²)', run: bubble },
    { id: 'selection', name: 'SELECTION', big: 'O(n²)', run: selection },
    { id: 'insertion', name: 'INSERTION', big: 'O(n²)', run: insertion },
    { id: 'quick', name: 'QUICK', big: 'O(n log n)', run: quick },
    { id: 'merge', name: 'MERGE', big: 'O(n log n)', run: merge },
    { id: 'heap', name: 'HEAP', big: 'O(n log n)', run: heap }
  ];

  function shuffled(n) {
    var a = [];
    for (var i = 1; i <= n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) swap(a, j, Math.floor(Math.random() * (j + 1)));
    return a;
  }

  // 비교·교환 횟수와 강조 표시를 한 판 동안 들고 있는 상태
  function newState(values) {
    return { values: values, compares: 0, writes: 0, active: [], writing: [], pivot: -1, done: {} };
  }

  function applyStep(state, step) {
    var type = step[0];
    if (type === 'done') { state.done[step[1]] = true; return; }
    if (type === 'pivot') { state.pivot = step[1]; return; }
    state.active = [];
    state.writing = [];
    if (type === 'compare') {
      state.compares++;
      state.active = step.slice(1);
    } else {
      state.writes++;
      state.writing = step.slice(1);
    }
  }

  // 위젯 DOM을 만들고 그리기 함수를 돌려준다
  function mount(el) {
    var bars = [];
    var barBox = el.querySelector('.sorter-bars');
    var list = el.querySelector('.sorter-list');
    var nameEl = el.querySelector('.sorter-name');
    var bigEl = el.querySelector('.sorter-big');
    var compareEl = el.querySelector('.sorter-compares');
    var writeEl = el.querySelector('.sorter-writes');
    var statusEl = el.querySelector('.sorter-status');
    var items = {};

    for (var i = 0; i < BAR_COUNT; i++) {
      var bar = document.createElement('i');
      barBox.appendChild(bar);
      bars.push(bar);
    }
    SORTS.forEach(function (sort) {
      var li = document.createElement('li');
      li.textContent = sort.name;
      list.appendChild(li);
      items[sort.id] = li;
    });

    return {
      select: function (sort) {
        SORTS.forEach(function (s) { items[s.id].classList.toggle('current', s === sort); });
        nameEl.textContent = sort.name + '_SORT';
        bigEl.textContent = sort.big;
      },
      status: function (text) { statusEl.textContent = '<' + text + '>'; },
      draw: function (state) {
        state.values.forEach(function (value, i) {
          var cls = '';
          if (state.done[i]) cls = 'done';
          if (state.pivot === i) cls = 'pivot';
          if (state.active.indexOf(i) >= 0) cls = 'compare';
          if (state.writing.indexOf(i) >= 0) cls = 'write';
          bars[i].className = cls;
          bars[i].style.height = value / BAR_COUNT * 100 + '%';
        });
        compareEl.textContent = state.compares;
        writeEl.textContent = state.writes;
      }
    };
  }

  // 지난번과 다른 알고리즘을 무작위로 고른다
  function pick(previous) {
    var rest = SORTS.filter(function (s) { return s !== previous; });
    return rest[Math.floor(Math.random() * rest.length)];
  }

  function countSteps(sort, values) {
    var count = 0;
    var steps = sort.run(values.slice());
    while (!steps.next().done) count++;
    return count;
  }

  function start(el) {
    var view = mount(el);
    var previous = null;
    var paused = false;
    var resume = null;      // 일시정지 동안 미뤄 둔 다음 단계
    var statusText = '';

    function setStatus(text) {
      statusText = text;
      view.status(paused ? text.replace(/ \w+$/, ' paused') : text);
    }

    // 모든 타이머를 이 함수로 예약해 진행, 훑기, 판 사이 대기를 한 번에 멈춘다
    function later(fn, ms) {
      setTimeout(function run() {
        if (document.hidden) setTimeout(run, 400);
        else if (paused) resume = fn;
        else fn();
      }, ms);
    }

    function updateLabel() {
      var en = document.documentElement.lang === 'en';
      el.setAttribute('aria-label', en ? 'Pause sorting animation' : '정렬 애니메이션 일시정지');
    }

    function togglePause() {
      paused = !paused;
      el.classList.toggle('paused', paused);
      el.setAttribute('aria-pressed', String(paused));
      setStatus(statusText);
      if (!paused && resume) {
        var fn = resume;
        resume = null;
        fn();
      }
    }

    el.removeAttribute('aria-hidden');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-pressed', 'false');
    updateLabel();
    el.addEventListener('focus', updateLabel);
    el.addEventListener('click', togglePause);
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      togglePause();
    });

    function play() {
      var sort = pick(previous);
      var values = shuffled(BAR_COUNT);
      var delay = Math.min(MAX_DELAY, Math.max(MIN_DELAY, TARGET_MS / countSteps(sort, values)));
      var state = newState(values);
      var steps = sort.run(values);
      previous = sort;
      view.select(sort);
      setStatus(sort.id + '_sort.exe running');
      view.draw(state);

      function tick() {
        var next = steps.next();
        if (next.done) { sweep(0); return; }
        applyStep(state, next.value);
        view.draw(state);
        later(tick, delay);
      }

      // 끝나면 왼쪽부터 초록으로 훑고 잠시 쉬었다가 다음 판
      function sweep(i) {
        state.active = [];
        state.writing = [];
        state.pivot = -1;
        if (i >= BAR_COUNT) {
          setStatus(sort.id + '_sort.exe complete');
          later(play, 1600);
          return;
        }
        state.done[i] = true;
        view.draw(state);
        later(function () { sweep(i + 1); }, 14);
      }

      later(tick, 500);
    }

    play();
  }

  // 모션을 줄인 사용자: 정렬이 끝난 정지 화면만 보여준다
  function showStatic(el) {
    var view = mount(el);
    var state = newState(shuffled(BAR_COUNT).sort(function (a, b) { return a - b; }));
    state.values.forEach(function (value, i) { state.done[i] = true; });
    view.select(SORTS[3]);
    view.status('sort complete');
    view.draw(state);
  }

  return {
    SORTS: SORTS,
    BAR_COUNT: BAR_COUNT,
    shuffled: shuffled,
    newState: newState,
    applyStep: applyStep,
    mount: mount,
    start: start,
    showStatic: showStatic
  };
})();
