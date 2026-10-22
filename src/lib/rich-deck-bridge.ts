/** Injected only into the served document; author files and downloads remain untouched. */
const BRIDGE = String.raw`
(() => {
  if (parent === window) return;
  let token = null, last = '', error = null, quiet = false, preview = false;
  let commandQueue = Promise.resolve();
  const parentOrigin = new URL(document.referrer || location.href).origin;
  const api = () => window.amaroadDeck || window.deck;
  function readState() {
    const controller = api();
    if (!controller || typeof controller.getState !== 'function') return null;
    const s = controller.getState();
    if (!s || typeof s !== 'object') throw new Error('HTML getState() must return a slide state');
    const state = window.amaroadDeck ? s : {
      slideIndex: s.scene - 1, stepIndex: s.step,
      slideCount: s.totalScenes, stepCount: s.maxStep + 1
    };
    if (!['slideIndex', 'stepIndex', 'slideCount', 'stepCount'].every(k => Number.isSafeInteger(state[k]))) throw new Error('HTML slide state must contain integer indices and counts');
    if (state.slideCount < 1 || state.stepCount < 1 || state.slideIndex < 0 || state.slideIndex >= state.slideCount ||
        state.stepIndex < 0 || state.stepIndex >= state.stepCount) throw new Error('HTML slide state indices must be within their counts');
    return {slideIndex:state.slideIndex, stepIndex:state.stepIndex, slideCount:state.slideCount, stepCount:state.stepCount};
  }
  function notify(force = false) {
    if (!token || quiet) return;
    try {
      const controller = api();
      const state = readState();
      const canSeek = !!controller && (typeof controller.goTo === 'function' ||
        (state && typeof controller.next === 'function' && typeof controller.previous === 'function'));
      let slides = [];
      if (state && state.slideCount <= 1000) {
        const supplied = controller && typeof controller.getSlides === 'function' ? controller.getSlides() : null;
        const elements = [...document.querySelectorAll('.scene, [data-slide]')];
        slides = Array.from({length:state.slideCount}, (_,index) => {
          const item = Array.isArray(supplied) && supplied.length === state.slideCount ? supplied[index] : null;
          const element = elements.length === state.slideCount ? elements[index] : null;
          return {title:String(item && item.title || element && element.dataset.title || 'Slide ' + (index + 1)).slice(0,1000),
            notes: item && typeof item.notes === 'string' ? item.notes.slice(0,50000) : element && element.dataset.notes || undefined};
        });
      }
      const payload = {
        type:'amaroad:rich:event', token, state, slides,
        capabilities:{next:!!controller && typeof controller.next === 'function',
          previous:!!controller && typeof controller.previous === 'function',
          goTo:!!canSeek},
        ...(error ? {error} : {})
      };
      const serialized = JSON.stringify(payload);
      if (force || serialized !== last) { last = serialized; parent.postMessage(payload, parentOrigin); }
    } catch (e) {
      error = String(e && e.message || e).slice(0,500);
      parent.postMessage({type:'amaroad:rich:event', token, state:null,
        capabilities:{next:false,previous:false,goTo:false}, error}, parentOrigin);
    }
  }
  async function seek(slideIndex, stepIndex) {
    const controller = api();
    if (!controller) return;
    if (typeof controller.goTo === 'function') { await controller.goTo(slideIndex,stepIndex); return; }
    let state = readState();
    if (!state || typeof controller.next !== 'function' || typeof controller.previous !== 'function') return;
    const targetSlide = Math.min(state.slideCount - 1,slideIndex);
    for (let attempt = 0; attempt < 10000; attempt++) {
      const targetStep = state.slideIndex === targetSlide ? Math.min(state.stepCount - 1,stepIndex) : stepIndex;
      if (state.slideIndex === targetSlide && state.stepIndex === targetStep) return;
      const forward = state.slideIndex < targetSlide || (state.slideIndex === targetSlide && state.stepIndex < targetStep);
      await controller[forward ? 'next' : 'previous']();
      const nextState = readState();
      if (!nextState || (nextState.slideIndex === state.slideIndex && nextState.stepIndex === state.stepIndex)) throw new Error('HTML navigation did not advance');
      state = nextState;
    }
    throw new Error('HTML navigation exceeded its step limit');
  }
  function preparePreview() {
    // A queued seek can finish after its hover preview has been removed.
    if (!document.body || !document.head) return;
    const changed = !preview;
    preview = true;
    document.body.dataset.amaroadPreview = 'true';
    document.body.classList.add('reduced');
    if (!document.querySelector('[data-amaroad-preview-style]')) {
      const style = document.createElement('style');
      style.dataset.amaroadPreviewStyle = '';
      style.textContent = '*{animation:none!important;transition:none!important}#controls,#start-hint,body>nav,[data-amaroad-controls]{display:none!important}';
      document.head.append(style);
    }
    document.querySelectorAll('svg').forEach(svg => { if (typeof svg.pauseAnimations === 'function') svg.pauseAnimations(); });
    if (changed) dispatchEvent(new CustomEvent('amaroad:previewchange', {detail:{preview:true}}));
  }
  function prepareEmbeddedControls() {
    const controller = api();
    if (!controller || typeof controller.next !== 'function' || typeof controller.previous !== 'function' || !readState()) return;
    if (!document.querySelector('[data-amaroad-embedded-style]')) {
      const style = document.createElement('style');
      style.dataset.amaroadEmbeddedStyle = '';
      style.textContent = '#controls,#start-hint,[data-amaroad-controls]{display:none!important}';
      document.head.append(style);
    }
  }
  addEventListener('message', async event => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    const m = event.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'amaroad:rich:init' && typeof m.token === 'string') {
      // Parent retries may arrive while a large HTML document is still parsing.
      if (document.readyState === 'loading' || !document.body) return;
      if (token === m.token) { notify(true); return; }
      token = m.token;
      prepareEmbeddedControls();
      if (m.mode === 'preview') preparePreview();
      if (Number.isSafeInteger(m.slideIndex) && m.slideIndex >= 0 && Number.isSafeInteger(m.stepIndex) && m.stepIndex >= 0) {
        commandQueue = commandQueue.then(async () => {
          quiet = true;
          try { await seek(m.slideIndex,m.stepIndex); }
          catch(e) { error = String(e && e.message || e).slice(0,500); }
          finally { quiet = false; if (preview) preparePreview(); notify(true); }
        });
      } else notify(true);
      return;
    }
    if (!token || m.token !== token || m.type !== 'amaroad:rich:command') return;
    const controller = api();
    if (!controller) return;
    commandQueue = commandQueue.then(async () => { quiet = true; try {
      if ((m.action === 'next' || m.action === 'previous') && typeof controller[m.action] === 'function') {
        await controller[m.action]();
      } else if (m.action === 'goTo' &&
        Number.isSafeInteger(m.slideIndex) && m.slideIndex >= 0 && Number.isSafeInteger(m.stepIndex) && m.stepIndex >= 0) {
        await seek(m.slideIndex, m.stepIndex);
      } else return;
    } catch(e) { error = String(e && e.message || e).slice(0,500); }
      finally { quiet = false; notify(true); }
    });
  });
  addEventListener('error', event => {
    error = (event.message || 'HTML asset failed to load').slice(0,500); notify(true);
  }, true);
  addEventListener('unhandledrejection', event => {
    error = String(event.reason && event.reason.message || event.reason).slice(0,500); notify(true);
  });
  addEventListener('amaroad:statechange', () => notify(true));
  setInterval(() => { if (!preview) notify(); }, 200);
})();`;

export function injectRichDeckBridge(html: string): string {
  // Head placement catches script failures in the document itself.
  const script = `<script data-amaroad-bridge>${BRIDGE}</script>`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (head) => head + script);
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (element) => element + `<head>${script}</head>`);
  if (/<!doctype\b[^>]*>/i.test(html)) return html.replace(/<!doctype\b[^>]*>/i, (doctype) => doctype + script);
  return script + html;
}
