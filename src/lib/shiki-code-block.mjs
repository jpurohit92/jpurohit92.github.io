/**
 * Shiki transformer: wraps every highlighted block in a "code block" with a
 * header bar (language or filename + copy button). The copy button is rendered
 * `hidden` and revealed by a tiny script, so the page works without JavaScript.
 *
 * Optional filename:  ```ts title="client.ts"
 */
const LANG_LABELS = {
  powershell: 'PowerShell', ps1: 'PowerShell', pwsh: 'PowerShell',
  python: 'Python', py: 'Python',
  bash: 'Bash', sh: 'Shell', shell: 'Shell', zsh: 'Shell', console: 'Shell',
  javascript: 'JavaScript', js: 'JavaScript', jsx: 'JSX',
  typescript: 'TypeScript', ts: 'TypeScript', tsx: 'TSX',
  yaml: 'YAML', yml: 'YAML', json: 'JSON', jsonc: 'JSON',
  go: 'Go', dockerfile: 'Dockerfile', docker: 'Dockerfile',
  http: 'HTTP', html: 'HTML', css: 'CSS', sql: 'SQL', toml: 'TOML', markdown: 'Markdown', md: 'Markdown',
  text: 'Text', txt: 'Text', plaintext: 'Text',
};

import { iconHast } from './octicon.mjs';

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

export function codeBlockChrome() {
  return {
    name: 'code-block-chrome',
    root(root) {
      const lang = String(this.options.lang ?? 'text');
      const meta = this.options.meta;
      const raw = typeof meta === 'string' ? meta : meta?.__raw ?? '';
      const titleMatch = /title=(?:"([^"]+)"|'([^']+)')/.exec(raw);
      const filename = titleMatch?.[1] ?? titleMatch?.[2];
      const label = LANG_LABELS[lang.toLowerCase()] ?? lang;

      const bar = el('div', { className: ['code-block__bar'] }, [
        el('span', { className: ['code-block__label'] }, [text(filename ?? label)]),
        ...(filename ? [el('span', { className: ['code-block__lang'] }, [text(label)])] : []),
        el(
          'button',
          { type: 'button', className: ['code-copy'], hidden: true, ariaLabel: `Copy ${filename ?? label} code to clipboard` },
          [
            iconHast('copy', ['code-copy__icon', 'is-copy']),
            iconHast('check', ['code-copy__icon', 'is-ok']),
            iconHast('x', ['code-copy__icon', 'is-fail']),
            el('span', { className: ['code-copy__label'] }, [text('Copy')]),
          ],
        ),
      ]);

      root.children = [el('div', { className: ['code-block'], dataLang: lang.toLowerCase() }, [bar, ...root.children])];
    },
  };
}
