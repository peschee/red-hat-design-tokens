import { fileURLToPath } from 'node:url';
import { isColor, isBreakpoint, isMobile, isTablet, isMediaQuery } from '../predicates.js';
import { getType } from '../sources.js';
import { md } from '../markdown.js';

import nunjucks from 'nunjucks';
import flattenTokens from 'style-dictionary/lib/utils/flattenProperties.js';
import slugify from '@sindresorhus/slugify';

const getDocs = x => x?.$extensions?.['com.redhat.ux'];
const filterEntries = (p, x) => Object.fromEntries(Object.entries(x).filter(p));
const sortEntries = (p, x) => Object.fromEntries(Object.entries(x).sort(p));
const entryHasValue = ([, v]) => typeof v === 'object' && '$value' in v;

const docsRoot = new URL('../../docs', import.meta.url);

const env = nunjucks
  .configure(fileURLToPath(docsRoot))
  /* eslint-disable no-console */
  .addFilter('log', x => console.log(x))
  .addFilter('trace', x => (console.log(x), x))
  /* eslint-enable no-console */
  .addFilter('isRef', x => x?.original?.$value?.startsWith?.('{') ?? false)
  .addFilter('isMobile', x => isMobile(x))
  .addFilter('isTablet', x => isTablet(x))
  .addFilter('deref', x => `rh-${x.original.$value.replace(/[{}]/g, '').split('.').join('-')}`)
  .addFilter('slugify', x => slugify(x))
  .addFilter('flattenTokens', flattenTokens)
  .addFilter('sortByPxSize', xs => [...xs].sort((a, b) => parseInt(a.$value) - parseInt(b.$value)))
  .addFilter('getDocs', getDocs)
  .addFilter('getDescription', x => md.render((x?.description ?? '').replaceAll('%(%', '{').replaceAll('%)%', '}')))
  .addFilter('inlineCss', x => md.render(`\`\`\`css\n${x}\n\`\`\``))
  .addFilter('isFontWeight', collection => getType(collection) === 'fontWeight')
  .addFilter('getValues', x => filterEntries(entryHasValue, x))
  .addFilter('excludekeys', (x, ...keys) => filterEntries(([k]) => !keys.includes(k), x))
  .addFilter('pickkeys', (x, ...keys) => filterEntries(([k]) => keys.includes(k), x))
  .addFilter('stripmeta', x => filterEntries(([k]) => k !== 'comment' && !k.startsWith('$'), x ?? {}));

/**
 * Generates a single-file web page to demonstrate token values
 * @type {import('style-dictionary').Format}
 */
export const docsPage = {
  name: 'html/docs',
  formatter({ dictionary, platform }) {
    const getColorGroupOrder = x => getDocs(dictionary.tokens.color[x])?.order ?? Infinity;
    const breakpoints = dictionary.allTokens.filter(isBreakpoint);
    const mediaQueries = dictionary.allTokens.filter(isMediaQuery);
    const colors = dictionary.allTokens.filter(isColor);
    env.addFilter('sortColorGroupByOrder', x => sortEntries(([a], [b]) => getColorGroupOrder(a) - getColorGroupOrder(b), x));
    env.addFilter('buildCollection', name => ({
      ...dictionary.tokens[name],
      ...filterEntries(([, v]) => getDocs(v)?.category === name, dictionary.tokens.color)
    }));
    return env.render('index.html', { ...dictionary, breakpoints, colors, mediaQueries, platform });
  }
};
