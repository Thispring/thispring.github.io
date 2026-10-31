// 히어로 3D 텍스트: 옛 윈도우 3D 화면보호기처럼 로우폴리 글자가 HUD 링 안을 튕겨 다닌다
// 좌표 단위는 .hud가 640px일 때의 px이고, 화면 크기에 맞춰 그릴 때만 배율을 곱한다
var Hero3D = (function () {
  var FRAME = 640;
  var RING_RADIUS = FRAME * 290 / 600;    // .rings의 바깥 링 (r=290, viewBox 600)
  var CAMERA = 800;
  var Z_LIMIT = 170;
  var SPEED = 150;
  var PALETTE = {
    white: [1, .93, .93],
    orange: [1, .5, .13],
    letters: [[.95, .13, .07], [1, .85, .05], [.93, .08, .62], [.45, .93, .1], [.05, .87, .6]]
  };

  // ----- 글자 → 픽셀 -----
  function rasterize(text, font) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.font = font;
    var width = Math.ceil(ctx.measureText(text).width) + 2;
    var height = parseInt(font.match(/(\d+)px/)[1], 10) + 4;
    canvas.width = width;
    canvas.height = height;
    ctx.font = font;              // 크기를 바꾸면 초기화되므로 다시 지정
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillText(text, 1, 1);

    var alpha = ctx.getImageData(0, 0, width, height).data;
    var rows = [];
    var top = height;
    var bottom = -1;
    var left = width;
    var right = -1;
    for (var y = 0; y < height; y++) {
      rows.push([]);
      for (var x = 0; x < width; x++) {
        var on = alpha[(y * width + x) * 4 + 3] > 110;
        rows[y].push(on);
        if (on) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
    }
    return { rows: rows, top: top, bottom: bottom, left: left, right: right };
  }

  // ----- 픽셀 → 모서리를 깎은 돌출 메시 -----
  function Mesh() {
    this.data = [];
    this.lines = [];    // 충돌 판정에 쓸 줄별 경계 상자
  }

  Mesh.prototype.quad = function (a, b, c, d, normal, color) {
    var data = this.data;
    [a, b, c, a, c, d].forEach(function (p) {
      data.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    });
  };

  Mesh.prototype.pixel = function (x0, y0, u, d, open, color) {
    var x1 = x0 + u;
    var y1 = y0 + u;
    var b = u * .28;
    var s = Math.SQRT1_2;
    // 맞닿은 픽셀이 있는 쪽은 깎지 않아야 면이 이어진다
    var fx0 = x0 + (open.left ? b : 0);
    var fx1 = x1 - (open.right ? b : 0);
    var fy0 = y0 + (open.down ? b : 0);
    var fy1 = y1 - (open.up ? b : 0);
    var z = d - b;

    this.quad([fx0, fy0, d], [fx1, fy0, d], [fx1, fy1, d], [fx0, fy1, d], [0, 0, 1], color);
    this.quad([x0, y0, -d], [x0, y1, -d], [x1, y1, -d], [x1, y0, -d], [0, 0, -1], color);
    if (open.right) {
      this.quad([x1, y0, -d], [x1, y1, -d], [x1, y1, z], [x1, y0, z], [1, 0, 0], color);
      this.quad([x1, y0, z], [x1, y1, z], [fx1, fy1, d], [fx1, fy0, d], [s, 0, s], color);
    }
    if (open.left) {
      this.quad([x0, y0, -d], [x0, y0, z], [x0, y1, z], [x0, y1, -d], [-1, 0, 0], color);
      this.quad([x0, y0, z], [fx0, fy0, d], [fx0, fy1, d], [x0, y1, z], [-s, 0, s], color);
    }
    if (open.up) {
      this.quad([x0, y1, -d], [x0, y1, z], [x1, y1, z], [x1, y1, -d], [0, 1, 0], color);
      this.quad([x0, y1, z], [fx0, fy1, d], [fx1, fy1, d], [x1, y1, z], [0, s, s], color);
    }
    if (open.down) {
      this.quad([x0, y0, -d], [x1, y0, -d], [x1, y0, z], [x0, y0, z], [0, -1, 0], color);
      this.quad([x0, y0, z], [x1, y0, z], [fx1, fy0, d], [fx0, fy0, d], [0, -s, s], color);
    }
  };

  // 가운데 정렬한 한 줄을 추가하고 다음 줄의 위쪽 y를 돌려준다
  Mesh.prototype.line = function (bitmap, top, u, d, colorAt) {
    var columns = bitmap.right - bitmap.left + 1;
    var rowCount = bitmap.bottom - bitmap.top + 1;
    var left = -columns * u / 2;
    var rows = bitmap.rows;

    function on(x, y) { return !!(rows[y] && rows[y][x]); }

    for (var y = bitmap.top; y <= bitmap.bottom; y++) {
      for (var x = bitmap.left; x <= bitmap.right; x++) {
        if (!on(x, y)) continue;
        this.pixel(left + (x - bitmap.left) * u, top - (y - bitmap.top + 1) * u, u, d, {
          left: !on(x - 1, y),
          right: !on(x + 1, y),
          up: !on(x, y - 1),
          down: !on(x, y + 1)
        }, colorAt((x - bitmap.left) / columns));
      }
    }
    this.lines.push({ x: columns * u / 2, top: top, bottom: top - rowCount * u, z: d });
    return top - rowCount * u;
  };

  // 줄별 상자의 꼭짓점: 글자가 없는 빈 모서리로 튕기지 않도록 전체 상자를 쓰지 않는다
  Mesh.prototype.hull = function (centerY) {
    var points = [];
    this.lines.forEach(function (line) {
      [-line.x, line.x].forEach(function (x) {
        [line.top, line.bottom].forEach(function (y) {
          [-line.z, line.z].forEach(function (z) {
            points.push([x, y - centerY, z]);
          });
        });
      });
    });
    return points;
  };

  function buildText(eyebrow, question) {
    var mesh = new Mesh();
    var white = function () { return PALETTE.white; };
    var orange = function () { return PALETTE.orange; };
    var letters = function (t) { return PALETTE.letters[Math.min(4, Math.floor(t * 5))]; };

    var y = 0;
    y = mesh.line(rasterize(eyebrow, '8px Silkscreen'), y, 1.75, 2.5, orange) - 14;
    y = mesh.line(rasterize('START', '700 16px Silkscreen'), y, 5, 14, letters) - 14;
    question.forEach(function (text) {
      y = mesh.line(rasterize(text, '12px Galmuri11'), y, 2.5, 3, white) - 7;
    });

    // 글자 덩어리의 가운데가 회전 중심이 되도록 옮긴다
    var centerY = (y + 7) / 2;
    for (var i = 1; i < mesh.data.length; i += 9) mesh.data[i] -= centerY;
    return { vertices: new Float32Array(mesh.data), hull: mesh.hull(centerY) };
  }

  // ----- 벽돌깨기 공처럼 속도는 그대로 두고 방향만 반사한다 -----
  function newBody() {
    var angle = Math.random() * Math.PI * 2;
    var flat = SPEED * .88;
    return {
      t: Math.random() * 100,
      x: 0,
      y: 0,
      z: 0,
      vx: Math.cos(angle) * flat,
      vy: Math.sin(angle) * flat,
      vz: SPEED * .47 * (Math.random() < .5 ? -1 : 1),
      rot: [1, 0, 0, 0, 1, 0, 0, 0, 1]
    };
  }

  // 글자를 읽을 수 있도록 뒤집히지 않는 범위에서만 흔든다
  function rotation(t) {
    var yaw = .5 * Math.sin(t * .53);
    var pitch = .32 * Math.sin(t * .37 + 1);
    var roll = .14 * Math.sin(t * .29 + 2);
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var cr = Math.cos(roll), sr = Math.sin(roll);
    return [
      cr * cy - sr * sp * sy, -sr * cp, cr * sy + sr * sp * cy,
      sr * cy + cr * sp * sy, cr * cp, sr * sy - cr * sp * cy,
      -cp * sy, sp, cp * cy
    ];
  }

  function project(body, p) {
    var r = body.rot;
    var z = r[6] * p[0] + r[7] * p[1] + r[8] * p[2] + body.z;
    var w = (CAMERA - z) / CAMERA;
    return {
      x: (r[0] * p[0] + r[1] * p[1] + r[2] * p[2] + body.x) / w,
      y: (r[3] * p[0] + r[4] * p[1] + r[5] * p[2] + body.y) / w,
      w: w
    };
  }

  function step(body, hull, dt) {
    body.t += dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.z += body.vz * dt;
    body.rot = rotation(body.t);

    // 앞뒤 면
    if (Math.abs(body.z) > Z_LIMIT) {
      body.z = Math.max(-Z_LIMIT, Math.min(Z_LIMIT, body.z));
      body.vz = -body.vz;
    }

    // 화면에 그려진 글자가 링에 닿으면 닿은 지점의 법선으로 반사하고 안쪽으로 밀어낸다
    var bounced = false;
    for (var pass = 0; pass < 4; pass++) {
      var far = null;
      var reach = RING_RADIUS;
      hull.forEach(function (p) {
        var q = project(body, p);
        var d = Math.sqrt(q.x * q.x + q.y * q.y);
        if (d > reach) {
          reach = d;
          far = { x: q.x / d, y: q.y / d, w: q.w };
        }
      });
      if (!far) break;

      var outward = body.vx * far.x + body.vy * far.y;
      if (outward > 0 && !bounced) {
        body.vx -= 2 * outward * far.x;
        body.vy -= 2 * outward * far.y;
        bounced = true;
      }
      var push = (reach - RING_RADIUS + .01) * far.w;
      body.x -= far.x * push;
      body.y -= far.y * push;
    }
    return bounced;
  }

  // ----- WebGL 렌더링: 꼭짓점별 조명으로 옛 OpenGL의 고로 셰이딩을 흉내 낸다 -----
  var VERTEX_SHADER = [
    'attribute vec3 aPos;',
    'attribute vec3 aNormal;',
    'attribute vec3 aColor;',
    'uniform mat3 uRot;',
    'uniform vec3 uOffset;',
    'uniform float uCamera;',
    'uniform float uScale;',
    'varying vec3 vColor;',
    'void main() {',
    '  vec3 p = uRot * aPos + uOffset;',
    '  vec3 n = uRot * aNormal;',
    '  vec3 l = normalize(vec3(-.45, .6, .75));',
    '  vec3 h = normalize(l + vec3(0., 0., 1.));',
    '  float diffuse = max(dot(n, l), 0.);',
    '  float specular = pow(max(dot(n, h), 0.), 24.);',
    '  vColor = aColor * (.3 + .85 * diffuse) + vec3(.55) * specular;',
    '  float w = (uCamera - p.z) / uCamera;',
    '  gl_Position = vec4(p.x * uScale, p.y * uScale, -p.z * .001 * w, w);',
    '}'
  ].join('\n');

  var FRAGMENT_SHADER = [
    'precision mediump float;',
    'varying vec3 vColor;',
    'void main() { gl_FragColor = vec4(vColor, 1.); }'
  ].join('\n');

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  function createRenderer(canvas) {
    var gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) return null;

    var program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    [['aPos', 0], ['aNormal', 12], ['aColor', 24]].forEach(function (attr) {
      var location = gl.getAttribLocation(program, attr[0]);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 36, attr[1]);
    });

    var uRot = gl.getUniformLocation(program, 'uRot');
    var uOffset = gl.getUniformLocation(program, 'uOffset');
    gl.uniform1f(gl.getUniformLocation(program, 'uCamera'), CAMERA);
    gl.uniform1f(gl.getUniformLocation(program, 'uScale'), 2 / FRAME);

    var count = 0;
    return {
      setMesh: function (vertices) {
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        count = vertices.length / 9;
      },
      resize: function () {
        var size = Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2));
        if (canvas.width !== size) {
          canvas.width = canvas.height = size;
          gl.viewport(0, 0, size, size);
        }
      },
      draw: function (body) {
        var r = body.rot;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // WebGL의 mat3는 열 우선
        gl.uniformMatrix3fv(uRot, false, [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]]);
        gl.uniform3f(uOffset, body.x, body.y, body.z);
        gl.drawArrays(gl.TRIANGLES, 0, count);
      }
    };
  }

  // ----- 시작 -----
  function readText(hud) {
    var lang = document.documentElement.lang === 'en' ? 'en' : 'ko';
    var html = hud.querySelector('h1 [data-lang="' + lang + '"]').innerHTML;
    return {
      eyebrow: hud.querySelector('.eyebrow').textContent,
      question: html.split(/<br\s*\/?>/i).map(function (s) { return s.trim(); })
    };
  }

  function loadFonts(hud) {
    return Promise.all([
      document.fonts.load('8px Silkscreen', 'A'),
      document.fonts.load('700 16px Silkscreen', 'START'),
      document.fonts.load('12px Galmuri11', hud.querySelector('h1').textContent)
    ]);
  }

  function start(hud, still) {
    var canvas = hud.querySelector('.hud-3d');
    var link = hud.querySelector('.start');
    var renderer = createRenderer(canvas);
    if (!renderer) return;      // WebGL이 없으면 기존 HTML 글자를 그대로 보여준다

    var body = newBody();
    var hull = [];
    var visible = true;
    var last = 0;
    var running = false;

    function render() {
      renderer.resize();
      renderer.draw(body);
    }

    function rebuild() {
      var text = readText(hud);
      var built = buildText(text.eyebrow, text.question);
      renderer.setMesh(built.vertices);
      hull = built.hull;
      render();
    }

    function frame(now) {
      if (!visible) { running = false; return; }
      var dt = Math.min((now - last) / 1000 || 0, .05);   // 탭 복귀 시 순간이동 방지
      last = now;
      step(body, hull, dt);
      render();
      requestAnimationFrame(frame);
    }

    function run() {
      if (running || still) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }

    // 글자 위에서만 START 링크처럼 동작한다
    function overText(e) {
      var rect = canvas.getBoundingClientRect();
      var unit = FRAME / rect.width;
      var x = (e.clientX - rect.left) * unit - FRAME / 2;
      var y = FRAME / 2 - (e.clientY - rect.top) * unit;
      var box = { left: Infinity, right: -Infinity, top: -Infinity, bottom: Infinity };
      hull.forEach(function (p) {
        var q = project(body, p);
        box.left = Math.min(box.left, q.x);
        box.right = Math.max(box.right, q.x);
        box.top = Math.max(box.top, q.y);
        box.bottom = Math.min(box.bottom, q.y);
      });
      return x > box.left && x < box.right && y < box.top && y > box.bottom;
    }

    canvas.addEventListener('mousemove', function (e) {
      canvas.style.cursor = overText(e) ? 'pointer' : '';
    });
    canvas.addEventListener('click', function (e) {
      if (overText(e)) link.click();
    });

    loadFonts(hud).then(function () {
      if (still) body.rot = rotation(.6);
      rebuild();
      hud.classList.add('has-3d');
      run();

      new MutationObserver(rebuild).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      window.addEventListener('resize', render);
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) run();
      }).observe(hud);
    });
  }

  return {
    start: start,
    buildText: buildText,
    newBody: newBody,
    step: step,
    project: project,
    RING_RADIUS: RING_RADIUS,
    SPEED: SPEED,
    Z_LIMIT: Z_LIMIT
  };
})();
