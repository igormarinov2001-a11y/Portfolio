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


// Градиент, накрывающий хиро. Блок закреплён на экране; пока скролл проходит
// «reveal-distance» (высота пустого блока .reveal), он поднимается снизу и растёт до полного
// экрана, закрывая хиро, а дальше уезжает вверх вместе со страницей и стыкуется с About.
// --p (0…1) — насколько блок раскрыт, --y — его положение по вертикали.
document.querySelectorAll('[data-reveal]').forEach((reveal) => {
  const hero = document.querySelector('.hero');
  const header = document.querySelector('.header');
  const media = reveal.querySelector('.reveal__media');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SMOOTHING = reduceMotion ? 1 : 0.4; // 1 = без сглаживания, меньше = плавнее (но и мягче)
  const PEEK = 0.103; // доля высоты экрана, на которую блок выглядывает в начале (как в CSS)

  let current = 0; // сглаженный прогресс раскрытия
  let target = 0;
  let frame = null;
  let distance = 1; // сколько скроллить до полного раскрытия
  let extra = 0; // на сколько хиро выше экрана (на маленьких экранах)
  let start = 0; // положение верха блока в самом начале

  const measure = () => {
    distance = reveal.offsetHeight || 1;
    extra = Math.max(0, hero.offsetHeight - window.innerHeight);
    start = window.innerHeight * (1 - PEEK);
  };

  const render = () => {
    const sigma = window.scrollY - extra; // скролл, отсчитанный от момента, когда низ хиро у низа экрана
    const y = (1 - current) * start + Math.max(0, -sigma) - Math.max(0, sigma - distance);
    reveal.style.setProperty('--p', current.toFixed(4));
    reveal.style.setProperty('--y', `${y.toFixed(1)}px`);
    // Пока градиент под шапкой, инверсию текста шапки выключаем (на градиенте она даёт грязные цвета)
    if (header) {
      const box = media.getBoundingClientRect();
      header.classList.toggle('is-on-media', box.top < header.offsetHeight && box.bottom > 0);
    }
    // Дрейф градиента запускается, когда он впервые раскрылся на весь экран, и дальше идёт
    // всё время, пока блок виден (при скролле не прерывается и не сбрасывается)
    if (current > 0.995) reveal.classList.add('is-armed');
    reveal.classList.toggle('is-live', y > -window.innerHeight);
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

  measure();
  target = Math.min(1, Math.max(0, (window.scrollY - extra) / distance));
  current = target; // при перезагрузке страницы посреди скролла сразу ставим нужный размер
  render();

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    measure();
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
