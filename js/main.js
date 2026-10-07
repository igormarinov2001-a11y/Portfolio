// Высота экрана для вёрстки: --vh = 1% устойчивой высоты окна (минус верхний системный отступ).
// Так CSS и скрипты считают от одного числа (в мобильных браузерах и встроенных окнах 100svh
// бывает другим). «Устойчивая» значит: когда на iPhone при скролле сворачивается и появляется
// панель адреса, высота окна меняется на 50–100px, и пересчитывать вёрстку на каждый такой
// кадр нельзя: страница дёргалась, а градиент ломался. Поэтому высоту обновляем только если
// сменилась ширина (поворот) или окно изменилось сильно; мелкие изменения только уменьшают её.
let viewportH = window.innerHeight;
const viewportHeight = () => viewportH;

// Умеет ли браузер scroll-анимации (animation-timeline: scroll()): Safari 26+, Chrome, Edge.
// Тогда раскрытие градиента и заливка в Works считаются в браузере, на видеокарте, а не скриптом
// на каждом кадре скролла. ?nocss=1 в адресе принудительно включает скриптовую версию.
const scrollTimelines = !/[?&]nocss\b/.test(window.location.search) && !!(window.CSS && CSS.supports('animation-timeline: scroll()'));

// Браузер пересчитывает диапазон scroll-анимации (animation-range в px) только когда меняется
// само значение, а не когда меняется высота страницы (шрифты, картинки, поворот телефона). Из-за
// этого заливка и градиент могли начинаться на десятки пикселей позже или раньше. Поэтому каждое
// измерение записываем с крошечным чередующимся добавком (0 / 0.01px): значение «меняется»,
// и браузер заново считает диапазон.
let jitterFlip = 0;
const jitter = () => (jitterFlip ^= 1) * 0.01;

// Колбэки, которые надо перезапустить при изменении высоты страницы (после загрузки, шрифтов,
// смены размеров). Регистрируют блоки, которым нужны точные диапазоны scroll-анимаций.
const remeasureTasks = [];
if (scrollTimelines) {
  let timer = 0;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(() => remeasureTasks.forEach((task) => task()), 60);
  };
  if (window.ResizeObserver) new ResizeObserver(run).observe(document.documentElement);
  window.addEventListener('load', () => {
    run();
    setTimeout(run, 600); // страховка: картинки и шрифты могли догрузиться позже
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
}
(() => {
  const root = document.documentElement;
  let lastW = -1;
  let lastH = -1;
  const set = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w !== lastW || Math.abs(h - viewportH) > 160) viewportH = h;
    else if (h < viewportH) viewportH = h;
    if (w === lastW && viewportH === lastH) return;
    lastW = w;
    lastH = viewportH;
    // Сколько сверху занято системой: в обычном браузере 0, во встроенном окне (телефон) страница
    // начинается ниже его верхней панели. Измеряем по положению <body>.
    const top = Math.max(0, Math.round(document.body.getBoundingClientRect().top + window.scrollY));
    root.style.setProperty('--top-inset', `${top}px`);
    root.style.setProperty('--vh', `${(viewportH - top) / 100}px`);
  };
  set();
  window.addEventListener('resize', set);
})();


