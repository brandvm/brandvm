interface ReadMoreElement extends HTMLElement { _rmDone?: ((event: TransitionEvent) => void) | null; }

export function initReadMore() {
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');

  function cardOf(el: Element) {
    return el.closest('[data-readmore="card"]') || el.closest('.w-dyn-item');
  }

  function setLabel(toggle: HTMLElement, expanded: boolean) {
    var label = toggle.querySelector('[data-readmore="label"]') || toggle;
    label.textContent = expanded ?
      (toggle.getAttribute('data-less-text') || 'Read Less −') :
      (toggle.getAttribute('data-more-text') || 'Read More +');
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function afterMaxHeight(el: ReadMoreElement, fn: () => void) {
    if (el._rmDone) el.removeEventListener('transitionend', el._rmDone);
    el._rmDone = function (e) {
      if (e.target !== el || e.propertyName !== 'max-height') return;
      el.removeEventListener('transitionend', el._rmDone!);
      el._rmDone = null;
      fn();
    };
    el.addEventListener('transitionend', el._rmDone);
  }

  function expand(text: ReadMoreElement) {
    if (REDUCE.matches) { text.classList.add('is-expanded'); return; }
    var startH = text.offsetHeight;
    text.classList.add('is-expanded');
    text.style.maxHeight = '';
    var endH = text.scrollHeight;
    text.style.maxHeight = startH + 'px';
    void text.offsetHeight;
    text.style.maxHeight = endH + 'px';
    afterMaxHeight(text, function () { text.style.maxHeight = 'none'; });
  }

  function collapse(text: ReadMoreElement) {
    if (REDUCE.matches) { text.classList.remove('is-expanded'); return; }
    var startH = text.offsetHeight;
    text.classList.remove('is-expanded');
    text.style.maxHeight = '';
    var endH = text.offsetHeight;
    text.classList.add('is-expanded');
    text.style.maxHeight = startH + 'px';
    void text.offsetHeight;
    text.style.maxHeight = endH + 'px';
    afterMaxHeight(text, function () {
      text.classList.remove('is-expanded');
      text.style.maxHeight = '';
    });
  }

  document.addEventListener('click', function (e) {
    var toggle = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-readmore="toggle"]') : null;
    if (!toggle) return;
    e.preventDefault();
    var card = cardOf(toggle);
    var text = card && card.querySelector<ReadMoreElement>('[data-readmore="text"]');
    if (!text) return;
    var expanded = !text.classList.contains('is-expanded');
    if (expanded) expand(text);
    else collapse(text);
    setLabel(toggle, expanded);
  });

  function checkToggles() {
    document.querySelectorAll<ReadMoreElement>('[data-readmore="text"]').forEach(function (text) {
      if (text.classList.contains('is-expanded')) return;
      var card = cardOf(text);
      var toggle = card && card.querySelector<HTMLElement>('[data-readmore="toggle"]');
      if (!toggle) return;
      toggle.style.display = (text.scrollHeight > text.clientHeight + 1) ? '' : 'none';
    });
  }

  var rT: number | undefined;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = window.setTimeout(checkToggles, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(checkToggles);
  checkToggles();

  document.querySelectorAll('[data-readmore="toggle"]').forEach(function (t) {
    t.setAttribute('role', 'button');
    t.setAttribute('aria-expanded', 'false');
  });
}
