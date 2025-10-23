

<script>

    window.addEventListener('message', (event) => {
    // Always validate the sender's origin for security
    const { key, value } = event.data;
    // Store in localStorage
    localStorage.setItem(key, value);

    console.log(`Stored ${key} = ${value} from iframe`);
    });


(function () {
  // Any of these can be the Add to Cart button depending on the template
  const ADD_TO_CART_SELECTORS = [
    "[data-test='add-to-cart']",
    ".sqs-add-to-cart-button",
    "button[type='submit'][name='add']",
    "button.sqs-add-to-cart-button"
  ].join(",");

  // The field you asked to fill
  const TARGET_FIELD_ID = "text-yui_3_17_2_1_1759254509032_174911-field";
  let VALUE_TO_SET = localStorage.getItem('bagID');
  console.log("Loading BagID from Storage: " + VALUE_TO_SET);

  // Utility: wait for an element to appear under a root (uses MutationObserver)
  function waitForElement(selector, { root = document, timeout = 8000 } = {}) {
    return new Promise((resolve, reject) => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);

      const start = Date.now();
      const obs = new MutationObserver(() => {
        const found = root.querySelector(selector);
        if (found) {
          obs.disconnect();
          resolve(found);
        } else if (Date.now() - start > timeout) {
          obs.disconnect();
          reject(new Error("Timeout waiting for: " + selector));
        }
      });
      obs.observe(root === document ? document.body : root, { childList: true, subtree: true });
    });
  }

  // Heuristic: find the currently visible Squarespace modal/dialog
  function getActivePopupRoot() {
    const candidates = [
      '[role="dialog"]',
      '.sqs-modal-lightbox',
      '.sqs-add-to-cart-modal',
      '.sqs-modal-overlay',
      '.ProductItem-modal'
    ];
    for (const sel of candidates) {
      const node = document.querySelector(sel);
      if (node && node.offsetParent !== null) return node;
    }
    return document; // fallback
  }

  // Safely set the value and fire events so Squarespace records it
  function setFieldValue(input, value) {
    if (!input) return false;
    if (input.matches("input, textarea")) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }
    if (input.tagName === "SELECT") {
      // optional select support
      const opt = Array.from(input.options).find(o => (o.value || o.text).trim().toLowerCase() === value.trim().toLowerCase());
      input.value = opt ? opt.value : (input.options[0] ? input.options[0].value : "");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  // Main: listen for Add to Cart clicks; wait for popup; then fill the field
  document.addEventListener("click", async (e) => {
    const addBtn = e.target.closest(ADD_TO_CART_SELECTORS);
    if (!addBtn) return;

    try {
      // 1) Wait for the popup container to actually be on screen
      // (we re-check until visible to avoid JSONT race conditions)
      let popupRoot = getActivePopupRoot();
      if (popupRoot === document) {
        // wait until a visible modal/dialog appears
        await waitForElement('[role="dialog"], .sqs-modal-lightbox, .sqs-add-to-cart-modal, .sqs-modal-overlay, .ProductItem-modal', { root: document, timeout: 8000 });
        popupRoot = getActivePopupRoot();
      }

      // 2) Now wait for your specific input to be rendered inside the popup
      const selector = "#" + CSS.escape(TARGET_FIELD_ID);
      const inputEl = popupRoot.querySelector(selector) || await waitForElement(selector, { root: popupRoot, timeout: 8000 });

      // 3) Final microdelay to ensure JSONT finished binding events
      await new Promise(r => requestAnimationFrame(r));

      VALUE_TO_SET = localStorage.getItem('bagID');
      // 4) Fill value + dispatch events
      const ok = setFieldValue(inputEl, VALUE_TO_SET);
      if (ok) {
        console.log("[Popup Autofill] Set", TARGET_FIELD_ID, "=", VALUE_TO_SET);
      } else {
        console.warn("[Popup Autofill] Found field but couldn't set value (unsupported element).");
      }
    } catch (err) {
      console.warn("[Popup Autofill] Could not populate field:", err && err.message ? err.message : err);
    }
  });

  // Optional: Log when an Add to Cart button appears (helps debug)
  const mo = new MutationObserver(() => {
    const btn = document.querySelector(ADD_TO_CART_SELECTORS);
    if (btn) {
      console.log("[Popup Autofill] Add to Cart button detected.");
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
</script>