// Лоадер. Показывает реальный прогресс загрузки (шрифты и картинки страницы), но не быстрее,
// чем за MIN_MS, чтобы счётчик успел «пробежать». На 100% чуть держит; надписи ныряют под линию,
// линия сворачивается слева направо, и пустой экран уезжает вверх.
(() => {
  const loader = document.querySelector('[data-loader]');
  const root = document.documentElement;
  if (!loader) return;

  const percent = loader.querySelector('[data-loader-percent]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_MS = reduceMotion ? 600 : 1800; // минимум, за сколько счётчик дойдёт до 100%
  const HOLD_MS = 250; // пауза на 100% перед уходом
  const DIVE_MS = reduceMotion ? 0 : 800; // надписи ныряют под линию, линия сворачивается (как в CSS)
  const EXIT_MS = reduceMotion ? 400 : 900; // потом экран уезжает вверх (как в CSS)

  // Что считаем «загруженным»: шрифты + все картинки на странице
  const images = [...document.images];
  const total = images.length + 1;
  let loaded = 0;
  const done = () => { loaded += 1; };

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(done, done);
  images.forEach((img) => {
    if (img.complete) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });

  const start = performance.now();
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    setTimeout(() => {
      loader.classList.add('is-diving'); // надписи ныряют под линию, линия сворачивается
      setTimeout(() => {
        loader.classList.add('is-done'); // экран уезжает вверх
        setTimeout(() => {
          root.classList.remove('is-loading'); // лоадер скрыт, скролл снова работает
          loader.remove();
        }, EXIT_MS);
      }, DIVE_MS);
    }, HOLD_MS);
  };

  const tick = (now) => {
    const byTime = 1 - Math.pow(1 - Math.min(1, (now - start) / MIN_MS), 3); // быстро в начале, медленно в конце
    const byLoad = loaded / total;
    const p = Math.min(byTime, byLoad);
    loader.style.setProperty('--p', p.toFixed(4));
    percent.textContent = `${Math.round(p * 100)}%`;
    if (p >= 1) finish();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();


// Анимация пунктов меню: при наведении буквы по очереди «прокатываются» вверх.
// Скрипт режет текст ссылки на буквы и рисует каждую дважды (оригинал и копия снизу);
// сама анимация — в css/styles.css, раздел «Меню: прокатывание букв».
document.querySelectorAll('.nav__list a').forEach((link) => {
  const label = link.textContent.replace(/\s+/g, ' ').trim();
  const roll = document.createElement('span');
  roll.className = 'roll';
  roll.setAttribute('aria-hidden', 'true');

  let index = 0;
  const addChars = (text, extraClass) => {
    for (const ch of text) {
      const char = document.createElement('span');
      char.className = extraClass ? `roll__char ${extraClass}` : 'roll__char';
      char.style.setProperty('--i', index++);

      const top = document.createElement('span');
      top.textContent = ch === ' ' ? ' ' : ch;
      char.append(top, top.cloneNode(true));
      roll.append(char);
    }
  };

  link.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      addChars(node.textContent.replace(/\s+/g, ' '));
    } else if (node.classList && node.classList.contains('serif')) {
      addChars(node.textContent, 'serif'); // «(32)» остаётся курсивом Nyght Serif
    }
  });

  link.setAttribute('aria-label', label); // экранные читалки читают целое слово, а не буквы
  link.replaceChildren(roll);
});


