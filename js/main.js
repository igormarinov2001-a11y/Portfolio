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
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SMOOTHING = reduceMotion ? 1 : 0.15; // 1 = без сглаживания, меньше = плавнее
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


// Текст в About: буквы серые (белый 40%) и по мере скролла по очереди, по одной,
// заливаются белым. Фронт заливки узкий: одновременно «горят» всего несколько букв.
document.querySelectorAll('[data-scrub]').forEach((block) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // остаётся белым

  const START_AT = 0.85; // начинаем, когда верх текста поднялся до 85% высоты экрана
  const END_AT = 0.6; // заканчиваем, когда низ текста поднялся до 60% высоты экрана
  const BASE = 0.4; // прозрачность незаполненной буквы
  const OVERLAP = 3; // сколько букв «горят» одновременно (меньше = резче фронт заливки)

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
        char.style.setProperty('--a', BASE);
        word.append(char);
        chars.push(char);
      }
      line.append(word);
      if (i < parts.length - 1) line.append(' ');
    });
  });

  const alpha = new Array(chars.length).fill(BASE);
  let startScroll = 0;
  let endScroll = 1;
  let frame = null;

  const measure = () => {
    const top = block.getBoundingClientRect().top + window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    startScroll = top - window.innerHeight * START_AT;
    endScroll = Math.min(top + block.offsetHeight - window.innerHeight * END_AT, maxScroll);
    if (endScroll <= startScroll + 1) endScroll = startScroll + 1;
  };

  const render = () => {
    frame = null;
    const q = Math.min(1, Math.max(0, (window.scrollY - startScroll) / (endScroll - startScroll)));
    chars.forEach((char, i) => {
      const local = Math.min(1, Math.max(0, (q * (chars.length - 1 + OVERLAP) - i) / OVERLAP));
      const value = +(BASE + (1 - BASE) * local).toFixed(3);
      if (value !== alpha[i]) {
        alpha[i] = value;
        char.style.setProperty('--a', value);
      }
    });
  };

  const update = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  measure();
  render();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    measure();
    update();
  });
});
