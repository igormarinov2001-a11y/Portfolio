// Высота экрана для вёрстки: --vh = 1% реальной высоты окна (innerHeight). Так CSS и скрипты
// считают от одного числа (в мобильных браузерах и встроенных окнах 100svh бывает другим).
(() => {
  const root = document.documentElement;
  const set = () => root.style.setProperty('--vh', `${window.innerHeight / 100}px`);
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
  const setOpen = (open) => {
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


// Живой градиент. Тот же приём, что на референсе: не картинка, а небольшой WebGL-холст,
// на котором шейдер каждую секунду «переливает» цвета. Холст рисуется в 3 раза меньше экрана
// (градиент мягкий, это незаметно) и растягивается браузером, поэтому он лёгкий даже на телефоне.
// Цвета взяты из gradient.webp. Если WebGL недоступен, остаётся картинка.
const createGradient = (canvas, animated) => {
  const RES = 1 / 3; // размер холста относительно экрана
  const SPEED = 0.18; // скорость переливания (больше = быстрее)
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const vertex = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const fragment = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 u_res;
    uniform float u_time;

    // Палитра из gradient.webp: от почти чёрного через индиго и фиолетовый к сиреневому и голубому
    vec3 palette(float t) {
      vec3 c0 = vec3(0.027, 0.012, 0.106);
      vec3 c1 = vec3(0.122, 0.078, 0.369);
      vec3 c2 = vec3(0.439, 0.071, 0.925);
      vec3 c3 = vec3(0.565, 0.318, 0.902);
      vec3 c4 = vec3(0.388, 0.514, 0.988);
      vec3 c5 = vec3(0.506, 0.569, 0.988);
      t = clamp(t, 0., 1.) * 5.;
      vec3 c = mix(c0, c1, smoothstep(0., 1., t));
      c = mix(c, c2, smoothstep(1., 2., t));
      c = mix(c, c3, smoothstep(2., 3., t));
      c = mix(c, c4, smoothstep(3., 4., t));
      c = mix(c, c5, smoothstep(4., 5., t));
      return c;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2. - u_res) / min(u_res.x, u_res.y);
      float t = u_time;
      // «Жидкость»: плоскость несколько раз плавно изгибается синусами, их фаза плывёт со временем.
      // Дальше по искривлённым координатам считается мягкая волна, и она красится палитрой.
      vec2 q = p * 0.7;
      q += 0.55 * vec2(sin(q.y * 1.3 + t * 1.0), cos(q.x * 1.1 - t * 0.8));
      q += 0.35 * vec2(sin(q.y * 2.1 - t * 0.7 + 1.7), cos(q.x * 1.9 + t * 0.9 + 0.6));
      q += 0.12 * vec2(sin(q.y * 3.3 + t * 0.6 + 3.1), cos(q.x * 3.0 - t * 0.5));
      float w = q.x * 0.9 + q.y * 0.7;
      float v = 0.5 + 0.5 * sin(w * 1.6 + 1.2 * sin(q.x * 1.3 - q.y * 1.1 + t * 0.5));
      gl_FragColor = vec4(palette(v), 1.);
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
  const resLoc = gl.getUniformLocation(program, 'u_res');
  const timeLoc = gl.getUniformLocation(program, 'u_time');

  const startedAt = performance.now();
  let active = false;
  let frame = 0;

  const draw = () => {
    gl.uniform1f(timeLoc, ((performance.now() - startedAt) / 1000) * SPEED);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resize = () => {
    const w = Math.max(2, Math.round(document.documentElement.clientWidth * RES));
    const h = Math.max(2, Math.round(window.innerHeight * RES));
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
    draw();
    frame = requestAnimationFrame(loop);
  };

  resize();
  draw();

  return {
    resize,
    // Крутим холст только пока градиент виден на экране
    setActive(on) {
      active = on;
      if (on && animated && !frame && !document.hidden) frame = requestAnimationFrame(loop);
    },
    wake() {
      if (active && animated && !frame && !document.hidden) frame = requestAnimationFrame(loop);
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
  const probe = reveal.querySelector('.reveal__probe');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SMOOTHING = reduceMotion ? 1 : 0.4; // 1 = без сглаживания, меньше = плавнее (но и мягче)
  let peek = 0.103; // доля высоты экрана, на которую блок выглядывает в начале (берётся из CSS: --peek)

  let current = 0; // сглаженный прогресс раскрытия
  let target = 0;
  let frame = null;
  let distance = 1; // сколько скроллить до полного раскрытия
  let extra = 0; // на сколько хиро выше экрана (на маленьких экранах)
  let start = 0; // положение верха блока в самом начале
  let startWidth = 0; // ширина окна градиента в самом начале
  let startHeight = 0; // высота окна градиента в самом начале

  const measure = () => {
    distance = reveal.offsetHeight || 1;
    extra = Math.max(0, hero.offsetHeight - window.innerHeight);
    peek = parseFloat(getComputedStyle(reveal).getPropertyValue('--peek')) || 0.103;
    start = window.innerHeight * (1 - peek);
    startWidth = probe ? probe.offsetWidth : window.innerWidth * 0.32;
    startHeight = probe ? probe.offsetHeight : window.innerHeight * 0.2;
  };

  const render = () => {
    const sigma = window.scrollY - extra; // скролл, отсчитанный от момента, когда низ хиро у низа экрана
    const y = (1 - current) * start + Math.max(0, -sigma) - Math.max(0, sigma - distance);
    reveal.style.setProperty('--p', current.toFixed(4));
    reveal.style.setProperty('--y', `${y.toFixed(1)}px`);
    // Окно градиента: прямоугольник [верх y; ширина и высота растут от стартовых до экрана]
    const screenW = document.documentElement.clientWidth;
    const screenH = window.innerHeight;
    const boxW = startWidth + (screenW - startWidth) * current;
    const boxH = startHeight + (screenH - startHeight) * current;
    media.style.setProperty('--ct', `${Math.max(0, y).toFixed(1)}px`);
    media.style.setProperty('--cb', `${Math.max(0, screenH - y - boxH).toFixed(1)}px`);
    media.style.setProperty('--cs', `${((screenW - boxW) / 2).toFixed(1)}px`);
    // Пока градиент под шапкой, инверсию текста шапки выключаем (на градиенте она даёт грязные цвета)
    if (header) {
      const onMedia = y < header.offsetHeight && y + boxH > 0;
      header.classList.toggle('is-on-media', onMedia);
      document.documentElement.classList.toggle('is-media-under-header', onMedia); // для кнопки шапки, она вне <header>
    }
    // Дрейф градиента запускается, когда он впервые раскрылся на весь экран, и дальше идёт
    // всё время, пока блок виден (при скролле не прерывается и не сбрасывается)
    if (current > 0.995) reveal.classList.add('is-armed');
    const live = y > -window.innerHeight;
    reveal.classList.toggle('is-live', live);
    if (shader) shader.setActive(live);
  };

  const tick = () => {
    current += (target - current) * SMOOTHING;
    if (Math.abs(target - current) < 0.0005) current = target;
    render();
    frame = current === target ? null : requestAnimationFrame(tick);
  };

  const update = () => {
    target = Math.min(1, Math.max(0, (window.scrollY - extra) / distance));
    render();
    if (!frame) frame = requestAnimationFrame(tick);
  };

  // Живой градиент (WebGL); без него остаётся картинка
  const canvas = reveal.querySelector('.reveal__canvas');
  const shader = canvas ? createGradient(canvas, !reduceMotion) : null;
  if (shader) {
    reveal.classList.add('has-shader');
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      reveal.classList.remove('has-shader');
    });
    document.addEventListener('visibilitychange', () => shader.wake());
  }

  measure();
  target = Math.min(1, Math.max(0, (window.scrollY - extra) / distance));
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
      parts.forEach((text) => {
        const item = document.createElement('span');
        item.className = 'marquee__item';
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

  let frame = null;

  const render = () => {
    frame = null;
    const distance = Math.max(1, pin.offsetHeight - stage.offsetHeight); // длина закреплённой части
    const rect = pin.getBoundingClientRect();
    let p = Math.min(1, Math.max(0, -rect.top / distance)); // 0, пока сцена не дошла до верха экрана
    if (reduceMotion) p = p >= 0.5 ? 1 : 0; // без плавной заливки, сразу белый
    const eased = 1 - (1 - p) * (1 - p); // в начале быстрее, к концу замедляется

    section.style.setProperty('--f', eased.toFixed(4));

    // Работы и кнопка появляются, когда заливка закончилась (с запасом, чтобы не мигало)
    if (p >= 0.98) section.classList.add('is-in');
    else if (p < 0.7) section.classList.remove('is-in');

    if (cta) {
      const mid = header ? header.offsetHeight / 2 : 40;
      // Кнопка шапки темнеет, только когда заливка полностью белая (то же условие, что и is-in)
      cta.classList.toggle('is-on-light', section.classList.contains('is-in') && section.getBoundingClientRect().bottom > mid);
    }
  };

  const update = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  render();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
});