// Мобильное меню: бургер открывает и закрывает меню на весь экран (класс is-menu-open на <html>).
// Закрывается по ссылке в меню, по Esc и при переходе на широкий экран.
document.querySelectorAll('[data-burger]').forEach((burger) => {
  const root = document.documentElement;
  let closingTimer = 0;
  const setOpen = (open) => {
    const wasOpen = root.classList.contains('is-menu-open');
    // После закрытия ещё 0.7с держим is-menu-closing: пока синяя шторка уходит, шапку нельзя смешивать (mix-blend-mode)
    if (wasOpen && !open) {
      root.classList.add('is-menu-closing');
      clearTimeout(closingTimer);
      closingTimer = setTimeout(() => root.classList.remove('is-menu-closing'), 700);
    } else if (open) {
      clearTimeout(closingTimer);
      root.classList.remove('is-menu-closing');
    }
    root.classList.toggle('is-menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  burger.addEventListener('click', () => setOpen(!root.classList.contains('is-menu-open')));
  document.querySelectorAll('.nav a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
  window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => e.matches && setOpen(false));
});


// Слайдшоу в hero: картинки внутри [data-slideshow] сменяют друг друга по кругу.
// Чтобы добавить кадр, достаточно добавить ещё один <img> внутрь этого блока в index.html.
// Интервал задаётся в миллисекундах в data-interval.
document.querySelectorAll('[data-slideshow]').forEach((box) => {
  const slides = [...box.querySelectorAll('img')];
  if (slides.length < 2) return;

  // Людям с отключёнными анимациями в системе не крутим картинки сами
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const interval = Number(box.dataset.interval) || 2500;
  let current = slides.findIndex((img) => img.classList.contains('is-active'));
  if (current < 0) current = 0;
  let timer = null;

  const show = (next) => {
    slides[current].classList.remove('is-active');
    current = next;
    slides[current].classList.add('is-active');
  };

  const start = () => {
    if (!timer) timer = setInterval(() => show((current + 1) % slides.length), interval);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  // Пока вкладка скрыта, не крутим
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
});


// Живой градиент. Как на референсе, это не просто картинка, а небольшой WebGL-холст: твоя
// картинка gradient.webp лежит на нём текстурой, а шейдер каждую секунду плавно «переливает»
// её (лёгкое течение + медленный дрейф: приближение, сдвиг, поворот). Холст в 3 раза меньше
// экрана (градиент мягкий, это незаметно), его растягивает браузер, поэтому он лёгкий даже на
// телефоне. Если WebGL недоступен, остаётся обычная картинка.
const createGradient = (canvas, image, animated, getSize) => {
  const RES = 1 / 3; // размер холста относительно экрана
  const SPEED = 1; // скорость переливания и дрейфа (больше = быстрее)
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl || !image.naturalWidth) return null;

  const vertex = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const fragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    uniform float u_aspect;
    uniform float u_time;

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      float screen = u_res.x / u_res.y;
      // «cover»: картинка заполняет экран, лишнее обрезается по центру
      vec2 fit = screen > u_aspect ? vec2(1., u_aspect / screen) : vec2(screen / u_aspect, 1.);
      float t = u_time;

      // Течение: координаты слегка плывут волнами (в долях экрана)
      vec2 flow = vec2(
        sin(uv.y * 5. + t * 1.1) + 0.5 * sin(uv.y * 9. - t * 0.8),
        cos(uv.x * 4.5 - t * 0.9) + 0.5 * cos(uv.x * 8. + t * 0.7)
      );
      vec2 c = uv - 0.5 + flow * 0.035;

      // Дрейф: лёгкий поворот, приближение и сдвиг
      float ang = sin(t * 0.35) * 0.05;
      c = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * c;
      c *= (0.80 + 0.05 * sin(t * 0.4));
      c += vec2(sin(t * 0.5), cos(t * 0.43)) * 0.03;

      c = c * fit + 0.5;
      gl_FragColor = vec4(texture2D(u_tex, vec2(c.x, 1. - c.y)).rgb, 1.);
    }`;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // Текстура: картинка, уменьшенная до 1024px по ширине (хватает: градиент мягкий).
  // На телефоне <picture> отдаёт вертикальную картинку, на десктопе горизонтальную;
  // при смене (например, поворот телефона) updateTexture() загружает новую.
  const scratch = document.createElement('canvas');
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0);
  const aspectLoc = gl.getUniformLocation(program, 'u_aspect');

  const updateTexture = () => {
    if (!image.naturalWidth) return;
    const texW = Math.min(1024, image.naturalWidth);
    const texH = Math.round((texW * image.naturalHeight) / image.naturalWidth);
    scratch.width = texW;
    scratch.height = texH;
    scratch.getContext('2d').drawImage(image, 0, 0, texW, texH);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, scratch);
    gl.uniform1f(aspectLoc, texW / texH);
  };
  updateTexture();

  const resLoc = gl.getUniformLocation(program, 'u_res');
  const timeLoc = gl.getUniformLocation(program, 'u_time');
  const phone = window.matchMedia('(max-width: 900px)');

  const startedAt = performance.now();
  let active = false;
  let frame = 0;
  let skip = false;

  const draw = () => {
    gl.uniform1f(timeLoc, ((performance.now() - startedAt) / 1000) * SPEED);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resize = () => {
    const size = getSize();
    const w = Math.max(2, Math.round(size.width * RES));
    const h = Math.max(2, Math.round(size.height * RES));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(resLoc, w, h);
      draw();
    }
  };

  const loop = () => {
    frame = 0;
    if (!active || document.hidden) return;
    // На телефоне рисуем каждый второй кадр (30 к/с): течение медленное, разницы не видно, а нагрузка вдвое меньше
    skip = phone.matches ? !skip : false;
    if (!skip) draw();
    frame = requestAnimationFrame(loop);
  };

  const wake = () => {
    if (active && animated && !frame && !document.hidden) frame = requestAnimationFrame(loop);
  };

  resize();
  draw();

  return {
    resize,
    wake,
    updateTexture() {
      updateTexture();
      draw();
    },
    // Крутим холст только пока градиент виден на экране
    setActive(on) {
      active = on;
      wake();
    },
  };
};


// Градиент, накрывающий хиро. Блок закреплён на экране; пока скролл проходит
// «reveal-distance» (высота пустого блока .reveal), он поднимается снизу и растёт до полного
// экрана, закрывая хиро, а дальше уезжает вверх вместе со страницей и стыкуется с About.
// --p (0…1) — насколько блок раскрыт, --y — его положение по вертикали.
document.querySelectorAll('[data-reveal]').forEach((reveal) => {
  const hero = document.querySelector('.hero');
  const header = document.querySelector('.header');
  const media = reveal.querySelector('.reveal__media');
  const layer = reveal.querySelector('.reveal__layer');
  const probe = reveal.querySelector('.reveal__probe:not(.reveal__probe--end)');
  const probeEnd = reveal.querySelector('.reveal__probe--end');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Сглаживание и «разгон»: берутся из CSS (--reveal-smooth, --reveal-ease), на телефоне мягче.
  // smooth — доля пути до цели за один кадр на 60 Гц (1 = без сглаживания, меньше = плавнее);
  // ease — 0…1, насколько раскрытие начинается и заканчивается мягче (0 = линейно).
  let smooth = reduceMotion ? 1 : 0.4;
  let ease = 0;
  let peek = 0.103; // доля высоты экрана, на которую блок выглядывает в начале (берётся из CSS: --peek)

  let current = 0; // сглаженный прогресс раскрытия
  let target = 0;
  let frame = null;
  let distance = 1; // сколько скроллить до полного раскрытия
  let extra = 0; // на сколько хиро выше экрана (на маленьких экранах)
  let start = 0; // положение верха блока в самом начале
  let startWidth = 0; // ширина окна градиента в самом начале
  let startHeight = 0; // высота окна градиента в самом начале
  let endHeight = 0; // высота окна градиента, когда он раскрылся полностью (--h1)
  let headerHeight = 0; // высота шапки (читаем один раз: чтение на каждом кадре заставляло браузер пересчитывать вёрстку)

  // Если браузер умеет scroll-анимации (animation-timeline), раскрытие и уход градиента идут на
  // стороне браузера (CSS, класс reveal--css), а скрипт только считает стартовые числа и
  // переключает шапку. Иначе (старые браузеры) всё считает скрипт на каждом кадре.
  // ?nocss=1 в адресе принудительно включает скриптовую версию (для сравнения).
  const cssMode = scrollTimelines;
  if (cssMode) reveal.classList.add('reveal--css');

  const measure = () => {
    distance = reveal.offsetHeight || 1;
    extra = Math.max(0, hero.offsetHeight - viewportHeight());
    headerHeight = header ? header.offsetHeight : 0;
    const style = getComputedStyle(reveal);
    peek = parseFloat(style.getPropertyValue('--peek')) || 0.103;
    if (!reduceMotion) smooth = parseFloat(style.getPropertyValue('--reveal-smooth')) || 0.4;
    ease = reduceMotion ? 0 : parseFloat(style.getPropertyValue('--reveal-ease')) || 0;
    start = viewportHeight() * (1 - peek);
    startWidth = probe ? probe.offsetWidth : window.innerWidth * 0.32;
    startHeight = probe ? probe.offsetHeight : viewportHeight() * 0.2;
    endHeight = probeEnd ? probeEnd.offsetHeight : viewportHeight();
    if (cssMode) {
      const screenW = document.documentElement.clientWidth;
      reveal.style.setProperty('--x0', `${((screenW - startWidth) / 2).toFixed(2)}px`);
      reveal.style.setProperty('--y0', `${start.toFixed(2)}px`);
      reveal.style.setProperty('--sx0', (startWidth / screenW).toFixed(4));
      reveal.style.setProperty('--sy0', (endHeight ? startHeight / endHeight : 0.2).toFixed(4));
      reveal.style.setProperty('--extra', `${(extra + jitter()).toFixed(2)}px`);
    }
  };

  const render = () => {
    const sigma = window.scrollY - extra; // скролл, отсчитанный от момента, когда низ хиро у низа экрана
    const y = (1 - current) * start + Math.max(0, -sigma) - Math.max(0, sigma - distance);
    // Окно градиента: прямоугольник [верх y; ширина и высота растут от стартовых до конечных].
    // Слой с градиентом всегда полного размера, окно получается его масштабом и сдвигом (transform).
    const screenW = document.documentElement.clientWidth;
    const boxW = startWidth + (screenW - startWidth) * current;
    const boxH = startHeight + (endHeight - startHeight) * current;
    const scaleX = boxW / screenW;
    const scaleY = endHeight ? boxH / endHeight : 1;
    if (!cssMode) layer.style.transform = `translate3d(${((screenW - boxW) / 2).toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
    // Пока градиент под шапкой, инверсию текста шапки выключаем (на градиенте она даёт грязные цвета)
    if (header) {
      const onMedia = y < headerHeight && y + boxH > 0;
      header.classList.toggle('is-on-media', onMedia);
      document.documentElement.classList.toggle('is-media-under-header', onMedia); // для кнопки шапки, она вне <header>
    }
    // Дрейф градиента запускается, когда он впервые раскрылся на весь экран, и дальше идёт
    // всё время, пока блок виден (при скролле не прерывается и не сбрасывается)
    if (current > 0.995) reveal.classList.add('is-armed');
    const live = y + boxH > 0;
    reveal.classList.toggle('is-live', live);
    if (shader) shader.setActive(live);
  };

  // Прогресс раскрытия по скроллу (0…1) с мягким стартом и концом, если задан --reveal-ease
  const progress = () => {
    const raw = Math.min(1, Math.max(0, (window.scrollY - extra) / distance));
    return raw + (raw * raw * (3 - 2 * raw) - raw) * ease;
  };

  let lastTick = 0;
  const tick = (now) => {
    // Сглаживание не зависит от частоты экрана (60/120 Гц): доля за кадр пересчитывается по времени
    const dt = lastTick ? Math.min(64, now - lastTick) : 16.7;
    lastTick = now;
    const k = 1 - Math.pow(1 - smooth, dt / 16.7);
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.0005) current = target;
    render();
    if (current === target) {
      frame = null;
      lastTick = 0;
    } else {
      frame = requestAnimationFrame(tick);
    }
  };

  const update = () => {
    target = progress();
    if (cssMode) {
      // Само раскрытие делает CSS; здесь только состояние для шапки и холста
      current = target;
      render();
      return;
    }
    render();
    if (!frame) frame = requestAnimationFrame(tick);
  };

  // Живой градиент (WebGL); без него остаётся картинка
  const canvas = reveal.querySelector('.reveal__canvas');
  const picture = media.querySelector('img');
  let shader = null;
  const startShader = () => {
    // Для проверки: ?nogl=1 в адресе отключает живой градиент (остаётся обычная картинка)
    if (/[?&]nogl\b/.test(window.location.search)) return;
    shader = createGradient(canvas, picture, !reduceMotion, () => ({ width: document.documentElement.clientWidth, height: endHeight || viewportHeight() }));
    if (!shader) return;
    reveal.classList.add('has-shader');
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      shader = null;
      reveal.classList.remove('has-shader');
    });
    document.addEventListener('visibilitychange', () => shader && shader.wake());
    render(); // сообщаем холсту, виден ли он сейчас
  };
  if (canvas && picture) {
    // load срабатывает и при смене источника <picture> (телефон/десктоп)
    const onPicture = () => (shader ? shader.updateTexture() : startShader());
    picture.addEventListener('load', onPicture);
    if (picture.complete && picture.naturalWidth) onPicture();
  }

  measure();
  if (cssMode) remeasureTasks.push(measure);
  if (shader) shader.resize();
  target = progress();
  current = target; // при перезагрузке страницы посреди скролла сразу ставим нужный размер
  render();

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    measure();
    if (shader) shader.resize();
    update();
  });
});


