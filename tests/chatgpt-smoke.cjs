const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../claude-contest-helper.user.js'), 'utf8');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    for (const scenario of [
      {name:'Claude contenteditable',claude:true,url:'https://claude.ai/new'},
      {name:'Claude overwrites existing draft',claude:true,url:'https://claude.ai/new',draft:'old draft'},
      {name:'Claude PDF opt-in automatic send',claude:true,url:'https://claude.ai/new',pdf:true,autoSend:true},
      {name:'contenteditable default, no send',url:'https://chatgpt.com/'},
      {name:'textarea GPT, opt-in send',url:'https://chatgpt.com/g/g-example',textarea:true,autoSend:true},
      {name:'project PDF, opt-in automatic send',url:'https://chatgpt.com/g/g-p-example/project',pdf:true,autoSend:true},
      {name:'homepage model query',url:'https://chatgpt.com/?model=gpt-4.1'},
      {name:'temporary chat query',url:'https://chatgpt.com/?temporary-chat=true'},
      {name:'editor rerender retry',url:'https://chatgpt.com/',rerender:true},
      {name:'execCommand unavailable, multiline fallback',url:'https://chatgpt.com/',noExec:true,multiline:true},
      {name:'delayed editor after SPA redirect',url:'https://chatgpt.com/auth/login',redirect:true},
      {name:'replace existing GPT draft',url:'https://chatgpt.com/',draft:'my draft'},
      {name:'ignore existing conversation',url:'https://chatgpt.com/c/existing',ignore:true},
      {name:'ignore expired handoff',url:'https://chatgpt.com/',expired:true,ignore:true},
    ]) {
      const c=await browser.newContext();
      await c.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:`${scenario.textarea?'<textarea id="prompt-textarea"></textarea>':`<div id="prompt-textarea" contenteditable="true">${scenario.draft||''}</div>`}<input type="file" accept=".pdf"><button aria-label="Send message" data-testid="send-button" onclick="window.sends++">Send</button>`}));
      await c.addInitScript(s=>{
        window.sends=0; window.uploads=0;
        window.saved={[s.claude?'pendingPrompt':'chatgptPendingPrompt']:{prompt:s.multiline?'# Sum\n\nCompute a + b.\nExample: 1 2': 'Solve a + b.',ts:Date.now()-(s.expired?180000:0),autoSend:!!s.autoSend,...(s.pdf?{pdf:{name:'problem.pdf',data:btoa('%PDF-1.4 fixture')}}:{})}};
        window.GM_getValue=(k,d)=>k in saved?saved[k]:d;
        window.GM_setValue=(k,v)=>saved[k]=v;
        window.GM_deleteValue=k=>delete saved[k];
        if(s.noExec) document.execCommand=()=>false;
        document.addEventListener('DOMContentLoaded',()=>{
          if(s.rerender) document.querySelector('#prompt-textarea').addEventListener('input',e=>{
            const fresh=e.target.cloneNode(false);e.target.replaceWith(fresh);
          },{once:true});
          if(s.redirect) {
            const editor=document.querySelector('#prompt-textarea');editor.remove();
            setTimeout(()=>{history.replaceState({},'', '/?model=gpt-4.1');document.body.prepend(editor)},500);
          }
        });
        document.addEventListener('paste',e=>{if(e.clipboardData?.files.length){window.uploads++;window.pastedFile=e.clipboardData.files[0].name}});
        document.addEventListener('change',e=>{if(e.target.type==='file')window.uploads++});
      },scenario);
      await c.addInitScript({content:source});
      const p=await c.newPage(); const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(scenario.url);
      if(scenario.ignore) await p.waitForTimeout(1800);
      else {
        await p.waitForFunction(()=>!saved.chatgptPendingPrompt&&!saved.pendingPrompt);
        await p.waitForFunction(()=>document.querySelector('#prompt-textarea').value==='Solve a + b.' || document.querySelector('#prompt-textarea').innerText?.includes('Solve a + b.') || document.querySelector('#prompt-textarea').innerText?.includes('# Sum'));
      }
      if(scenario.autoSend) await p.waitForFunction(()=>sends===1);
      const result=await p.evaluate(()=>({text:document.querySelector('#prompt-textarea').value??document.querySelector('#prompt-textarea').innerText,pending:!!(saved.chatgptPendingPrompt||saved.pendingPrompt),sends,uploads,file:window.pastedFile||document.querySelector('input').files[0]?.name}));
      assert.equal(result.text,(scenario.ignore?'':scenario.multiline?'# Sum\n\nCompute a + b.\nExample: 1 2':'Solve a + b.'));
      assert.equal(result.pending,!!scenario.ignore);
      assert.equal(result.sends,scenario.autoSend?1:0);
      if(scenario.pdf){assert.equal(result.uploads,1);assert.equal(result.file,'problem.pdf')}
      assert.deepEqual(errors,[]);console.log('PASS',scenario.name);await c.close();
    }
    for(const kind of ['success','error','incomplete','claude']){
      const c=await browser.newContext();
      await c.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<title>Sum</title><div class="problem-content">Add a and b.</div>'}));
      await c.addInitScript(kind=>{
        window.saved={...(kind==='claude'?{mode:'api',apiKey:'test-claude-key'}:{}),chatgpt_mode:'api',chatgpt_openaiApiKey:'test-fixture-key',chatgpt_openaiModel:'gpt-4.1'};
        window.GM_getValue=(k,d)=>k in saved?saved[k]:d;
        window.GM_setValue=(k,v)=>saved[k]=v;window.GM_deleteValue=k=>delete saved[k];
        window.GM_registerMenuCommand=()=>{};window.GM_setClipboard=()=>{};window.unsafeWindow=window;
        window.GM_xmlhttpRequest=opts=>{
          window.request={url:opts.url,headers:opts.headers,body:JSON.parse(opts.data)};
          opts.onload({status:kind==='error'?401:200,responseText:JSON.stringify(kind==='claude'?{content:[{type:'text',text:'Answer is 3.'}]}:kind==='error'?{error:{message:'Invalid API key'}}:{status:kind==='incomplete'?'incomplete':'completed',incomplete_details:{reason:'max_output_tokens'},output:[{type:'message',content:[{type:'output_text',text:'Answer is 3.'}]}]})});
        };
      },kind);
      await c.addInitScript({content:source});const p=await c.newPage();await p.goto('https://newoj.daimayuan.top/p/1000');
      const provider=kind==='claude'?'claude':'chatgpt';
      await p.locator('#cc-edge-tab-'+provider+' .cc-handle').click();await p.getByRole('button',{name:kind==='claude'?'问 Claude':'问 ChatGPT',exact:true}).click();
      await p.locator('#'+provider+'-contest-panel').waitFor();
      const r=await p.evaluate(()=>request);
      if(kind==='claude') {
        assert.equal(r.url,'https://api.anthropic.com/v1/messages');
        assert.equal(r.headers['x-api-key'],'test-claude-key');
        assert.equal(r.body.model,'claude-opus-5-5');
        assert.ok(r.body.messages[0].content.includes('Add a and b.'));
      } else {
        assert.equal(r.url,'https://api.openai.com/v1/responses');assert.equal(r.headers.Authorization,'Bearer test-fixture-key');
        assert.equal(r.body.model,'gpt-4.1');assert.equal(r.body.input[0].content[0].type,'input_text');assert.ok(r.body.input[0].content[0].text.includes('Add a and b.'));
      }
      const panel=await p.locator('#'+provider+'-contest-panel pre').textContent();
      assert.ok(panel.includes(kind==='error'?'Invalid API key':kind==='incomplete'?'max_output_tokens':'Answer is 3.'));
      console.log('PASS Responses API',kind);await c.close();
    }
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
