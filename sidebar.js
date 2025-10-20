console.log('sidebar.js loaded');

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}

async function initSidebar() {
  console.log('Initializing sidebar...');

  const sidebarEl = document.getElementById('fabric-menu-side');
  if (!sidebarEl) {
    console.error('Sidebar element not found');
    return;
  }

  console.log('Sidebar element found:', sidebarEl);

  const bucket = sidebarEl.getAttribute('data-bucket');
  const prefix = sidebarEl.getAttribute('data-prefix');
  const baseUrl = sidebarEl.getAttribute('data-baseurl');
  const maxKeys = parseInt(sidebarEl.getAttribute('data-max') || '1000', 10);

  console.log('S3 Config:', { bucket, prefix, baseUrl, maxKeys });

  if (!bucket || !baseUrl) {
    console.error('Missing bucket or baseurl attributes');
    sidebarEl.innerHTML = `<div style="padding: 20px; color: red;">Configuration error: Missing S3 bucket or base URL</div>`;
    return;
  }

  // Construct the S3 list URL
  const listUrl = `${baseUrl}?list-type=2&prefix=${encodeURIComponent(prefix || '')}&max-keys=${maxKeys}`;

  console.log('Fetching images from:', listUrl);

  // Show loading message
  sidebarEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">Loading images...</div>`;

  try {
    const response = await fetch(listUrl);
    console.log('Fetch response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    console.log('XML response length:', xmlText.length);
    console.log('First 500 chars:', xmlText.substring(0, 500));

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check for errors in XML
    const error = xmlDoc.querySelector('Error');
    if (error) {
      const code = xmlDoc.querySelector('Code')?.textContent;
      const message = xmlDoc.querySelector('Message')?.textContent;
      throw new Error(`S3 Error: ${code} - ${message}`);
    }

    // Extract all image keys
    const contents = xmlDoc.querySelectorAll('Contents');
    console.log('Total contents found:', contents.length);

    const imageKeys = [];

    contents.forEach(content => {
      const key = content.querySelector('Key')?.textContent;
      if (key && /\.(jpg|jpeg|png|gif|webp)$/i.test(key)) {
        imageKeys.push(key);
      }
    });

    console.log(`Found ${imageKeys.length} images:`, imageKeys);

    if (imageKeys.length === 0) {
      sidebarEl.innerHTML = `<div style="padding: 20px; color: #666;">No images found in ${prefix}</div>`;
      return;
    }

    // Build the sidebar UI
    buildSidebar(imageKeys, baseUrl);

  } catch (error) {
    console.error('Error fetching S3 images:', error);
    sidebarEl.innerHTML = `<div style="padding: 20px; color: red;">Error loading images: ${error.message}</div>`;
  }
}

function buildSidebar(imageKeys, baseUrl) {
  console.log('Building sidebar with', imageKeys.length, 'images');

  const sidebarEl = document.getElementById('fabric-menu-side');
  if (!sidebarEl) {
    console.error('Sidebar element not found in buildSidebar');
    return;
  }

  // Clear existing content
  sidebarEl.innerHTML = '';

  // Create grid container
  const grid = document.createElement('div');
  grid.className = 'image-grid';
  console.log('Created grid element');

  imageKeys.forEach((key, index) => {
    const imageUrl = baseUrl + key;

    // Create image item
    const item = document.createElement('div');
    item.className = 'image-item';

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = key.split('/').pop();
    img.loading = 'lazy';

    // Debug image loading
    img.onload = () => {
      console.log(`Image ${index + 1} loaded:`, key);
    };
    img.onerror = () => {
      console.error(`Image ${index + 1} failed to load:`, key);
    };

    // Handle image selection
    item.addEventListener('click', (event) => {
      selectImage(imageUrl, event.currentTarget);
    });

    item.appendChild(img);
    grid.appendChild(item);
  });

  console.log('Grid has', grid.children.length, 'items');
  sidebarEl.appendChild(grid);
  console.log('Grid appended to sidebar. Sidebar innerHTML length:', sidebarEl.innerHTML.length);
}

function selectImage(imageUrl, clickedItem) {
  console.log('Selected image:', imageUrl);

  // Highlight selected image
  document.querySelectorAll('.image-item').forEach(item => {
    item.classList.remove('selected');
  });
  if (clickedItem) {
    clickedItem.classList.add('selected');
  }

  // Try loading with CORS first, fallback to without CORS if it fails
  loadImageWithCORS(imageUrl, true);
}

function loadImageWithCORS(imageUrl, withCORS) {
  const img = new Image();

  if (withCORS) {
    img.crossOrigin = 'anonymous';
    console.log('Attempting to load image WITH CORS:', imageUrl);

    // Add cache-busting parameter to force fresh CORS check
    // This helps after CORS configuration changes
    const cacheBuster = '?cb=' + Date.now();
    imageUrl = imageUrl + cacheBuster;
    console.log('Using cache-buster URL:', imageUrl);
  } else {
    console.log('Attempting to load image WITHOUT CORS (3D export will fail):', imageUrl);
  }

  img.onload = function() {
    console.log('Image loaded successfully:', imageUrl);
    console.log('Image dimensions:', img.width, 'x', img.height);
    console.log('Loaded with CORS:', withCORS);

    // Get the current panel name from the global scope (fabric-preview.html)
    const currentPanelName = window.currentPanel || 'external';
    console.log('Current panel:', currentPanelName);

    // Access the fabricPanels object from the main script
    if (window.fabricPanels && window.fabricPanels[currentPanelName]) {
      const panel = window.fabricPanels[currentPanelName];
      console.log('Panel config:', panel);

      panel.image = img;

      // Scale the image to fill the entire canvas (cover mode)
      const imageAspect = img.width / img.height;
      const canvasAspect = panel.svgWidth / panel.svgHeight;

      if (imageAspect > canvasAspect) {
        // Image is wider - fit to height (fill vertically)
        panel.scale = panel.svgHeight / img.height;
      } else {
        // Image is taller - fit to width (fill horizontally)
        panel.scale = panel.svgWidth / img.width;
      }

      // Center the image
      panel.x = (panel.svgWidth - img.width * panel.scale) / 2;
      panel.y = (panel.svgHeight - img.height * panel.scale) / 2;

      console.log('Image positioning:', {
        scale: panel.scale,
        x: panel.x,
        y: panel.y
      });

      // Trigger re-render if the function exists
      if (window.render2DCanvas) {
        console.log('Calling render2DCanvas...');
        window.render2DCanvas();
        console.log('Render complete');
      } else {
        console.error('render2DCanvas function not found on window object');
      }

      console.log('Image applied to', currentPanelName, 'panel');

      // Warn user if loaded without CORS
      if (!withCORS) {
        console.warn('⚠️ Image loaded without CORS. 3D preview export will fail with "tainted canvas" error.');
        alert('Image loaded successfully!\n\nNote: The S3 CORS configuration may not be working yet. You can view the 2D preview, but generating the 3D preview may fail. Try clearing your browser cache or wait a few minutes for CORS to propagate.');
      }
    } else {
      console.error('Could not access fabric panel:', currentPanelName);
      console.log('window.fabricPanels:', window.fabricPanels);
      console.log('window.currentPanel:', window.currentPanel);
    }
  };

  img.onerror = function(e) {
    console.error('Error loading image:', imageUrl);
    console.error('Error event:', e);
    console.error('CORS enabled:', withCORS);

    // If CORS failed, try without CORS
    if (withCORS) {
      console.log('CORS load failed, retrying without CORS...');
      loadImageWithCORS(imageUrl, false);
    } else {
      alert('Error loading image: ' + imageUrl + '\n\nThe image cannot be loaded. Please check the S3 bucket permissions.');
    }
  };

  img.src = imageUrl;
}