// Текст в About: буквы серые (белый 40%) и по мере скролла по очереди, СТРОГО ПО ОДНОЙ,
// становятся белыми. Скролл определяет, сколько букв должно быть белыми, а сами буквы
// включаются друг за другом с фиксированным темпом (STEP_MS на букву), поэтому даже при
// быстрой прокрутке заливка идёт по буквам, а не сразу пачкой. Смена мгновенная.
document.querySelectorAll('[data-scrub]').forEach((block) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // остаётся белым

  const START_AT = 0.85; // начинаем, когда верх текста поднялся до 85% высоты экрана
  const END_AT = 0.6; // заканчиваем, когда низ текста поднялся до 60% высоты экрана
  const STEP_MS = 12; // сколько миллисекунд на одну букву (меньше = быстрее бежит заливка)

  // Читалкам с экрана отдаём весь текст целиком, а не по буквам
  block.setAttribute('aria-label', block.textContent.replace(/\s+/g, ' ').trim());

  const chars = [];
  block.querySelectorAll('.line').forEach((line) => {
    line.setAttribute('aria-hidden', 'true');
    const parts = line.textContent.trim().split(/\s+/);
    line.textContent = '';
    parts.forEach((text, i) => {
      const word = document.createElement('span'); // слово не даёт разорвать себя между строками
      word.className = 'word';
      for (const ch of text) {
        const char = document.createElement('span');
        char.className = 'char';
        char.textContent = ch;
        word.append(char);
        chars.push(char);
      }
      line.append(word);
      if (i < parts.length - 1) line.append(' ');
    });
  });

  let shown = 0; // сколько букв белые прямо сейчас
  let target = 0; // сколько должно быть белыми по положению скролла
  let startScroll = 0;
  let endScroll = 1;
  let frame = null;
  let last = 0;
  let acc = 0;

  const measure = () => {
    const top = block.getBoundingClientRect().top + window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    startScroll = top - window.innerHeight * START_AT;
    endScroll = Math.min(top + block.offsetHeight - window.innerHeight * END_AT, maxScroll);
    if (endScroll <= startScroll + 1) endScroll = startScroll + 1;
  };

  const readTarget = () => {
    const q = Math.min(1, Math.max(0, (window.scrollY - startScroll) / (endScroll - startScroll)));
    target = Math.ceil(q * chars.length);
  };

  // Двигаем заливку к цели по одной букве за STEP_MS (вперёд или назад)
  const step = (now) => {
    frame = null;
    if (last) acc += now - last;
    last = now;
    while (acc >= STEP_MS && shown !== target) {
      if (shown < target) chars[shown++].classList.add('is-on');
      else chars[--shown].classList.remove('is-on');
      acc -= STEP_MS;
    }
    if (shown === target) {
      acc = 0;
      last = 0;
    } else {
      frame = requestAnimationFrame(step);
    }
  };

  const update = () => {
    readTarget();
    if (!frame && shown !== target) {
      acc = STEP_MS; // первая буква включается сразу, без задержки
      frame = requestAnimationFrame(step);
    }
  };

  // При загрузке (например, перезагрузка страницы посреди скролла) сразу ставим нужное состояние
  measure();
  readTarget();
  for (; shown < target; shown++) chars[shown].classList.add('is-on');

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    measure();
    update();
  });
});


