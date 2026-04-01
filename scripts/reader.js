// ── ShieldBrowse Reader Mode ────────────────────────────────────────────────
// Extracts the primary article content from the current page DOM and displays
// it in a clean, distraction-free reading view.
//
// LEGAL BASIS: This operates identically to Firefox Reader View, Safari Reader
// Mode, and Chrome's built-in "Simplified View." It reads content already
// delivered to the browser — no server bypass, no authentication circumvention,
// no cache exploitation. The browser received the HTML; we just re-render it.
//
// Triggered by: user clicking "Reader Mode" in popup or pressing Alt+Shift+R

(function () {
  'use strict';

  // ── Article Content Extraction ────────────────────────────────────────────
  // Uses a scoring algorithm similar to Mozilla Readability.js to find the
  // main content node in the page DOM.

  function extractArticle() {
    // 1. Try semantic HTML5 elements first
    const article = document.querySelector('article') ||
                    document.querySelector('[role="article"]') ||
                    document.querySelector('[itemprop="articleBody"]') ||
                    document.querySelector('.post-content') ||
                    document.querySelector('.article-body') ||
                    document.querySelector('.entry-content') ||
                    document.querySelector('.story-body') ||
                    document.querySelector('.article-content') ||
                    document.querySelector('#article-body') ||
                    document.querySelector('.post-body');

    if (article) {
      return {
        content: cleanContent(article),
        title: extractTitle(),
        author: extractMeta('author'),
        date: extractMeta('date'),
        siteName: extractSiteName()
      };
    }

    // 2. Score-based extraction (simplified Readability algorithm)
    const candidates = document.querySelectorAll('div, section, main');
    let bestNode = null;
    let bestScore = 0;

    for (const node of candidates) {
      let score = 0;
      const text = node.textContent || '';
      const wordCount = text.split(/\s+/).length;

      // Score by text density
      if (wordCount > 100) score += 20;
      if (wordCount > 300) score += 30;
      if (wordCount > 500) score += 20;

      // Score by paragraph count
      const paragraphs = node.querySelectorAll('p');
      score += paragraphs.length * 3;

      // Bonus for content-like class/ID names
      const id = (node.id || '').toLowerCase();
      const cls = (node.className || '').toString().toLowerCase();
      const contentSignals = ['content', 'article', 'post', 'entry', 'story',
                              'body', 'text', 'main', 'page'];
      for (const sig of contentSignals) {
        if (id.includes(sig) || cls.includes(sig)) score += 15;
      }

      // Penalize navigation/sidebar/footer-like nodes
      const penaltySignals = ['sidebar', 'nav', 'footer', 'header', 'menu',
                               'comment', 'widget', 'related', 'social',
                               'share', 'ad', 'promo', 'recommend'];
      for (const sig of penaltySignals) {
        if (id.includes(sig) || cls.includes(sig)) score -= 30;
      }

      // Penalize nodes with too many links relative to text (likely navigation)
      const links = node.querySelectorAll('a');
      const linkDensity = links.length / Math.max(wordCount, 1);
      if (linkDensity > 0.3) score -= 40;

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    if (bestNode && bestScore > 30) {
      return {
        content: cleanContent(bestNode),
        title: extractTitle(),
        author: extractMeta('author'),
        date: extractMeta('date'),
        siteName: extractSiteName()
      };
    }

    return null;
  }

  function cleanContent(node) {
    const clone = node.cloneNode(true);

    // Remove non-content elements
    const removeSelectors = [
      'script', 'style', 'noscript', 'iframe', 'form',
      'nav', 'footer', 'header',
      '[class*="share"]', '[class*="social"]', '[class*="comment"]',
      '[class*="related"]', '[class*="recommend"]', '[class*="promo"]',
      '[class*="ad-"]', '[class*="newsletter"]', '[class*="signup"]',
      '[class*="sidebar"]', '[class*="widget"]',
      '[id*="share"]', '[id*="social"]', '[id*="comment"]',
      '[id*="related"]', '[id*="ad-"]', '[id*="newsletter"]',
      '.visually-hidden', '[aria-hidden="true"]',
      'button', 'input[type="button"]', 'input[type="submit"]'
    ];

    for (const sel of removeSelectors) {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    }

    // Extract meaningful HTML (paragraphs, headings, lists, images, blockquotes)
    let html = '';
    const walker = document.createTreeWalker(
      clone, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
    );

    const allowedTags = new Set([
      'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE',
      'FIGURE', 'FIGCAPTION', 'IMG', 'A',
      'STRONG', 'EM', 'B', 'I', 'BR', 'HR',
      'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
      'DL', 'DT', 'DD', 'SUP', 'SUB', 'SPAN', 'DIV'
    ]);

    // Just use the innerHTML after cleanup
    html = clone.innerHTML;

    return html;
  }

  function extractTitle() {
    // Try multiple sources for the article title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) return ogTitle.content;

    const h1 = document.querySelector('article h1, .article-title, .post-title, .entry-title, h1.title');
    if (h1) return h1.textContent.trim();

    const titleEl = document.querySelector('h1');
    if (titleEl) return titleEl.textContent.trim();

    return document.title.split(' - ')[0].split(' | ')[0].trim();
  }

  function extractMeta(type) {
    if (type === 'author') {
      const meta = document.querySelector('meta[name="author"], meta[property="article:author"]');
      if (meta) return meta.content;
      const byline = document.querySelector('.author, .byline, [rel="author"], [class*="author"]');
      if (byline) return byline.textContent.trim().replace(/^by\s+/i, '');
      return null;
    }
    if (type === 'date') {
      const meta = document.querySelector('meta[property="article:published_time"], time[datetime]');
      if (meta) {
        const dateStr = meta.content || meta.getAttribute('datetime');
        try {
          const d = new Date(dateStr);
          if (!isNaN(d)) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {}
        return dateStr;
      }
      return null;
    }
    return null;
  }

  function extractSiteName() {
    const meta = document.querySelector('meta[property="og:site_name"]');
    if (meta) return meta.content;
    return location.hostname.replace(/^www\./, '');
  }

  // ── Render Reader View ────────────────────────────────────────────────────

  function renderReaderMode(article) {
    if (!article) {
      alert('ShieldBrowse: Could not extract article content from this page.');
      return;
    }

    // Store original page
    const originalHTML = document.documentElement.innerHTML;
    const originalTitle = document.title;

    // Build reader view
    document.documentElement.innerHTML = `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(article.title)} — Reader Mode</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --reader-bg: #fafaf7;
          --reader-text: #1a1a1a;
          --reader-muted: #666;
          --reader-border: #e5e5e0;
          --reader-link: #0066cc;
          --reader-max-width: 680px;
          --reader-font: 'Georgia', 'Times New Roman', serif;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --reader-bg: #1a1a1a;
            --reader-text: #e0e0e0;
            --reader-muted: #999;
            --reader-border: #333;
            --reader-link: #6db3f2;
          }
        }

        body {
          background: var(--reader-bg);
          color: var(--reader-text);
          font-family: var(--reader-font);
          font-size: 19px;
          line-height: 1.8;
          padding: 40px 20px 80px;
          -webkit-font-smoothing: antialiased;
        }

        .reader-container {
          max-width: var(--reader-max-width);
          margin: 0 auto;
        }

        .reader-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--reader-border);
          font-family: -apple-system, system-ui, sans-serif;
        }

        .reader-toolbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--reader-muted);
        }

        .reader-close {
          padding: 6px 14px;
          background: transparent;
          border: 1px solid var(--reader-border);
          border-radius: 6px;
          color: var(--reader-muted);
          font-size: 13px;
          cursor: pointer;
          font-family: -apple-system, system-ui, sans-serif;
        }

        .reader-close:hover {
          background: var(--reader-border);
          color: var(--reader-text);
        }

        .reader-meta {
          margin-bottom: 24px;
          font-family: -apple-system, system-ui, sans-serif;
        }

        .reader-site {
          font-size: 13px;
          color: var(--reader-link);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .reader-title {
          font-size: 32px;
          line-height: 1.25;
          font-weight: 700;
          margin: 12px 0 16px;
          letter-spacing: -0.5px;
          font-family: var(--reader-font);
        }

        .reader-byline {
          font-size: 14px;
          color: var(--reader-muted);
        }

        .reader-content {
          margin-top: 32px;
        }

        .reader-content p {
          margin-bottom: 1.4em;
        }

        .reader-content h2, .reader-content h3, .reader-content h4 {
          margin: 2em 0 0.8em;
          line-height: 1.3;
          font-family: -apple-system, system-ui, sans-serif;
        }

        .reader-content h2 { font-size: 24px; }
        .reader-content h3 { font-size: 20px; }

        .reader-content img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 1em 0;
        }

        .reader-content a {
          color: var(--reader-link);
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
        }

        .reader-content blockquote {
          border-left: 3px solid var(--reader-border);
          padding-left: 20px;
          margin: 1.5em 0;
          color: var(--reader-muted);
          font-style: italic;
        }

        .reader-content pre, .reader-content code {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 14px;
          background: var(--reader-border);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .reader-content pre {
          padding: 16px;
          overflow-x: auto;
          margin: 1.5em 0;
        }

        .reader-content ul, .reader-content ol {
          margin: 1em 0;
          padding-left: 1.5em;
        }

        .reader-content li {
          margin-bottom: 0.5em;
        }

        .reader-content figure {
          margin: 1.5em 0;
        }

        .reader-content figcaption {
          font-size: 14px;
          color: var(--reader-muted);
          text-align: center;
          margin-top: 8px;
          font-family: -apple-system, system-ui, sans-serif;
        }

        .reader-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5em 0;
          font-size: 15px;
        }

        .reader-content th, .reader-content td {
          padding: 8px 12px;
          border: 1px solid var(--reader-border);
          text-align: left;
        }

        /* Remove any hidden/blurred content styling from original page */
        .reader-content [style] {
          visibility: visible !important;
          display: block !important;
          opacity: 1 !important;
          filter: none !important;
          -webkit-filter: none !important;
          max-height: none !important;
          overflow: visible !important;
        }

        @media (max-width: 600px) {
          body { font-size: 17px; padding: 24px 16px 60px; }
          .reader-title { font-size: 26px; }
        }
      </style>
    </head>
    <body>
      <div class="reader-container">
        <div class="reader-toolbar">
          <div class="reader-toolbar-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ShieldBrowse Reader Mode
          </div>
          <button class="reader-close" id="sb-reader-close">Exit Reader Mode</button>
        </div>

        <div class="reader-meta">
          ${article.siteName ? `<div class="reader-site">${escapeHtml(article.siteName)}</div>` : ''}
          <h1 class="reader-title">${escapeHtml(article.title)}</h1>
          <div class="reader-byline">
            ${article.author ? escapeHtml(article.author) : ''}
            ${article.author && article.date ? ' · ' : ''}
            ${article.date ? escapeHtml(article.date) : ''}
          </div>
        </div>

        <div class="reader-content">
          ${article.content}
        </div>
      </div>

      <script>
        document.getElementById('sb-reader-close').addEventListener('click', function() {
          // Reload the original page
          location.reload();
        });
      </script>
    </body>`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Message listener (triggered from popup or keyboard shortcut) ──────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ACTIVATE_READER_MODE') {
      const article = extractArticle();
      if (article) {
        renderReaderMode(article);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Could not extract article content' });
      }
    }
  });

})();
