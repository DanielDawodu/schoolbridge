/**
 * Isolated document print utility.
 * Renders target element in an isolated iframe with document styles,
 * ensuring zero application chrome, sidebars, or modal overlays in printed output.
 */
export const printElement = (elementId: string, title: string = 'School Document') => {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  // Remove existing print frame if any
  const existingFrame = document.getElementById('schoolbridge-print-frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'schoolbridge-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #111827 !important;
          }
          .print-hidden, .no-print, button {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${element.outerHTML}
        </div>
      </body>
    </html>
  `);

  // Copy existing styles from main document
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    try {
      doc.head.appendChild(node.cloneNode(true));
    } catch {
      // Continue if cross-origin stylesheet node
    }
  });

  doc.close();

  // Allow styles to apply before triggering browser print dialog
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Isolated print failed, falling back to window.print():', e);
      window.print();
    } finally {
      setTimeout(() => {
        try {
          iframe.remove();
        } catch {
          // Ignore
        }
      }, 2500);
    }
  }, 400);
};