// Бегущая строка в карточках проектов. Строит ленту из data-marquee: части через «|»
// (например, «View case study|2026») чередуются по кругу, каждая — отдельный элемент.
// Две одинаковые группы подряд дают бесшовную петлю (анимация в CSS, .marquee__track).
document.querySelectorAll('[data-marquee]').forEach((el) => {
  const parts = el.dataset.marquee.split('|');
  const REPEAT = 6; // сколько раз повторяем набор частей в группе (должно перекрывать ширину карточки)

  const makeGroup = () => {
    const group = document.createElement('div');
    group.className = 'marquee__group';
    for (let i = 0; i < REPEAT; i++) {
      parts.forEach((text, index) => {
        const item = document.createElement('span');
        item.className = index % 2 === 1 ? 'marquee__item marquee__item--serif' : 'marquee__item';
        item.textContent = text;
        group.append(item);
      });
    }
    return group;
  };

  const track = document.createElement('div');
  track.className = 'marquee__track';
  track.append(makeGroup(), makeGroup());
  el.append(track);
});


// Секция работ. Сначала секция занимает весь экран (тёмная), потом закрепляется и, пока вы
// скролите, четыре колонки (между линиями сетки) заливаются белым слева направо одновременно,
// потом появляются подпись, работы и кнопка.
// --f (0…1) — прогресс заливки; is-in — заливка закончилась, показываем контент.
// Когда заливка стала полностью белой, кнопка шапки становится тёмной (is-on-light), чтобы не
// пропасть на белом (текст шапки инвертируется сам, см. mix-blend-mode в CSS).
document.querySelectorAll('[data-works]').forEach((section) => {
  const header = document.querySelector('.header');
  const cta = document.querySelector('.header__cta');
  const pin = section.querySelector('.works__pin');
  const stage = section.querySelector('.works__stage');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  section.classList.add('works--armed');

  // Заливка колонок: если браузер умеет scroll-анимации, её ведёт CSS (класс works--css), по
  // скроллу, на видеокарте. Скрипт только сообщает, где в документе начинается закреплённая
  // часть (--pin-top). Без анимаций (и при «уменьшении движения») считает скрипт (--f).
  const cssFill = scrollTimelines && !reduceMotion;
  const measurePin = () => {
    section.style.setProperty('--pin-top', `${(pin.getBoundingClientRect().top + window.scrollY + jitter()).toFixed(2)}px`);
  };
  if (cssFill) {
    section.classList.add('works--css');
    measurePin();
    // Верх секции сдвигается, когда выше меняется высота (шрифты, картинки): пересчитываем
    remeasureTasks.push(measurePin);
  }

  let frame = null;
  let headerHeight = header ? header.offsetHeight : 0; // читаем один раз, обновляем при resize

  const render = () => {
    frame = null;
    const distance = Math.max(1, pin.offsetHeight - stage.offsetHeight); // длина закреплённой части
    const rect = pin.getBoundingClientRect();
    let p = Math.min(1, Math.max(0, -rect.top / distance)); // 0, пока сцена не дошла до верха экрана
    if (reduceMotion) p = p >= 0.5 ? 1 : 0; // без плавной заливки, сразу белый
    const eased = 1 - (1 - p) * (1 - p); // в начале быстрее, к концу замедляется

    if (!cssFill) section.style.setProperty('--f', eased.toFixed(4));

    // Работы и кнопка появляются, когда заливка закончилась (с запасом, чтобы не мигало)
    if (p >= 0.98) section.classList.add('is-in');
    else if (p < 0.7) section.classList.remove('is-in');

    const bounds = section.getBoundingClientRect();
    if (cta) {
      const mid = headerHeight / 2 || 40;
      // Кнопка шапки темнеет, только когда заливка полностью белая (то же условие, что и is-in)
      cta.classList.toggle('is-on-light', section.classList.contains('is-in') && bounds.bottom > mid);
    }

    // Шапка под секцией работ: на телефоне инверсия (mix-blend-mode) включается только здесь,
    // потому что в остальных местах она дорогая для iPhone и давала рывки при скролле
    document.documentElement.classList.toggle('is-over-works', bounds.top < headerHeight && bounds.bottom > 0);
  };

  const update = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  render();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    headerHeight = header ? header.offsetHeight : 0;
    update();
  });
});


// Метка сборки для проверки: если в адресе есть ?v=…, в углу страницы показывается название
// сборки. Так сразу видно, какая версия загрузилась (Safari любит показывать старую из кэша).
// Перед запуском сайта для всех этот блок можно удалить.
(() => {
  if (!/[?&]v=/.test(window.location.search)) return;
  const tag = document.createElement('div');
  tag.textContent = `build: strip-caps · ${document.querySelector('.reveal--css') ? 'css' : 'js'}${/[?&]nogl\b/.test(window.location.search) ? ' · nogl' : ''}`;
  tag.setAttribute('aria-hidden', 'true');
  tag.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:200;padding:3px 7px;border-radius:4px;background:rgba(128,128,128,.55);color:#fff;font:10px/1.2 system-ui,sans-serif;pointer-events:none';
  document.body.appendChild(tag);
})();
