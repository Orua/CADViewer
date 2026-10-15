export const SHELL_MESSAGES = {
  'zh-CN': {
    surfaceEdges:'柔和边线', recessShading:'关闭边线后，凹槽与 LOGO 仍保留自然明暗。',
    untitled:'未打开文件',openDrawing:'打开文件',drawingList:'文件',recentDrawingsHint:'最近打开',searchCommands:'搜索命令',searchFiles:'搜索最近文件',clearRecent:'清空',noRecent:'打开的文件会显示在这里',noResults:'没有匹配的文件或命令',localPrivacy:'本地文件在浏览器中处理',startViewing:'打开，开始查看',dropHint:'拖入图纸或模型，或从本机选择文件',dropToOpen:'松开以打开文件',loadingFile:'正在打开文件',cancelLoad:'取消',cancelled:'已取消打开',couldNotOpen:'无法打开文件',retry:'重试',chooseAnother:'选择其他文件',dismiss:'关闭',closePanel:'关闭面板',viewTools:'查看工具',canvas:'查看工作区',drawingCanvas:'二维图纸',modelCanvas:'三维模型',zoomControls:'缩放',fullscreen:'全屏',help:'操作帮助',appearance:'外观',polished:'亮光',matte:'哑光',antique:'仿古',isoView:'等轴',frontView:'前视',topView:'俯视',rightView:'右视',resizeSidebar:'调整文件列表宽度',licenses:'开源许可',finishScope:'仅预览主体表面，保留其他配件颜色',finishDisclaimer:'视觉效果仅供参考，不作为生产色样',escapeHelp:'退出当前工具或关闭面板',navigationHelp:'二维拖动平移；三维拖动旋转，右键或 Shift 拖动平移。滚轮缩放，双击全图。',historyHelp:'本机文件只在当前会话中可重开；刷新后需重新选择。服务器文件可从最近列表直接打开。',cadHint:'拖动平移 · 滚轮缩放 · 双击全图',modelHint:'拖动旋转 · 右键平移 · 滚轮缩放',windowHint:'拖出区域放大 · Esc 退出',localFile:'本机文件',chooseAgain:'需重新选择',serverFile:'服务器文件',metalLightGold:'浅金',metalNickel:'镍',metal24kGold:'24K 金',metalGunmetal:'枪色',metalMattNickel:'哑镍',metalMattLightGold:'哑浅金',metalMatt24kGold:'哑金',metalMattGunmetal:'哑枪色',metalAntiqueBrass:'仿古黄铜',metalAntiqueSilver:'仿古银'
  },
  en: {
    surfaceEdges:'Soft edges', recessShading:'Recesses and logos keep their shading when edges are hidden.',
    untitled:'No file open',openDrawing:'Open file',drawingList:'Files',recentDrawingsHint:'Recent files',searchCommands:'Search commands',searchFiles:'Search recent files',clearRecent:'Clear',noRecent:'Opened files appear here',noResults:'No matching files or commands',localPrivacy:'Local files stay in your browser',startViewing:'Open. Explore.',dropHint:'Drop a drawing or model, or choose a local file',dropToOpen:'Drop to open file',loadingFile:'Opening file',cancelLoad:'Cancel',cancelled:'Opening cancelled',couldNotOpen:'Could not open file',retry:'Retry',chooseAnother:'Choose another file',dismiss:'Dismiss',closePanel:'Close panel',viewTools:'View tools',canvas:'Viewer workspace',drawingCanvas:'2D drawing',modelCanvas:'3D model',zoomControls:'Zoom',fullscreen:'Full screen',help:'Help & shortcuts',appearance:'Appearance',polished:'Polished',matte:'Matte',antique:'Antique',isoView:'Isometric',frontView:'Front',topView:'Top',rightView:'Right',resizeSidebar:'Resize file list',licenses:'Licenses',finishScope:'Preview the main finish; preserve other component colours',finishDisclaimer:'Visual preview only. Not a production colour sample.',escapeHelp:'Exit tool or close panel',navigationHelp:'Drag to pan in 2D or orbit in 3D. Right-drag or Shift-drag to pan in 3D. Scroll to zoom; double-click to fit.',historyHelp:'Local files can be reopened during this session. After a refresh, select them again. Server files reopen from the recent list.',cadHint:'Drag to pan · Scroll to zoom · Double-click to fit',modelHint:'Drag to orbit · Right-drag to pan · Scroll to zoom',windowHint:'Drag a window to zoom · Esc to exit',localFile:'Local file',chooseAgain:'Select again',serverFile:'Server file',metalLightGold:'Light Gold',metalNickel:'Nickel',metal24kGold:'24K Gold',metalGunmetal:'Gunmetal',metalMattNickel:'Matt Nickel',metalMattLightGold:'Matt Light Gold',metalMatt24kGold:'Matt 24K Gold',metalMattGunmetal:'Matt Gunmetal',metalAntiqueBrass:'Antique Brass',metalAntiqueSilver:'Antique Silver'
  }
};

