(() => {
  const root = document.documentElement;
  if (!root.lang) root.lang = 'de';

  // Jahreszahl im Footer aktuell halten
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = year;
  });

  // Platzhalter-Links (href="#") sollen nicht an den Seitenanfang springen
  document.addEventListener('click', (event) => {
    if (event.target.closest('a[href="#"]')) event.preventDefault();
  });

  // Mobile Navigation
  const header = document.getElementById('site-header');
  const toggle = document.getElementById('menu-toggle');
  const toggleLabel = toggle.querySelector('.menu-toggle-label');
  const nav = document.getElementById('site-nav');
  const desktop = window.matchMedia('(min-width: 64em)');

  const setMenu = (open) => {
    header.toggleAttribute('data-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? 'Schließen' : 'Menü';
    root.classList.toggle('menu-open', open);
  };

  toggle.addEventListener('click', () => setMenu(!header.hasAttribute('data-open')));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.hasAttribute('data-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  desktop.addEventListener('change', (event) => {
    if (event.matches) setMenu(false);
  });

  // Aktiven Abschnitt in der Navigation markieren
  const links = new Map();
  nav.querySelectorAll('a[href^="#"]').forEach((link) => {
    links.set(link.getAttribute('href').slice(1), link);
  });

  const setCurrent = (id) => {
    if (!links.has(id)) return;
    links.forEach((link, key) => {
      if (key === id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setCurrent(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    links.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  setCurrent(location.hash.slice(1) || 'start');

  // E-Mail-Adresse kopieren
  const copyButton = document.getElementById('copy-email');
  const address = document.getElementById('contact-address');
  const status = document.getElementById('copy-status');
  let statusTimer;

  const showStatus = (message) => {
    status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.textContent = '';
    }, 3500);
  };

  const selectAddress = () => {
    const range = document.createRange();
    range.selectNodeContents(address);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showStatus('Adresse markiert – bitte mit Strg+C bzw. ⌘+C kopieren.');
  };

  if (copyButton && address && status) {
    copyButton.addEventListener('click', () => {
      const email = address.getAttribute('href').replace(/^mailto:/, '');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(
          () => showStatus('E-Mail-Adresse kopiert.'),
          selectAddress
        );
      } else {
        selectAddress();
      }
    });
  }

  // Hobby-Skizzen: Ohne Maus (Touch) entstehen sie, sobald die Kachel gut sichtbar ist
  if (window.matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
    const hobbyObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-active', entry.isIntersecting));
    }, { threshold: 0.6 });
    document.querySelectorAll('.hobby').forEach((tile) => hobbyObserver.observe(tile));
  }

  // Grundriss eines OP-Projekts: Ein Klick auf einen Raum zeigt seinen Namen im Plan, darunter Fläche und Fotos
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const showRoom = (room) => {
    const plan = room.closest('.op-plan');
    const svg = room.ownerSVGElement;
    plan.querySelectorAll('.op-room.is-active').forEach((r) => r.classList.remove('is-active'));
    room.classList.add('is-active');

    // Namensschild mittig über dem Raum
    let tag = svg.querySelector('.op-tag');
    if (!tag) {
      tag = document.createElementNS(SVG_NS, 'g');
      tag.setAttribute('class', 'op-tag');
      tag.append(document.createElementNS(SVG_NS, 'rect'), document.createElementNS(SVG_NS, 'text'));
      svg.append(tag);
    }
    const [rect, text] = tag.children;
    text.textContent = room.dataset.room;
    const box = room.getBBox();
    const width = text.getComputedTextLength() + 44;
    const x = Math.min(2000 - width - 10, Math.max(10, box.x + box.width / 2 - width / 2));
    const y = Math.max(10, box.y + box.height / 2 - 34);
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', 68);
    rect.setAttribute('rx', 34);
    text.setAttribute('x', x + 22);
    text.setAttribute('y', y + 47);

    // Fläche und Fotos unter dem Plan
    const info = plan.querySelector('.op-plan-info');
    const title = document.createElement('p');
    title.className = 'op-plan-title';
    const name = document.createElement('span');
    name.textContent = room.dataset.room;
    const area = document.createElement('span');
    area.className = 'op-plan-area';
    area.textContent = `${room.dataset.area} m²`;
    title.append(name, area);
    const photos = (room.dataset.photos || '').split(',').filter(Boolean);
    const content = [title];
    if (photos.length) {
      const list = document.createElement('ul');
      list.className = 'op-plan-photos';
      photos.forEach((photo, i) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'book-plate op-photo';
        button.dataset.full = `images/op-projekt/${photo}.jpg`;
        const img = document.createElement('img');
        img.src = `images/op-projekt/${photo}-klein.jpg`;
        img.alt = `${room.dataset.room}, Foto ${i + 1}`;
        button.append(img);
        item.append(button);
        list.append(item);
      });
      content.push(list);
    } else {
      const none = document.createElement('p');
      none.className = 'op-plan-hint';
      none.textContent = 'Für diesen Raum gibt es kein Foto.';
      content.push(none);
    }
    info.replaceChildren(...content);
  };

  document.addEventListener('click', (event) => {
    const room = event.target.closest('.op-room');
    if (room) showRoom(room);
  });
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest && event.target.closest('.op-room')) {
      event.preventDefault();
      showRoom(event.target.closest('.op-room'));
    }
  });

  // Großansicht für Illustrationen: Klick auf ein Vorschaubild öffnet es, Klick, Esc oder „Schließen“ beendet sie
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    const lightboxImage = lightbox.querySelector('.lightbox-image');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    let lightboxTrigger = null;

    const closeLightbox = () => {
      lightbox.hidden = true;
      lightboxImage.removeAttribute('src');
      root.classList.remove('lightbox-open');
      if (lightboxTrigger) lightboxTrigger.focus({ preventScroll: true });
      lightboxTrigger = null;
    };

    document.addEventListener('click', (event) => {
      const plate = event.target.closest('[data-full]');
      if (!plate) return;
      const thumb = plate.querySelector('img');
      lightboxTrigger = plate;
      lightboxImage.src = plate.dataset.full;
      lightboxImage.alt = thumb ? thumb.alt : '';
      lightbox.hidden = false;
      root.classList.add('lightbox-open');
      lightboxClose.focus({ preventScroll: true });
    });

    lightbox.addEventListener('click', closeLightbox);

    // In der Capture-Phase, damit Esc nicht zugleich die Detailseite schließt
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || lightbox.hidden) return;
      event.stopPropagation();
      closeLightbox();
    }, true);
  }

  // Werdegang-Bereiche (akademisch und beruflich): Die Liste schiebt sich wie eine Karte vom Stapel nach links
  // über den Titel, rechts daneben wird die Detailseite sichtbar. In schmalen Fenstern ersetzt die Detailseite die Liste.
  const twoColumns = window.matchMedia('(min-width: 56.25em)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const restart = (el, className) => {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  };

  // „Meine Tätigkeit“ als Kartenstapel: Zu sehen sind nur die Überschriften, gestaffelt untereinander.
  // Ein Klick legt die Karte nach vorn und klappt ihren Text auf, die übrigen Karten rutschen dahinter in den Stapel.
  const DECK_OVERLAP = 10;
  const DECK_PEEK = 9;
  const DECK_ICON = '<svg class="deck-icon" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 5.5 7 9.5 11 5.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let deckCount = 0;

  const initDeck = (list) => {
    deckCount += 1;
    const cards = [...list.children];
    const heads = [];
    const bodies = [];
    const contents = [];
    let openIndex = -1;

    cards.forEach((card, i) => {
      const name = card.querySelector('.portfolio-name');
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'deck-head';
      head.setAttribute('aria-expanded', 'false');
      const body = document.createElement('div');
      body.className = 'deck-body';
      body.id = `deck-${deckCount}-${i}`;
      body.inert = true;
      head.setAttribute('aria-controls', body.id);
      const inner = document.createElement('div');
      inner.className = 'deck-inner';
      const content = document.createElement('div');
      content.className = 'deck-content';
      [...card.childNodes].forEach((node) => {
        if (node !== name) content.append(node);
      });
      head.append(name);
      head.insertAdjacentHTML('beforeend', DECK_ICON);
      inner.append(content);
      body.append(inner);
      card.replaceChildren(head, body);
      card.classList.add('deck-card');
      heads.push(head);
      bodies.push(body);
      contents.push(content);
    });
    list.classList.add('deck');

    // Geschlossen: Karten gestaffelt, jede überdeckt den unteren Rand der vorherigen.
    // Offen: die gewählte Karte vorn, die übrigen schauen nur noch unten als schmale Kanten hervor.
    const layout = () => {
      const headHeights = heads.map((head) => head.offsetHeight);
      if (!headHeights[0]) return;
      if (openIndex < 0) {
        let y = 0;
        cards.forEach((card, i) => {
          card.style.transform = `translateY(${y}px)`;
          card.style.zIndex = String(i + 1);
          y += headHeights[i] - DECK_OVERLAP;
        });
        list.style.height = `${y + DECK_OVERLAP}px`;
        return;
      }
      const openHeight = headHeights[openIndex] + contents[openIndex].offsetHeight;
      let behind = 0;
      cards.forEach((card, i) => {
        if (i === openIndex) {
          card.style.transform = 'translateY(0px)';
          card.style.zIndex = String(cards.length + 1);
          return;
        }
        behind += 1;
        const y = openHeight - headHeights[i] + behind * DECK_PEEK;
        card.style.transform = `translateY(${y}px) scale(${1 - behind * 0.04})`;
        card.style.zIndex = String(cards.length - behind);
      });
      list.style.height = `${openHeight + (cards.length - 1) * DECK_PEEK}px`;
    };

    const setOpen = (index) => {
      openIndex = index;
      cards.forEach((card, i) => {
        const on = i === index;
        const behind = index >= 0 && !on;
        card.classList.toggle('is-open', on);
        card.classList.toggle('is-behind', behind);
        card.setAttribute('aria-hidden', String(behind));
        heads[i].setAttribute('aria-expanded', String(on));
        heads[i].tabIndex = behind ? -1 : 0;
        bodies[i].inert = !on;
      });
      layout();
      // Die Detailseite kann Inhalte an die geöffnete Karte koppeln (data-reveal → data-show-for / data-hide-for)
      const key = index >= 0 ? cards[index].dataset.reveal || '' : '';
      list.dispatchEvent(new CustomEvent('deck:change', { bubbles: true, detail: { key } }));
    };

    const onClick = (event) => {
      const card = event.target.closest('.deck-card');
      if (!card) return;
      const index = cards.indexOf(card);
      if (index === openIndex) {
        if (event.target.closest('.deck-head')) setOpen(-1);
      } else {
        // Eine Karte hinten im Stapel führt zurück zur Übersicht
        setOpen(openIndex >= 0 ? -1 : index);
      }
    };
    list.addEventListener('click', onClick);

    const resizeObserver = new ResizeObserver(() => layout());
    resizeObserver.observe(list);
    layout();
    if (document.fonts) document.fonts.ready.then(layout);
    // Übergänge erst nach der ersten Anordnung, damit die Karten nicht einfliegen
    requestAnimationFrame(() => list.classList.add('is-ready'));

    return {
      destroy() {
        resizeObserver.disconnect();
        list.removeEventListener('click', onClick);
      },
    };
  };

  const initStack = (career) => {
    const careerList = career.querySelector('.career-list');
    const careerDetail = career.querySelector('.career-detail');
    const careerBody = career.querySelector('.career-detail-body');
    if (!careerList || !careerDetail || !careerBody) return;

    const section = career.closest('.section');
    const triggers = [...career.querySelectorAll('[data-detail]')];
    const careerAside = career.querySelector('.career-aside');
    const careerArticle = career.querySelector('.career-article');
    let activeTrigger = null;
    let asideWidget = null;
    let articleViewer = null;

    // Die Liste behält ihre Breite aus der geschlossenen Ansicht (7 von 12 Spaltenanteilen),
    // damit beim Verschieben kein Text neu umbricht
    const layout = () => {
      const style = getComputedStyle(section);
      const available = section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const closedWidth = Math.min(available, 1120);
      const gap = Math.min(88, Math.max(40, window.innerWidth * 0.05));
      const side = twoColumns.matches && available >= 820;
      const listWidth = ((closedWidth - gap) * 7) / 12;
      career.style.setProperty('--list-w', `${listWidth}px`);
      career.classList.toggle('is-side', side);
      career.classList.toggle('is-swap', !side);

      // Artikelansicht: Der Stapel wird schmaler, damit der Artikel rechts mehr Platz bekommt.
      // Die Detailseite behält ihre Breite und wird wie die Liste nur verkleinert.
      ['--s', '--ds', '--detail-w'].forEach((name) => career.style.removeProperty(name));
      if (side && career.classList.contains('is-article')) {
        const grid = getComputedStyle(career);
        const sideScale = parseFloat(grid.getPropertyValue('--s')) || 0.86;
        const columnGap = parseFloat(grid.columnGap) || 40;
        const detailWidth = available - listWidth * sideScale - columnGap;
        const articleWidth = Math.min(available * 0.64, 920);
        const scale = Math.min(sideScale, Math.max(0.5, (available - articleWidth - columnGap) / listWidth));
        career.style.setProperty('--s', String(scale));
        career.style.setProperty('--detail-w', `${detailWidth}px`);
        career.style.setProperty('--ds', String(((listWidth + 48) * scale) / detailWidth));
      }
      alignAside();
    };

    const snapshot = (el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, top: rect.top, scale: rect.width / (el.offsetWidth || rect.width || 1) };
    };

    // FLIP: Die Karte startet optisch an ihrer alten Stelle und gleitet an die neue
    const slide = (el, from, tilt) => {
      el.classList.remove('is-moving');
      if (reduceMotion.matches) return;
      const to = snapshot(el);
      el.style.setProperty('--dx', `${from.left - to.left}px`);
      el.style.setProperty('--dy', `${from.top - to.top}px`);
      el.style.setProperty('--from-s', String(from.scale));
      el.style.setProperty('--to-s', String(to.scale));
      el.style.setProperty('--tilt', `${tilt}deg`);
      restart(el, 'is-moving');
    };

    [careerList, careerDetail].forEach((el) => {
      el.addEventListener('animationend', (event) => {
        if (event.target === el && event.animationName === 'stack-move') el.classList.remove('is-moving');
      });
    });

    const setActive = (trigger) => {
      activeTrigger = trigger;
      triggers.forEach((t) => {
        const on = t === trigger;
        t.setAttribute('aria-expanded', String(on));
        t.closest('.entry').classList.toggle('is-active', on);
      });
    };

    // Die Visualisierung beginnt 40 px unter dem verkleinerten Kartenstapel (Liste und ggf. aufgelegte Detailseite)
    const alignAside = () => {
      if (!careerAside || careerAside.hidden) return;
      careerAside.style.marginTop = '';
      if (!career.classList.contains('is-side')) return;
      const style = getComputedStyle(career);
      const scale = parseFloat(style.getPropertyValue('--s')) || 1;
      let bottom = careerList.offsetTop + careerList.offsetHeight * scale;
      if (career.classList.contains('is-article')) {
        const detailScale = parseFloat(style.getPropertyValue('--ds')) || 1;
        bottom = Math.max(bottom, careerDetail.offsetTop + careerDetail.offsetHeight * detailScale);
      }
      careerAside.style.marginTop = `${bottom + 40 - careerAside.offsetTop}px`;
    };

    const clearAside = () => {
      if (asideWidget) asideWidget.destroy();
      asideWidget = null;
      if (careerAside) {
        careerAside.replaceChildren();
        careerAside.hidden = true;
        careerAside.style.marginTop = '';
      }
      career.classList.remove('has-aside');
    };

    // Manche Stationen haben eine begleitende Visualisierung (Template „<id>-aside“), z. B. die Knie-Animation
    const fillAside = (templateId) => {
      clearAside();
      const template = careerAside && document.getElementById(`${templateId}-aside`);
      if (!template) return;
      careerAside.replaceChildren(template.content.cloneNode(true));
      careerAside.hidden = false;
      career.classList.add('has-aside');
      const knee = careerAside.querySelector('[data-knee]');
      if (knee && window.KneeAnimation) asideWidget = window.KneeAnimation.mount(knee);
      const rig = careerAside.querySelector('[data-rig]');
      if (rig && window.TesterAnimation) asideWidget = window.TesterAnimation.mount(rig);
    };

    // Kartenstapel in der Detailseite („Meine Tätigkeit“) aufbauen und beim Wechsel wieder abräumen
    let decks = [];
    const clearDecks = () => {
      decks.forEach((deck) => deck.destroy());
      decks = [];
    };
    const buildDecks = () => {
      clearDecks();
      decks = [...careerBody.querySelectorAll('.portfolio')].map(initDeck);
    };

    // Öffnet sich eine Karte mit data-reveal, tauscht die Detailseite passende Abschnitte aus
    careerBody.addEventListener('deck:change', (event) => {
      const { key } = event.detail;
      careerBody.querySelectorAll('[data-show-for]').forEach((el) => {
        el.hidden = el.dataset.showFor !== key;
      });
      careerBody.querySelectorAll('[data-hide-for]').forEach((el) => {
        el.hidden = el.dataset.hideFor === key;
      });
    });

    const bringIntoView = (el) => {
      const offset = desktop.matches ? 32 : 80;
      const top = el.getBoundingClientRect().top - offset;
      if (top < 0 || top > window.innerHeight * 0.6) {
        window.scrollBy({ top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
    };

    const resetArticle = () => {
      if (articleViewer) articleViewer.destroy();
      articleViewer = null;
      if (careerArticle) {
        careerArticle.replaceChildren();
        careerArticle.hidden = true;
      }
      career.classList.remove('is-article');
      ['--s', '--ds', '--detail-w'].forEach((name) => career.style.removeProperty(name));
    };

    // Artikel einer Station: Die Detailseite legt sich als oberste Karte auf den Stapel,
    // rechts öffnet sich der Artikel in einem breiteren Fenster
    const openArticle = (link) => {
      const template = careerArticle && document.getElementById(link.dataset.article);
      if (!template || !window.PdfViewer) return;
      const fromList = snapshot(careerList);
      const fromDetail = snapshot(careerDetail);
      careerArticle.replaceChildren(template.content.cloneNode(true));
      careerArticle.hidden = false;
      careerDetail.classList.add('no-reveal');
      career.classList.add('is-article');
      layout();
      const side = career.classList.contains('is-side');
      if (side) {
        slide(careerList, fromList, -0.8);
        slide(careerDetail, fromDetail, -1.2);
      }
      articleViewer = window.PdfViewer.mount(careerArticle.querySelector('[data-pdf]'));
      bringIntoView(side ? career : careerArticle);
      const title = careerArticle.querySelector('.detail-title');
      if (title) title.focus({ preventScroll: true });
    };

    const closeArticle = () => {
      if (!career.classList.contains('is-article')) return;
      const fromList = snapshot(careerList);
      const fromDetail = snapshot(careerDetail);
      resetArticle();
      layout();
      const link = careerBody.querySelector('[data-article]');
      if (career.classList.contains('is-side')) {
        slide(careerList, fromList, 0.8);
        slide(careerDetail, fromDetail, 1.2);
      } else if (link) {
        link.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
      if (link) link.focus({ preventScroll: true });
    };

    const openDetail = (trigger) => {
      const template = document.getElementById(trigger.dataset.detail);
      if (!template) return;
      const wasOpen = career.classList.contains('is-open');
      resetArticle();
      careerBody.replaceChildren(template.content.cloneNode(true));
      setActive(trigger);
      fillAside(trigger.dataset.detail);

      if (wasOpen) {
        restart(careerDetail, 'is-switching');
        layout();
      } else {
        const from = snapshot(careerList);
        career.classList.add('is-open');
        layout();
        if (career.classList.contains('is-side')) slide(careerList, from, -1.2);
      }
      buildDecks();

      bringIntoView(career.classList.contains('is-side') ? career : careerDetail);
      const title = careerBody.querySelector('.detail-title');
      if (title) title.focus({ preventScroll: true });
    };

    const closeDetail = () => {
      if (!career.classList.contains('is-open')) return;
      const wasSide = career.classList.contains('is-side');
      resetArticle();
      const from = snapshot(careerList);
      career.classList.remove('is-open', 'is-side', 'is-swap');
      clearAside();
      if (wasSide) slide(careerList, from, 1.2);
      clearDecks();
      careerBody.replaceChildren();
      careerDetail.classList.remove('is-switching', 'no-reveal', 'is-moving');

      const trigger = activeTrigger;
      setActive(null);
      if (trigger) {
        trigger.focus({ preventScroll: true });
        if (!wasSide) trigger.closest('.entry').scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        if (trigger === activeTrigger) closeDetail();
        else openDetail(trigger);
      });
    });

    careerDetail.addEventListener('click', (event) => {
      // Liegt die Detailseite auf dem Stapel, holt ein Klick auf die Karte sie zurück
      if (career.classList.contains('is-article')) {
        event.preventDefault();
        event.stopPropagation();
        closeArticle();
        return;
      }
      const articleLink = event.target.closest('[data-article]');
      if (articleLink) openArticle(articleLink);
      else if (event.target.closest('[data-career-close]')) closeDetail();
    });

    if (careerArticle) {
      careerArticle.addEventListener('click', (event) => {
        if (event.target.closest('[data-article-close]')) closeArticle();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !career.classList.contains('is-open') || header.hasAttribute('data-open')) return;
      if (career.classList.contains('is-article')) closeArticle();
      else closeDetail();
    });

    window.addEventListener('resize', () => {
      if (career.classList.contains('is-open')) layout();
    });
  };

  document.querySelectorAll('.career').forEach(initStack);

  // „(mehr)“ in Einleitungen: klappt die übrigen Absätze auf und wieder zu
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('.more-toggle');
    if (!toggle) return;
    const body = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!body) return;
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '(weniger)' : '(mehr)';
    body.classList.toggle('is-open', open);
    body.inert = !open;
  });
})();
