import Slugger from 'github-slugger';

/**
 * Sätteri (Astro 7's Markdown engine) hast plugins.
 * Note: Astro runs user hast plugins *before* its own heading-id plugin, so we
 * compute the id here with the same slugger. Astro keeps any id already set.
 */

/** Adds an accessible "link to this section" anchor to h2–h4 headings. */
export const headingAnchors = () => {
  const slugger = new Slugger();
  return {
    name: 'heading-anchors',
    element: {
      filter: ['h2', 'h3', 'h4'],
      visit(node, ctx) {
        const text = ctx.textContent(node);
        const id = typeof node.properties?.id === 'string' ? node.properties.id : slugger.slug(text);
        ctx.setProperty(node, 'id', id);
        // Intentionally empty: the "#" glyph is drawn with CSS so the heading's
        // text (used for the table of contents) is not polluted.
        ctx.appendChild(node, {
          type: 'element',
          tagName: 'a',
          properties: { className: ['heading-anchor'], href: `#${id}`, ariaLabel: `Link to section: ${text}` },
          children: [],
        });
      },
    },
  };
};

/** Wraps tables in a keyboard-focusable, horizontally scrollable region. */
export const wrapTables = {
  name: 'wrap-tables',
  element: {
    filter: ['table'],
    visit(node, ctx) {
      ctx.wrapNode(node, {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'], role: 'region', tabIndex: 0, ariaLabel: 'Scrollable table' },
        children: [],
      });
    },
  },
};
