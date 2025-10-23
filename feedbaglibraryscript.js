<!-- ===================== FABRIC PRINT GALLERY (Add-to-Cart modal aware + debug) ===================== -->
<div
  id="fabric-gallery"
  data-bucket="wompatuck-prints"
  data-prefix="prints/"
  data-baseurl="https://wompatuck-prints.s3.us-west-1.amazonaws.com/"
  data-max="1000"
  style="--fg-gap:14px; --fg-size-min:140px;"
></div>

<div class="fg-lightbox" id="fg-lightbox" aria-hidden="true">
  <div class="fg-lightbox__frame">
    <button class="fg-lightbox__close" aria-label="Close preview">×</button>
    <img class="fg-lightbox__img" alt="Preview">
    <div class="fg-lightbox__caption"></div>
  </div>
</div>

<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400&display=swap" rel="stylesheet">

<style>
  /* Grid layout (exactly 5 cols on wide) */
  #fabric-gallery {
    display: grid;
    grid-template-columns: repeat(5, 1fr) !important;
    gap: var(--fg-gap, 12px);
  }
  @media (max-width: 1200px) { #fabric-gallery { grid-template-columns: repeat(4, 1fr) !important; } }
  @media (max-width: 900px)  { #fabric-gallery { grid-template-columns: repeat(3, 1fr) !important; } }
  @media (max-width: 640px)  { #fabric-gallery { grid-template-columns: repeat(2, 1fr) !important; } }

  .fg-item-wrapper {
    display: flex; flex-direction: column; align-items: center; width: 100%; position: relative;
  }
  .fg-item {
    position: relative; width: 100%; padding-bottom: 100%; /* square */
    overflow: hidden; border-radius: 14px; background: #f6f7f8; box-shadow: 0 2px 14px rgba(0,0,0,.08);
    cursor: pointer;
  }
  .fg-item img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .25s ease; }
  .fg-item:hover img { transform: scale(1.03); }
  .fg-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

  .fg-label {
    margin-top: 6px; width: 100%;
    font-family: 'Poppins', sans-serif; font-size: 1.275rem; text-align: left; color: #333;
  }

  /* Lightbox */
  .fg-lightbox { position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
    background: rgba(0,0,0,.72); z-index: 9999; padding: 4vmin; }
  .fg-lightbox.open { display: flex; }
  .fg-lightbox__frame { position: relative; max-width: 92vw; max-height: 92vh; background: #111; border-radius: 12px;
    overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
  .fg-lightbox__img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .fg-lightbox__close { position: absolute; top: 8px; right: 8px; border: 0; background: rgba(255,255,255,.9); color: #111;
    border-radius: 999px; width: 36px; height: 36px; cursor: pointer; font-size: 20px; line-height: 36px; text-align: center; }
  .fg-lightbox__caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 12px; color: #fff;
    font: 500 14px/1.2 'Poppins', sans-serif; background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.55) 100%); }

  /* Selected feedback */
  .fg-item-wrapper.fg-selected .fg-item { outline: 4px solid #111; outline-offset: 2px; }
  .fg-item-wrapper.fg-selected .fg-label { font-weight: 700; }
  .fg-item-wrapper .fg-selected-badge {
    display: none; position: absolute; top: 8px; left: 8px;
    background: #111; color: #fff; font: 600 12px/1 'Poppins', sans-serif;
    padding: 6px 8px; border-radius: 999px; box-shadow: 0 2px 8px rgba(0,0,0,.25); pointer-events: none;
  }
  .fg-item-wrapper.fg-selected .fg-selected-badge { display: inline-block; }
</style>
<script>
(function () {
  /* ==================== CONFIG ==================== */
  const FIELD_LABELS = ["Fabric Print"];      // add alt labels if you use a different title
  const FIELD_TOKENS = ["fabric","print"];    // all tokens must be present (fallback)
  const URL_PARAM    = "print";
  const LOG_PREFIX   = "[FG]";

  const log  = (...a) => console.log(LOG_PREFIX, ...a);
  const warn = (...a) => console.warn(LOG_PREFIX, ...a);
  const err  = (...a) => console.error(LOG_PREFIX, ...a);

  const root = document.getElementById('fabric-gallery');
  if (!root) { warn("No #fabric-gallery found"); return; }

  const bucket  = root.dataset.bucket?.trim();
  const prefix  = root.dataset.prefix?.trim() || '';
  const baseUrl = root.dataset.baseurl?.trim() || (`https://${bucket}.s3.amazonaws.com/`);
  const maxKeys = Number(root.dataset.max || 1000);
  log("Init config", { bucket, prefix, baseUrl, maxKeys });

  /* ==================== HELPERS ==================== */
  const ci = s => (s||"").toLowerCase().trim();
  const PRIMARY_LABEL = FIELD_LABELS[0] || "Fabric Print";
  const PRIMARY_NAME  = `form[${PRIMARY_LABEL}]`.toLowerCase();

  const getParam = (n) => { try { return new URL(location.href).searchParams.get(n) || ""; } catch { return ""; } };
  const isImage = (k) => /\.(jpe?g|png|webp|gif|avif)$/i.test(k);
  const keyToTitle = (k) => decodeURIComponent(k.replace(prefix,'')).replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').trim();

  function setInputValue(input, value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    log("Set field value", { value, inputType: input.tagName, type: input.getAttribute('type'), name: input.getAttribute('name') });
  }

  function controlIsWritable(el){
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const t = ci(el.getAttribute('type') || 'text');
      return t === "text" || t === "search"; // whitelist
    }
    return false;
  }

  // Candidate modal/lightbox roots on SS 7.1 (+ quick view)
  const MODAL_ROOT_SELECTORS = [
    '.sqs-add-to-cart-lightbox', '.sqs-modal-lightbox',
    '.ProductItem-quickView', '[class*="QuickView"]', 'div[role="dialog"]'
  ].join(',');

  function getScopes() {
    const nodes = Array.from(document.querySelectorAll(MODAL_ROOT_SELECTORS));
    const scopes = [document, ...nodes];
    log("Scopes", { count: scopes.length, nodes });
    return scopes;
  }

  // Collect controls + metadata in a scope
  function collectControls(scope=document){
    const list = [];
    const labelFor = (el) => {
      const id = el.getAttribute('id');
      if (id) {
        const l = scope.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (l) return l.textContent.trim();
      }
      const wrap = el.closest('[data-field], .sqs-field, .form-item, .product-form-field, .field, .form-wrapper');
      const l2 = wrap?.querySelector('label');
      return l2?.textContent?.trim() || '';
    };
    scope.querySelectorAll('input, textarea, select, button').forEach(el=>{
      list.push({
        el,
        tag: el.tagName.toLowerCase(),
        type: (el.getAttribute('type')||'').toLowerCase(),
        label: labelFor(el),
        name: el.getAttribute('name') || '',
        aria: el.getAttribute('aria-label') || '',
        placeholder: el.getAttribute('placeholder') || '',
        datasetTitle: el.closest('[data-title]')?.getAttribute('data-title') || ''
      });
    });
    return list;
  }

  // Rank candidates: prefer exact form name, then exact label, then token bag
  function scoreCandidate(meta){
    if (!controlIsWritable(meta.el)) return -1;                // never touch buttons/submit/etc
    const name = ci(meta.name);
    const label = ci(meta.label);
    const aria  = ci(meta.aria);
    const dtitle= ci(meta.datasetTitle);
    const bag   = `${label} | ${name} | ${aria} | ${dtitle}`;
    let score = 0;

    if (name === PRIMARY_NAME) score += 100;                   // best: form[Fabric Print]
    if (label === ci(PRIMARY_LABEL) || dtitle === ci(PRIMARY_LABEL) || aria === ci(PRIMARY_LABEL)) score += 80;
    if (name.startsWith('form[')) score += 20;

    if (FIELD_TOKENS.length && FIELD_TOKENS.every(t => bag.includes(t))) score += 10;

    return score;
  }

  function findBestField(scope=document){
    const items = collectControls(scope);
    const scored = items.map(m => ({ ...m, _score: scoreCandidate(m) }))
                        .filter(m => m._score > 0)
                        .sort((a,b) => b._score - a._score);
    log("Candidates in scope", { scope, count: scored.length, top: scored[0] && {
      tag: scored[0].tag, type: scored[0].type, name: scored[0].name, label: scored[0].label, score: scored[0]._score
    }});
    return scored[0]?.el || null;
  }

  function fillAllVisibleFabricFields(value) {
    if (!value) { warn("fillAllVisibleFabricFields called with empty value"); return 0; }
    let total = 0;
    getScopes().forEach(scope => {
      const el = findBestField(scope);
      if (el) { setInputValue(el, value); total++; }
    });
    log("Filled fields total", { value, total });
    return total;
  }

  /* ==================== LIGHTBOX UI ==================== */
  const lb   = document.getElementById('fg-lightbox');
  const lbImg = lb?.querySelector('.fg-lightbox__img');
  const lbCap = lb?.querySelector('.fg-lightbox__caption');
  const lbClose = lb?.querySelector('.fg-lightbox__close');

  function openLightbox(url, caption) {
    if (!lb) return;
    lbImg.src = url; lbImg.alt = caption || '';
    lbCap.textContent = caption || '';
    lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
    log("Lightbox opened", { url, caption });
  }
  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true');
    lbImg.removeAttribute('src');
    log("Lightbox closed");
  }
  lbClose?.addEventListener('click', closeLightbox);
  lb?.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  /* ==================== S3 LIST + RENDER ==================== */
  const listUrl = new URL(baseUrl);
  listUrl.pathname = '/';
  listUrl.searchParams.set('list-type', '2');
  listUrl.searchParams.set('prefix', prefix);
  listUrl.searchParams.set('max-keys', String(maxKeys));
  log("S3 list URL", listUrl.toString());

  async function fetchAllKeys() {
    let keys = [], nextToken = null;
    try {
      do {
        if (nextToken) listUrl.searchParams.set('continuation-token', nextToken);
        const res = await fetch(listUrl.toString());
        if (!res.ok) throw new Error(`S3 list error: ${res.status}`);
        const xml = await res.text();
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        [...doc.getElementsByTagName('Contents')].forEach(n => {
          const k = n.getElementsByTagName('Key')[0]?.textContent || '';
          if (k && isImage(k) && !k.endsWith('/')) keys.push(k);
        });
        nextToken = doc.getElementsByTagName('NextContinuationToken')[0]?.textContent || null;
      } while (nextToken);
      log("Total S3 keys", { count: keys.length });
    } catch (e) {
      err("S3 listing failed", e);
      root.textContent = 'Could not load gallery. Check S3 permissions (ListBucket) and CORS.';
    }
    return keys;
  }

  let selectedName = "";

  function selectTile(wrapper, name, url) {
    // visual highlight
    root.querySelectorAll('.fg-item-wrapper').forEach(w=>w.classList.remove('fg-selected'));
    wrapper.classList.add('fg-selected');
    if (!wrapper.querySelector('.fg-selected-badge')) {
      const badge = document.createElement('span');
      badge.className = 'fg-selected-badge';
      badge.textContent = 'Selected';
      wrapper.appendChild(badge);
    }
    selectedName = name;
    log("Tile selected", { name });

    // try to fill immediately (page or already-open modal)
    const filled = fillAllVisibleFabricFields(selectedName);
    if (filled === 0) warn("No fields filled on select; will also try when modal appears", { selectedName });

    // preview
    openLightbox(url, name);
  }

  function render(keys) {
    root.innerHTML = '';
    keys.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.src = entry.target.dataset.src; obs.unobserve(entry.target); }
      });
    }, { rootMargin: '250px' });

    keys.forEach(k => {
      const url = baseUrl + encodeURI(k);
      const name = keyToTitle(k);

      const wrapper = document.createElement('div');
      wrapper.className = 'fg-item-wrapper';
      wrapper.dataset.name = name;

      const item = document.createElement('div');
      item.className = 'fg-item';
      item.setAttribute('role','button');
      item.setAttribute('tabindex','0');
      item.title = name;

      const img = document.createElement('img');
      img.alt = name; img.loading='lazy'; img.decoding='async'; img.dataset.src=url;
      io.observe(img);

      const sr = document.createElement('span'); sr.className='fg-sr'; sr.textContent=name;
      const label = document.createElement('div'); label.className='fg-label'; label.textContent=name;

      item.appendChild(img); item.appendChild(sr);
      wrapper.appendChild(item); wrapper.appendChild(label); root.appendChild(wrapper);

      const choose = () => selectTile(wrapper, name, url);
      item.addEventListener('click', choose);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    });
  }

  /* ==================== ADD-TO-CART POPUP HOOK ==================== */
  const ADD_SELECTORS = [
    '.sqs-add-to-cart-button',
    '[data-test="add-to-cart"]',
    '[data-action="AddToCart"]',
    'button[type="submit"][name="add"]',
    '.ProductItem-addToCart button',
    '.ProductItem-details-addToCart button'
  ].join(',');

  function startModalFillRoutine() {
    const desired = selectedName || getParam(URL_PARAM) || "";
    if (!desired) { warn("Modal fill skipped — no selectedName or URL param"); return; }

    log("Starting modal fill routine", { desired });

    let tries = 0;
    const maxTries = 40; // ~6s
    const interval = setInterval(() => {
      const filled = fillAllVisibleFabricFields(desired);
      log("Modal fill tick", { tries, filled });
      tries++;
      if (filled > 0 || tries >= maxTries) {
        clearInterval(interval);
        log("Modal fill routine done", { success: filled > 0 });
      }
    }, 150);

    const mo = new MutationObserver(() => {
      const filled = fillAllVisibleFabricFields(desired);
      if (filled > 0) log("Mutation observer filled fields", { filled });
    });
    mo.observe(document.body, { subtree:true, childList:true });
    setTimeout(() => { mo.disconnect(); log("Modal mutation observer stopped"); }, 6000);
  }

  log("Add-to-Cart buttons detected", { count: document.querySelectorAll(ADD_SELECTORS).length });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest(ADD_SELECTORS);
    if (btn) {
      log("Add-to-Cart click detected");
      setTimeout(startModalFillRoutine, 50);
    }
  });

  const bodyClassWatch = new MutationObserver(() => {
    const cls = document.body.className;
    if (/\bmodal\b|\blightbox\b/i.test(cls)) {
      log("Body class suggests modal open; attempting fill");
      startModalFillRoutine();
    }
  });
  bodyClassWatch.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ==================== BOOT ==================== */
  (async () => {
    const keys = await fetchAllKeys();
    if (!keys || !keys.length) { warn("No gallery keys fetched"); return; }
    render(keys);

    // Preselect via URL param
    const pre = getParam(URL_PARAM);
    if (pre) {
      log("Preselect URL param detected", { pre });
      const tile = [...root.querySelectorAll('.fg-item-wrapper')]
        .find(w => (w.dataset.name||'').toLowerCase() === pre.toLowerCase());
      if (tile) {
        log("Preselect tile found — clicking", { name: tile.dataset.name });
        tile.querySelector('.fg-item')?.click();
      } else {
        log("Preselect tile not found in current render; will attempt modal fill later", { pre });
        selectedName = pre;
      }
    }
  })();

  /* ==================== DEBUG HELPERS ==================== */
  window.FabricGalleryDebug = {
    state: () => ({ selectedName, bucket, prefix, baseUrl }),
    dumpFields: () => {
      getScopes().forEach((s, i)=>{
        console.group(`FG controls in scope[${i}]`, s);
        collectControls(s).forEach(o=>{
          console.log({tag:o.tag, type:o.type, label:o.label, name:o.name, aria:o.aria, datasetTitle:o.datasetTitle, el:o.el});
        });
        console.groupEnd();
      });
    },
    fillNow: (v) => fillAllVisibleFabricFields(v || selectedName || getParam(URL_PARAM))
  };
  log("Debug helpers available at window.FabricGalleryDebug");
})();
</script>
