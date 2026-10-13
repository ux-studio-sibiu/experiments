/* ====================================================================
   static-background — animated film-grain / TV-static overlay.
   A copy of ../static-background/static-background.js, kept local so the
   "static fx" toggle works from file:// (a sibling folder can't be fetched).
   Loaded as a plain <script> before script.js; exposes createStaticBackground
   on the global scope. Keep in sync with the canonical module.
   ==================================================================== */
function createStaticBackground(opts = {}) {
  const DEFAULTS = { container:null, opacity:0.10, fps:24, cellSize:1.5, density:1, color:null,
    image:null, imageFit:'cover', grainBlend:'overlay', background:'transparent', blendMode:'normal',
    fade:320, zIndex:9999, passthrough:true, autostart:false, respectReducedMotion:true };
  const cfg = { ...DEFAULTS, ...opts };
  const container = cfg.container || document.body;
  const reducedMotion = cfg.respectReducedMotion && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  const s = canvas.style;
  s.position='absolute'; s.inset='0'; s.width='100%'; s.height='100%'; s.display='block';
  s.zIndex=String(cfg.zIndex); s.pointerEvents=cfg.passthrough?'none':'auto'; s.mixBlendMode=cfg.blendMode;
  s.opacity='0'; s.transition=`opacity ${cfg.fade}ms ease`;
  const ctx = canvas.getContext('2d'); container.appendChild(canvas);
  const buffer = document.createElement('canvas'); const bctx = buffer.getContext('2d');
  let imageData=null, cssW=0, cssH=0, bufW=0, bufH=0, imgEl=null, imgReady=false;
  function setImage(src){ if(!src){imgEl=null;imgReady=false;if(!running)renderFrame();return;}
    if(src instanceof HTMLImageElement||src instanceof HTMLCanvasElement){ imgEl=src;
      imgReady=!!(src.complete??true)&&(src.naturalWidth||src.width)>0;
      if(!imgReady&&src.addEventListener) src.addEventListener('load',()=>{imgReady=true;if(!running)renderFrame();},{once:true});
      else if(!running)renderFrame(); return; }
    const im=new Image(); im.decoding='async'; im.onload=()=>{if(imgEl===im){imgReady=true;if(!running)renderFrame();}};
    im.onerror=()=>{if(imgEl===im){imgEl=null;imgReady=false;}}; imgEl=im; imgReady=false; im.src=src; }
  function drawImageFit(img){ const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height; if(!iw||!ih)return;
    if(cfg.imageFit==='fill'){ctx.drawImage(img,0,0,cssW,cssH);return;} const cr=cssW/cssH, ir=iw/ih; let dw,dh;
    if(cfg.imageFit==='contain'?ir>cr:ir<cr){dw=cssW;dh=cssW/ir;}else{dh=cssH;dw=cssH*ir;}
    ctx.drawImage(img,(cssW-dw)/2,(cssH-dh)/2,dw,dh); }
  function resize(){ cssW=container.clientWidth||window.innerWidth; cssH=container.clientHeight||window.innerHeight;
    canvas.width=cssW; canvas.height=cssH; bufW=Math.max(1,Math.ceil(cssW/cfg.cellSize)); bufH=Math.max(1,Math.ceil(cssH/cfg.cellSize));
    buffer.width=bufW; buffer.height=bufH; imageData=bctx.createImageData(bufW,bufH); if(reducedMotion||!running)renderFrame(); }
  function fillNoiseBuffer(){ const data=imageData.data, n=bufW*bufH, tint=cfg.color, density=cfg.density;
    for(let i=0;i<n;i++){ const o=i<<2; if(density<1&&Math.random()>density){data[o+3]=0;continue;} const v=(Math.random()*256)|0;
      if(tint){data[o]=(tint[0]*v)>>8;data[o+1]=(tint[1]*v)>>8;data[o+2]=(tint[2]*v)>>8;}else{data[o]=data[o+1]=data[o+2]=v;} data[o+3]=255; }
    bctx.putImageData(imageData,0,0); }
  function renderFrame(){ ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.clearRect(0,0,cssW,cssH);
    const hasColour=cfg.background&&cfg.background!=='transparent'; if(hasColour){ctx.fillStyle=cfg.background;ctx.fillRect(0,0,cssW,cssH);}
    if(imgEl&&imgReady){ctx.imageSmoothingEnabled=true;drawImageFit(imgEl);} const hasBase=hasColour||(imgEl&&imgReady);
    fillNoiseBuffer(); ctx.imageSmoothingEnabled=false; ctx.globalAlpha=cfg.opacity; ctx.globalCompositeOperation=hasBase?cfg.grainBlend:'source-over';
    ctx.drawImage(buffer,0,0,bufW,bufH,0,0,cssW,cssH); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; }
  let rafId=0, running=false, visible=false, lastFrame=-Infinity;
  function frame(ts){ if(!running)return; const interval=1000/cfg.fps; if(ts-lastFrame>=interval){lastFrame=ts;renderFrame();} rafId=requestAnimationFrame(frame); }
  function start(){ if(running||reducedMotion){if(reducedMotion)renderFrame();return api;} running=true; lastFrame=-Infinity; rafId=requestAnimationFrame(frame); return api; }
  function stop(){ running=false; cancelAnimationFrame(rafId); return api; }
  function show(){ visible=true; s.opacity='1'; start(); return api; }
  function hide(){ visible=false; s.opacity='0'; clearTimeout(hide._t); hide._t=setTimeout(()=>{if(!visible)stop();},cfg.fade+50); return api; }
  function toggle(force){ const next=typeof force==='boolean'?force:!visible; return next?show():hide(); }
  function onVisibilityChange(){ if(document.hidden)stop(); else if(visible)start(); }
  const ro = typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  if(ro)ro.observe(container); else window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',onVisibilityChange);
  const api={ canvas, show, hide, toggle, start, stop, resize, setImage, get visible(){return visible;},
    set(name,value){ if(name==='image'){setImage(value);return api;} if(!(name in cfg))return api; cfg[name]=value;
      switch(name){ case 'blendMode':s.mixBlendMode=value;break; case 'zIndex':s.zIndex=String(value);break;
        case 'cellSize':resize();break; case 'passthrough':s.pointerEvents=value?'none':'auto';break; default:break; }
      if(!running)renderFrame(); return api; },
    destroy(){ stop(); clearTimeout(hide._t); if(ro)ro.disconnect(); else window.removeEventListener('resize',resize);
      document.removeEventListener('visibilitychange',onVisibilityChange); if(canvas.parentNode===container)container.removeChild(canvas); } };
  if(cfg.image)setImage(cfg.image); resize(); if(cfg.autostart)show();
  return api;
}
