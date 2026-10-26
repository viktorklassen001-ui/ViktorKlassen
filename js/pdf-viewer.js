// Artikel-Leser: lädt pdf.js erst beim Öffnen und zeichnet jede Seite, sobald sie in Sichtweite kommt
(() => {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  let pdfjsPromise = null;

  const loadPdfJs = () => {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsPromise) {
      pdfjsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${PDFJS}pdf.min.js`;
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.js`;
          resolve(window.pdfjsLib);
        };
        script.onerror = () => {
          pdfjsPromise = null;
          reject(new Error('pdf.js konnte nicht geladen werden'));
        };
        document.head.append(script);
      });
    }
    return pdfjsPromise;
  };

  const mount = (container) => {
    const scroller = container.querySelector('.pdf-scroll');
    const list = container.querySelector('.pdf-pages');
    const status = container.querySelector('.pdf-status');
    const current = container.querySelector('.pdf-current');
    const total = container.querySelector('.pdf-total');
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pages = [];
    let doc = null;
    let task = null;
    let observer = null;
    let destroyed = false;
    let resizeTimer = 0;
    let frame = 0;

    // Seite in voller Breite des Lesers zeichnen; ändert sich die Breite währenddessen, wird nachgezeichnet
    const draw = async (entry) => {
      const width = list.clientWidth;
      if (destroyed || !width || entry.busy || entry.width === width) return;
      entry.busy = true;
      try {
        const page = entry.page || (entry.page = await doc.getPage(entry.number));
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        entry.render = page.render({ canvasContext: canvas.getContext('2d'), viewport });
        await entry.render.promise;
        if (!destroyed) {
          entry.el.style.aspectRatio = `${base.width} / ${base.height}`;
          entry.el.replaceChildren(canvas);
          entry.width = width;
          status.hidden = true;
        }
      } catch (error) {
        // Abgebrochenes Zeichnen (z. B. beim Schließen) braucht keine Meldung
      }
      entry.busy = false;
      entry.render = null;
      if (!destroyed && entry.visible && entry.width !== list.clientWidth) draw(entry);
    };

    // Seitenanzeige: die Seite, die gerade die Mitte des sichtbaren Bereichs kreuzt
    const updateCounter = () => {
      frame = 0;
      if (!pages.length) return;
      const box = scroller.getBoundingClientRect();
      const middle = (Math.max(box.top, 0) + Math.min(box.bottom, window.innerHeight)) / 2;
      let number = 1;
      pages.forEach((entry) => {
        if (entry.el.getBoundingClientRect().top <= middle) number = entry.number;
      });
      current.textContent = String(number);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateCounter);
    };

    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        pages.forEach((entry) => {
          if (entry.visible) draw(entry);
        });
        onScroll();
      }, 150);
    });

    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    loadPdfJs()
      .then((lib) => {
        if (destroyed) return null;
        // Ohne eval: Die Artifact-Seite erlaubt kein dynamisch erzeugtes JavaScript
        task = lib.getDocument({ url: container.dataset.pdf, isEvalSupported: false });
        return task.promise;
      })
      .then(async (pdf) => {
        if (!pdf || destroyed) return;
        doc = pdf;
        const first = await pdf.getPage(1);
        if (destroyed) return;
        const base = first.getViewport({ scale: 1 });
        total.textContent = String(pdf.numPages);

        // Im breiten Layout scrollt der Leser in sich, im schmalen scrollt die ganze Seite
        const scrollsItself = getComputedStyle(scroller).overflowY !== 'visible';
        observer = new IntersectionObserver((items) => {
          items.forEach((item) => {
            const entry = pages.find((p) => p.el === item.target);
            entry.visible = item.isIntersecting;
            if (entry.visible) draw(entry);
          });
        }, { root: scrollsItself ? scroller : null, rootMargin: '100% 0px' });

        for (let number = 1; number <= pdf.numPages; number += 1) {
          const el = document.createElement('div');
          el.className = 'pdf-page';
          el.style.aspectRatio = `${base.width} / ${base.height}`;
          el.setAttribute('role', 'img');
          el.setAttribute('aria-label', `Seite ${number} von ${pdf.numPages}`);
          list.append(el);
          pages.push({ number, el, page: number === 1 ? first : null, width: 0, visible: false, busy: false, render: null });
          observer.observe(el);
        }
        resizeObserver.observe(list);
        updateCounter();
      })
      .catch(() => {
        if (destroyed) return;
        status.hidden = false;
        status.textContent = 'Der Artikel konnte nicht geladen werden.';
      });

    return {
      destroy() {
        destroyed = true;
        clearTimeout(resizeTimer);
        cancelAnimationFrame(frame);
        if (observer) observer.disconnect();
        resizeObserver.disconnect();
        scroller.removeEventListener('scroll', onScroll);
        window.removeEventListener('scroll', onScroll);
        pages.forEach((entry) => {
          if (entry.render) entry.render.cancel();
        });
        if (task) task.destroy();
      },
    };
  };

  window.PdfViewer = { mount };
})();
