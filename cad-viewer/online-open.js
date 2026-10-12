(function () {
  'use strict';
  const storageKey='cadViewerRecent.v2';
  const localFiles=new Map();
  let current=null,query='';
  const t=(key,fallback)=>window.cadViewerI18n?.t(key)||fallback;
  function safeUrl(value){try{const url=new URL(value,location.href);return url.origin===location.origin&&/^https?:$/.test(url.protocol)?url.href:null;}catch{return null;}}
  function clean(items){return Array.isArray(items)?items.filter(item=>item&&typeof item.name==='string'&&(item.local===true||safeUrl(item.url))).slice(0,10):[];}
  function read(){
    try{const stored=localStorage.getItem(storageKey);if(stored!==null)return clean(JSON.parse(stored));}catch{}
    try{const match=document.cookie.match(/(?:^|; )goldenluckCadRecent=([^;]*)/);return match?clean(JSON.parse(decodeURIComponent(match[1]))):[];}catch{return [];}
  }
  let recent=read();
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(recent));document.cookie='goldenluckCadRecent=; max-age=0; path=/; SameSite=Lax';}catch{}}
  function identity(item){return item.local?`local:${item.name}`:safeUrl(item.url);}
  function remember(item){current=item;recent=[item,...recent.filter(previous=>identity(previous)!==identity(item))].slice(0,10);for(const name of localFiles.keys())if(!recent.some(item=>item.local&&item.name===name))localFiles.delete(name);save();render();}
  function render(){
    const list=document.getElementById('predefinedFileList');if(!list)return;
    list.replaceChildren();const rows=current?[current,...recent.filter(item=>identity(item)!==identity(current))]:recent;
    for(const item of rows){
      if(query&&!item.name.toLowerCase().includes(query))continue;
      const button=document.createElement('button');button.type='button';button.className='file-list-item';button.title=item.name;button.dataset.fileName=item.name;
      if(item.local)button.dataset.localHistory='true';else button.dataset.fileUrl=safeUrl(item.url);
      if(current&&identity(item)===identity(current)){button.classList.add('active');button.setAttribute('aria-current','true');}
      const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.classList.add('icon');icon.setAttribute('aria-hidden','true');
      const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#i-file');icon.append(use);
      const text=document.createElement('span');text.className='file-row-text';const name=document.createElement('span');name.className='file-name';name.textContent=item.name;
      const kind=document.createElement('span');kind.className='file-kind';kind.textContent=item.local?t(localFiles.has(item.name)?'localFile':'chooseAgain',localFiles.has(item.name)?'Local file':'Select again'):t('serverFile','Server file');
      text.append(name,kind);button.append(icon,text);list.append(button);
    }
    const empty=document.getElementById('fileListEmpty');empty.hidden=!!list.children.length;empty.textContent=t(query?'noResults':'noRecent',query?'No matches':'Opened files appear here');
    document.getElementById('clearRecentButton').disabled=recent.length===0;
  }
  window.cadViewerDrawingList={
    openUrl(url){url=safeUrl(url);if(!url)return;let name=new URL(url).pathname.split('/').pop();try{name=decodeURIComponent(name);}catch{}remember({url,name});},
    openLocal(name,file){if(file)localFiles.set(name,file);remember({name,local:true});},
    getLocal(name){return localFiles.get(name);},
    filter(value){query=String(value).trim().toLowerCase();render();},
    clear(){recent=[];save();render();},
    getState(){return recent.map(item=>({...item,available:!item.local||localFiles.has(item.name)}));}
  };
  window.addEventListener('cadviewer-languagechange',render);
  render();
  const initial=new URLSearchParams(location.search).get('file');
  if(initial)window.addEventListener('load',()=>window.cadViewer?.openUrl(initial));
})();
