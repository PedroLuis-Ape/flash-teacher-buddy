import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const authPath = 'src/pages/Auth.tsx';
let auth = readFileSync(authPath, 'utf8');
auth = replaceOnce(auth, 'className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"', 'className="auth-page min-h-screen flex flex-col items-stretch justify-start gap-4 p-4 relative overflow-x-hidden overflow-y-auto sm:items-center sm:justify-center sm:gap-0"', 'auth page layout');
auth = replaceOnce(auth, '      <PitecoMascot />', '      <div className="hidden lg:block">\n        <PitecoMascot />\n      </div>', 'mobile mascot containment');
auth = replaceOnce(auth, 'className="fixed top-4 right-4 z-50 gap-2 shadow-lg"', 'className="auth-install-button relative z-50 w-full max-w-md self-center gap-2 shadow-lg sm:fixed sm:top-4 sm:right-4 sm:w-auto sm:max-w-none"', 'download button layout');
auth = replaceOnce(auth, '      <div className="w-full max-w-md space-y-5 relative z-20">', '      <div className="auth-panel-stack relative z-20 mx-auto w-full max-w-md flex-none space-y-5">', 'auth panel stack');
writeFileSync(authPath, auth);

const cssPath = 'src/styles/space-galaxy-home-mobile-hotfix.css';
let css = readFileSync(cssPath, 'utf8');
css += `\n/* Stable Auth mobile layout contract. */\n@media(max-width:767px){.auth-page{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;overflow-y:auto!important;padding-top:max(1rem,env(safe-area-inset-top))!important;padding-bottom:max(1.5rem,env(safe-area-inset-bottom))!important}.auth-page>.auth-install-button{position:static!important;inset:auto!important;order:0!important;width:100%!important;max-width:28rem!important;min-height:48px!important;margin:0 auto!important;flex:0 0 auto!important}.auth-page>.auth-panel-stack{order:1!important;width:100%!important;min-width:0!important;max-width:28rem!important;margin-inline:auto!important;flex:0 0 auto!important}}\n`;
writeFileSync(cssPath, css);

writeFileSync('src/pages/Auth.layout.test.ts', `import { readFileSync } from 'node:fs';\nimport { describe, expect, it } from 'vitest';\nconst source=readFileSync(new URL('./Auth.tsx',import.meta.url),'utf8');\nconst css=readFileSync(new URL('../styles/space-galaxy-home-mobile-hotfix.css',import.meta.url),'utf8');\ndescribe('Auth mobile layout',()=>{it('uses stable owned classes',()=>{expect(source).toContain('auth-page');expect(source).toContain('auth-install-button');expect(source).toContain('auth-panel-stack')});it('keeps a vertical mobile flow',()=>{expect(css).toContain('.auth-page>.auth-install-button');expect(css).toContain('position:static!important')});it('hides the large mascot on narrow screens',()=>{expect(source).toContain('hidden lg:block')})});\n`);
