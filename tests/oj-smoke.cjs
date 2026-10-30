const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../claude-contest-helper.user.js'), 'utf8');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  let passed = 0;
  try {
    for (const fixture of [
      {name:'Codeforces', url:'https://codeforces.com/contest/1/problem/A', html:'<div class="problem-statement"><div class="header"><div class="title">A. Sum</div></div><p>Compute <script type="math/tex">a+b</script>.</p><pre><div>1 2</div><div>3</div></pre></div>', expected:['A. Sum','$a+b$','```\n1 2\n3\n```'], copy:true},
      {name:'AtCoder', url:'https://atcoder.jp/contests/abc001/tasks/abc001_1', html:'<span class="h2">A. Sum</span><div id="task-statement"><div class="lang-en"><p>Compute <span class="katex"><annotation encoding="application/x-tex">a+b</annotation></span>.</p><pre>1 2\n3</pre></div></div>',expected:['A. Sum','$a+b$','```\n1 2\n3\n```'],copy:true},
      {name:'Old UOJ',url:'https://oj.daimayuan.top/problem/3259',html:'<h1>#3259. Sum</h1><span class="label">时间限制:2 s</span><article class="top-buffer-md"><p>Compute <script type="math/tex">a+b</script>.</p><pre>1 2\n3</pre></article>',expected:['#3259. Sum','时间限制:2s','$a+b$'],copy:false},
      {name:'Hydro',url:'https://newoj.daimayuan.top/p/1000',html:'<h1>Sum</h1><div class="problem-content"><p>Compute the sum.</p><pre>1 2\n3</pre></div>',expected:['Sum','Compute the sum.','```\n1 2\n3\n```'],copy:false},
      {name:'LeetCode',url:'https://leetcode.com/problems/two-sum/',html:'<title>Two Sum - LeetCode</title><div data-track-load="description_content"><p>Find two numbers.</p><pre>[2,7], 9</pre></div>',expected:['Two Sum','Find two numbers.','[2,7], 9'],copy:true},
      {name:'Luogu',url:'https://www.luogu.com.cn/problem/P1001',html:'<script id="lentille-context" type="application/json">{"data":{"problem":{"pid":"P1001","content":{"name":"Sum","description":"Compute $a+b$."},"samples":[["1 2","3"]]}}}</script>',expected:['P1001 Sum','Compute $a+b$.','样例 1'],copy:false}
    ]) {
      const context = await browser.newContext();
      await context.route('**/*', route => route.fulfill({contentType:'text/html; charset=utf-8',body:fixture.html}));
      await context.addInitScript(() => {
        window.saved={projectUrl:'https://claude.ai/project/01a11f70-bbd7-727e-9e27-93b81bc5d979'}; window.copied=''; window.opened=[]; window.menus=[];
        window.GM_getValue=(k,d)=> k in saved ? saved[k] : d;
        window.GM_setValue=(k,v)=>saved[k]=v;
        window.GM_deleteValue=k=>delete saved[k];
        window.GM_registerMenuCommand=(name,callback)=>menus.push({name,callback});
        window.GM_openInTab=url=>opened.push(url);
        window.GM_setClipboard=text=>window.copied=text;
        window.GM_xmlhttpRequest=()=>{throw Error('Unexpected network request')};
        window.unsafeWindow=window;
        Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text}}});
      });
      await context.addInitScript({content:source});
      const page = await context.newPage();
      const errors=[]; page.on('pageerror', e=>errors.push(e.message));
      await page.goto(fixture.url);
      await page.locator('#cc-edge-tab-chatgpt').waitFor({state:'visible'});
      if(fixture.copy) {
        await page.locator('#cc-edge-tab-chatgpt .cc-handle').click();
        await page.locator('#cc-edge-tab-chatgpt').getByRole('button',{name:'复制 MD',exact:true}).click();
      }
      else await page.evaluate(()=>menus.find(m=>m.name==='[ChatGPT] 复制题目 Markdown').callback());
      await page.waitForFunction(()=>copied.length>0);
      assert.equal(await page.locator('#cc-edge-tab-claude').isVisible(),true);
      await page.evaluate(()=>menus.find(m=>m.name.startsWith('[Claude] 悬浮球')).callback());
      assert.equal(await page.locator('#cc-edge-tab-claude').isVisible(),false);
      assert.equal(await page.locator('#cc-edge-tab-chatgpt').isVisible(),true);
      const copied=await page.evaluate(()=>window.copied);
      for(const expected of fixture.expected) assert.ok(copied.includes(expected),`${fixture.name}: missing ${expected} in ${copied}`);
      await page.locator('#cc-edge-tab-chatgpt .cc-handle').click();
      await page.getByRole('button',{name:'问 ChatGPT',exact:true}).click();
      await page.waitForFunction(()=>opened.length===1);
      const pending=await page.evaluate(()=>saved.chatgptPendingPrompt);
      assert.equal(pending.prompt,copied);
      assert.equal(pending.autoSend,false);
      await page.evaluate(()=>menus.find(m=>m.name.startsWith('[Claude] 悬浮球')).callback());
      await page.locator('#cc-edge-tab-claude .cc-handle').click();
      await page.getByRole('button',{name:'问 Claude',exact:true}).click();
      await page.waitForFunction(()=>opened.length===2);
      assert.equal(await page.evaluate(()=>saved.pendingPrompt.prompt),copied);
      assert.equal(await page.evaluate(()=>opened[1]),'https://claude.ai/project/01a16288-a5b3-710f-8a63-c585da9e1e13');
      await page.evaluate(()=>menus.find(m=>m.name.startsWith('[ChatGPT] 悬浮球')).callback());
      assert.equal(await page.locator('#cc-edge-tab-chatgpt').isVisible(),false);
      assert.equal(await page.locator('#cc-edge-tab-claude').isVisible(),true);
      await page.evaluate(()=>{history.pushState({},'', '/');window.dispatchEvent(new PopStateEvent('popstate'))});
      assert.equal(await page.locator('#cc-edge-tab-chatgpt').isVisible(),false);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${fixture.name}: load, extract/copy, pending handoff, non-problem navigation`);
      passed++;
      await context.close();
    }
    console.log(`${passed} browser scenarios passed; external requests mocked; no messages sent.`);
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