const FINISH_KEYS = ['metalLightGold','metalNickel','metal24kGold','metalGunmetal','metalMattNickel','metalMattLightGold','metalMatt24kGold','metalMattGunmetal','metalAntiqueBrass','metalAntiqueSilver'];
export function readPreferences() {
  try { const value = JSON.parse(localStorage.getItem('cadViewerWorkspace.v1')); return value?.version === 1 ? value : {}; } catch { return {}; }
}
export function savePreferences(patch) {
  try { localStorage.setItem('cadViewerWorkspace.v1', JSON.stringify({ ...readPreferences(), ...patch, version:1 })); } catch { /* Storage may be unavailable. */ }
}

export function createWorkspaceShell(api) {
  const q = selector => document.querySelector(selector);
  const panel = q('#metalFinishPanel');
  const dialog = q('#commandDialog');
  const search = q('#commandSearch');
  const commands = [
    ['openDrawing','Ctrl O',()=>api.openPicker()],['fitView','F',()=>api.fit(),true],
    ['pan','Esc',()=>api.mode('pan'),true],['zoomWindow','W',()=>api.mode('zoom-window'),true],
    ['zoomIn','+',()=>api.zoom(1.25),true],['zoomOut','−',()=>api.zoom(.8),true],
    ['isoView','',()=>api.view('iso'),true,true],['frontView','',()=>api.view('front'),true,true],
    ['topView','',()=>api.view('top'),true,true],['rightView','',()=>api.view('right'),true,true],
    ['appearance','',()=>toggleFinish(),true,true],['toggleDrawingList','',()=>api.sidebar()],
    ['toggleBackground','',()=>api.background()],['fullscreen','',()=>fullscreen()],['help','',()=>q('#helpDialog').showModal()]
  ];
  function toggleFinish(force) {
    const visible = force ?? panel.hidden;
    panel.hidden = !visible;
    q('#finishToggle').setAttribute('aria-expanded', String(visible));
  }
  async function fullscreen() {
    try { if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* Browser may disallow fullscreen in an embedded host. */ }
  }
  function renderCommands() {
    const term = search.value.trim().toLowerCase();
    const result = q('#commandResults');result.replaceChildren();
    const state=api.state();
    for (const [key,shortcut,run,needsFile,modelOnly] of commands) {
      if(modelOnly && state.renderer!=='model') continue;
      if(!api.t(key).toLowerCase().includes(term) && !shortcut.toLowerCase().includes(term)) continue;
      const button=document.createElement('button');button.type='button';button.className='command-result';
      button.disabled=!!needsFile&&!state.ready;
      const label=document.createElement('span');label.textContent=api.t(key);
      const hint=document.createElement('kbd');hint.textContent=shortcut;button.append(label,hint);
      button.addEventListener('click',()=>{dialog.close();run();});result.append(button);
    }
    if(!result.children.length){const p=document.createElement('p');p.className='list-empty';p.textContent=api.t('noResults');result.append(p);}
  }
  function openCommands(){search.value='';renderCommands();dialog.showModal();search.focus();}
  function sync() {
    const state=api.state();
    document.body.dataset.loadState=state.loading?'loading':state.error?'error':state.ready?'ready':'empty';
    const badge=q('#formatBadge');badge.hidden=!state.name;badge.textContent=state.format||'';
    q('#documentName').textContent=state.name||api.t('untitled');q('#documentName').title=state.name||'';
    q('#viewerPane').classList.toggle('light-canvas',state.light);
    for(const item of document.querySelectorAll('[data-model-only]'))item.hidden=state.renderer!=='model';
    if(state.renderer!=='model')toggleFinish(false);
    for(const item of document.querySelectorAll('[data-view],#finishToggle,#zoomFitButton'))item.disabled=!state.ready;
    q('#toolBackgroundButton').setAttribute('aria-pressed',String(state.light));
    q('#interactionHint').textContent=state.ready?api.t(state.mode==='zoom-window'?'windowHint':state.renderer==='model'?'modelHint':'cadHint'):'';
    const pan=q('#toolPanButton');
    pan.querySelector('span').textContent=state.renderer==='model'?(document.documentElement.lang==='zh-CN'?'旋转':'Orbit'):api.t('pan');
    pan.title=state.renderer==='model'?api.t('modelHint'):api.t('cadHint');
    q('#loadingDetail').textContent=q('#status').textContent;
    if(dialog.open)renderCommands();
  }
  function language() {
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element=>element.placeholder=api.t(element.dataset.i18nPlaceholder));
    document.querySelectorAll('[data-metal-finish]').forEach((button,index)=>{
      const label=api.t(FINISH_KEYS[index]);button.querySelector('.finish-name').textContent=label;button.setAttribute('aria-label',label);button.title=label;
    });sync();
  }
  q('#commandButton').addEventListener('click',openCommands);
  search.addEventListener('input',renderCommands);
  q('#closeCommandButton').addEventListener('click',()=>dialog.close());
  q('#helpButton').addEventListener('click',()=>q('#helpDialog').showModal());
  q('#closeHelpButton').addEventListener('click',()=>q('#helpDialog').close());
  for(const d of [dialog,q('#helpDialog')])d.addEventListener('click',event=>{if(event.target!==d)return;const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();});
  q('#fullscreenButton').addEventListener('click',fullscreen);
  q('#finishToggle').addEventListener('click',()=>toggleFinish());
  q('#closeFinishButton').addEventListener('click',()=>{toggleFinish(false);q('#finishToggle').focus();});
  q('#closeSidebarButton').addEventListener('click',()=>api.sidebar(false));
  q('#sidebarBackdrop').addEventListener('click',()=>api.sidebar(false));
  q('#cancelLoadButton').addEventListener('click',api.cancel);
  q('#retryButton').addEventListener('click',api.retry);
  q('#errorOpenButton').addEventListener('click',api.openPicker);
  q('#dismissErrorButton').addEventListener('click',api.dismissError);
  q('#zoomFitButton').addEventListener('click',()=>api.fit());
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{api.view(button.dataset.view);sync();}));
  q('#fileSearch').addEventListener('input',()=>window.cadViewerDrawingList?.filter(q('#fileSearch').value));
  q('#clearRecentButton').addEventListener('click',()=>window.cadViewerDrawingList?.clear());
  const handle=q('#fileSidebarResizeHandle');let resizeDrag;
  function setWidth(value){const width=Math.max(180,Math.min(360,value));document.documentElement.style.setProperty('--sidebar-width',`${width}px`);handle.setAttribute('aria-valuenow',String(width));api.resize();return width;}
  const saved=Number(readPreferences().sidebarWidth);if(Number.isFinite(saved)&&saved>0)setWidth(saved);
  handle.addEventListener('pointerdown',event=>{resizeDrag={x:event.clientX,width:q('#fileSidebarColumn').offsetWidth};handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{if(resizeDrag)setWidth(resizeDrag.width+event.clientX-resizeDrag.x);});
  for(const event of ['pointerup','pointercancel'])handle.addEventListener(event,()=>{if(resizeDrag)savePreferences({sidebarWidth:Number(handle.getAttribute('aria-valuenow'))});resizeDrag=null;});
  handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();savePreferences({sidebarWidth:setWidth(q('#fileSidebarColumn').offsetWidth+(event.key==='ArrowRight'?16:-16))});});
  window.addEventListener('keydown',event=>{
    const key=event.key.toLowerCase();const typing=event.target.closest?.('input,textarea,select,[contenteditable=true]');
    if((event.ctrlKey||event.metaKey)&&key==='k'){event.preventDefault();if(dialog.open)dialog.close();else openCommands();return;}
    if(dialog.open&&['ArrowDown','ArrowUp','Enter'].includes(event.key)){
      const items=[...q('#commandResults').querySelectorAll('button:not(:disabled)')];if(!items.length)return;
      event.preventDefault();const index=items.indexOf(document.activeElement);
      if(event.key==='Enter'){(items[index]||items[0]).click();return;}
      items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();return;
    }
    if(dialog.open||q('#helpDialog').open)return;
    if((event.ctrlKey||event.metaKey)&&key==='o'){event.preventDefault();api.openPicker();return;}
    if(typing||event.ctrlKey||event.metaKey||event.altKey)return;
    if(key==='escape'){toggleFinish(false);api.sidebarOnMobile(false);if(api.state().ready)api.mode('pan');return;}
    if(!api.state().ready)return;
    const action={f:()=>api.fit(),w:()=>api.mode('zoom-window'),'+':()=>api.zoom(1.25),'=':()=>api.zoom(1.25),'-':()=>api.zoom(.8)}[key];
    if(action){event.preventDefault();action();sync();}
  });
  new ResizeObserver(()=>api.resize()).observe(q('#viewerPane'));
  window.addEventListener('cadviewer-languagechange',language);
  language();
  return {sync,toggleFinish,openCommands};
}
