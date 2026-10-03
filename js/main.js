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
