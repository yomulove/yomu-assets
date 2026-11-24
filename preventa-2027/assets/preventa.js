(function(){
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var captura=/[?&]captura\b/.test(location.search);
  var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};

  /* Carga diferida: al abrir la página solo carga el hero. Cada video recibe su póster (y los loops su archivo)
     cuando está cerca de la pantalla; los testimonios descargan el video solo al hacer clic.
     En Kajabi la página vive en un marco con scroll propio (.yp): ese marco es la referencia. */
  var root=document.querySelector('.yp')||null,IO='IntersectionObserver' in window;
  /* Al abrir el HTML como archivo (file://), Chrome bloquea los videos con crossorigin: se quita para que se reproduzcan, sin subtítulos */
  if(location.protocol==='file:'){var cvs=document.querySelectorAll('video[crossorigin]');for(var ci=0;ci<cvs.length;ci++)cvs[ci].removeAttribute('crossorigin');}
  /* iPhone (Safari): con preload="none", cambiar preload no basta; hay que llamar a load() una vez antes de play() */
  var arm=function(v){if(v._armed)return;v._armed=true;v.preload='auto';if(v.readyState===0)v.load();};
  /* Si iOS no deja reproducir sola una animación (p. ej. modo de bajo consumo), queda el póster con un botón de play */
  var tapBtn=function(v){var box=v.parentNode;if(!box||box.querySelector('.vtap'))return;
    var b=document.createElement('button');b.type='button';b.className='vtap';b.setAttribute('aria-label',/^en/.test(((v.closest&&v.closest('[lang]'))||document.documentElement).lang)?'Play video':'Reproducir video');
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';
    b.addEventListener('click',function(){arm(v);var p=v.play();if(p&&p.then)p.then(function(){b.remove();}).catch(function(){});else b.remove();});
    box.appendChild(b);};
  var startVid=function(v,onFail){arm(v);var p=v.play();if(p&&p.catch)p.catch(function(e){if(e&&e.name==='AbortError')return;if(onFail)onFail(e);});return p;};
  var near=IO?new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var v=e.target;near.unobserve(v);
      if(v.dataset.poster){v.poster=v.dataset.poster;v.removeAttribute('data-poster');}
      if(v._loop&&!reduce&&!captura)arm(v);});},{root:root,rootMargin:'600px 0px'}):null;
  $$('video[data-poster]').forEach(function(v){if(captura||!near){v.poster=v.dataset.poster;v.removeAttribute('data-poster');}else near.observe(v);});

  /* Loops silenciosos: se reproducen solo cuando se ven; con reduced-motion quedan en póster.
     Un solo observador guardado en una variable: en Safari/WebKit un observador sin referencia se descarta y el loop no arranca. */
  var vis=IO?new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;
      if(e.isIntersecting)startVid(v,function(){if(v.muted)tapBtn(v);});else if(!v.paused)v.pause();});},{root:root,threshold:.3}):null;
  window.__ypObs=[near,vis];
  $$('.vid-loop video, .vr video, .sloop video').forEach(function(v){
    v.muted=true;v._loop=true;v.controls=false;v.setAttribute('disablepictureinpicture','');v.setAttribute('disableremoteplayback','');v.setAttribute('x-webkit-airplay','deny');
    if(reduce||captura){v.removeAttribute('autoplay');v.pause();return;}
    if(vis)vis.observe(v);
  });

  /* Hero: si el video no carga, queda la foto de respaldo (niña junto al árbol) */
  $$('.hero-media').forEach(function(box){
    var v=$('video',box);if(!v)return;
    var fail=function(){box.classList.add('is-fallback');};
    var srcs=$$('source',v);if(srcs.length)srcs[srcs.length-1].addEventListener('error',fail);
    v.addEventListener('error',fail);
  });

  /* Subtítulos en capa propia: siempre a la misma altura (tercio inferior), no saltan con los controles */
  var caps=function(box,v,isOn){
    var tr=v.textTracks&&v.textTracks[0];if(!tr)return;
    tr.mode='hidden';
    /* Safari a veces vuelve a mostrar los subtítulos nativos (quedan dobles): se mantienen ocultos */
    var keep=function(){if(tr.mode==='showing')tr.mode='hidden';};if(v.textTracks.addEventListener)v.textTracks.addEventListener('change',keep);v.addEventListener('play',keep);v.addEventListener('loadedmetadata',keep);
    var layer=document.createElement('div');layer.className='cap';layer.setAttribute('aria-hidden','true');box.appendChild(layer);
    /* Tamaño según el ancho del video (sin unidades cqw, que Kajabi no soporta) */
    var k=box.classList.contains('vplayer--169')?.027:.046;
    var fit=function(){var px=Math.max(12,Math.round(box.clientWidth*k));if(layer.style.fontSize!==px+'px'){layer.style.fontSize=px+'px';cache={};last=null;}};
    if('ResizeObserver' in window)new ResizeObserver(fit).observe(box);
    var last=null,cache={},span=document.createElement('span');fit();
    /* Máximo 2 líneas: si la frase no cabe en este ancho, se parte en subtítulos seguidos */
    var chunks=function(c){
      var key=c.startTime+'|'+layer.clientWidth;if(cache[key])return cache[key];
      var words=c.text.replace(/\s+/g,' ').trim().split(' '),out=[],cur='';
      layer.innerHTML='';layer.appendChild(span);layer.style.visibility='hidden';
      for(var i=0;i<words.length;i++){var test=cur?cur+' '+words[i]:words[i];span.textContent=test;
        if(cur&&span.getClientRects().length>2){out.push(cur);cur=words[i];}else cur=test;}
      if(cur)out.push(cur);
      layer.style.visibility='';layer.innerHTML='';
      return cache[key]=out;
    };
    var draw=function(){var c=tr.activeCues&&tr.activeCues[0],t='';
      if(c&&isOn()){var parts=chunks(c);
        if(parts.length===1)t=parts[0];
        else{var total=parts.join('').length,k=(v.currentTime-c.startTime)/(c.endTime-c.startTime)*total,acc=0;
          for(var i=0;i<parts.length;i++){acc+=parts[i].length;if(k<acc||i===parts.length-1){t=parts[i];break;}}}}
      if(t===last)return;last=t;
      layer.innerHTML=t?'<span>'+t.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span>':'';};
    tr.addEventListener('cuechange',draw);v.addEventListener('timeupdate',draw);v.addEventListener('pause',draw);box._drawCap=draw;
  };

  /* Un solo audio a la vez */
  var hush=function(except){
    $$('.vplayer video').forEach(function(o){if(o!==except&&!o.paused)o.pause();});
    $$('.snd').forEach(function(b){var o=$('video',b.parentNode);if(o&&o!==except&&!o.muted){o.muted=true;if(b._set)b._set();}});
  };

  /* Videos en loop con botón de sonido: al activarlo vuelve al inicio para escucharlo completo */
  var ico='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="w-on" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="w-off" d="M17 9l4 6M21 9l-4 6"/></svg>';
  $$('.snd').forEach(function(b){
    var box=b.parentNode,v=$('video',box);if(!v)return;
    var label=b.textContent.trim();
    b._set=function(){b.innerHTML=ico+'<span>'+(v.muted?label:(/^en/.test(((b.closest&&b.closest('[lang]'))||document.documentElement).lang)?'Mute':'Silenciar'))+'</span>';b.setAttribute('aria-pressed',String(!v.muted));box.classList.toggle('sound-on',!v.muted);if(box._drawCap)box._drawCap();};
    caps(box,v,function(){return !v.muted;});
    b._set();
    b.addEventListener('click',function(){
      /* El video sigue visible: solo se activa el sonido y vuelve al inicio */
      if(v.muted){hush(v);arm(v);v.muted=false;try{if(v.readyState>0)v.currentTime=0;}catch(e){}
        startVid(v,function(){v.muted=true;b._set();startVid(v);});var t=box.querySelector('.vtap');if(t)t.remove();}
      else v.muted=true;
      b._set();
    });
  });

  /* Testimonios en video: clic para reproducir, con sonido y subtítulos */
  $$('.vplayer').forEach(function(box){var v=$('video',box),b=$('.vplay',box);if(!v)return;
    if(b)b.addEventListener('click',function(){hush(v);box.classList.add('playing');
      startVid(v,function(){box.classList.remove('playing');});});
    v.addEventListener('play',function(){hush(v);box.classList.add('playing');v.controls=true;});
    v.addEventListener('pause',function(){box.classList.remove('playing');});
    caps(box,v,function(){return box._force||!v.paused;});
  });

  /* Solo para capturas: ?captura&sub=clave@segundo deja ese video detenido en ese segundo con su subtítulo */
  var sm=captura&&/[?&]sub=([\w-]+)@([\d.]+)/.exec(location.search);
  if(sm)$$('.vplayer').forEach(function(box){var v=$('video',box);if(!v||($('source',v)||{}).src.indexOf('/'+sm[1]+'.')<0)return;
    box._force=true;box.classList.add('playing');v.preload='auto';
    var go=function(){v.currentTime=+sm[2];};
    if(v.readyState>=1)go();else{v.addEventListener('loadedmetadata',go);v.load();}
    v.addEventListener('seeked',function(){setTimeout(function(){box._drawCap&&box._drawCap();},300);});
  });

  /* Spotify bajo demanda */
  $$('.reveal').forEach(function(b){b.addEventListener('click',function(){
    var p=document.getElementById(b.getAttribute('aria-controls'));
    if(!p.firstChild){var fr=document.createElement('iframe');fr.src=p.dataset.src;fr.title=p.dataset.title;fr.loading='lazy';fr.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';p.appendChild(fr);}
    var o=p.hidden;p.hidden=!o;b.setAttribute('aria-expanded',o);});});

  /* Respiración YOMU con los dedos: como dice la canción, "Inhala y abres, exhala y cierras" */
  var go=document.getElementById('go');
  if(go){
    var TOTAL=10,OUT=5000,IN=4000,steps=document.getElementById('steps'),cue=document.getElementById('cue'),count=document.getElementById('count');
    for(var i=0;i<TOTAL;i++){var s=document.createElement('span');s.className='step';steps.appendChild(s);}
    var running=false,n=0,timer=null;
    var sph=document.getElementById('sphere'),tipg=document.getElementById('tipg'),ang=0;
    var phase=function(k,sec){if(!sph||reduce)return;sph.className='sphere '+k;ang+=180;tipg.style.transitionDuration=sec+'s';tipg.style.transform='rotate('+ang+'deg)';};
    var say=function(t){if(reduce){cue.textContent=t;return;}cue.classList.add('fade');setTimeout(function(){cue.textContent=t;cue.classList.remove('fade');},350);};
    var mark=function(){[].forEach.call(steps.children,function(el,i){el.className='step'+(i<n?' done':i===n&&running?' now':'');});count.textContent=running?('Respiración '+Math.min(n+1,TOTAL)+' de '+TOTAL):(TOTAL+' respiraciones');};
    var stop=function(){running=false;clearTimeout(timer);if(sph)sph.className='sphere';go.textContent=n>=TOTAL?'Otra vez':'Seguir respirando';mark();if(n>=TOTAL)n=0;};
    var breath=function(){if(!running)return;
      if(n>=TOTAL){stop();say('Sigue respirando serenamente mientras abres y cierras tus manos.');return;}
      mark();say('Inhala y abres…');phase('inhale',4);
      timer=setTimeout(function(){if(!running)return;say('Exhala y cierras…');phase('exhale',5);timer=setTimeout(function(){n++;breath();},OUT);},IN);};
    go.addEventListener('click',function(){if(running){stop();say('En pausa. Seguimos cuando quieras.');}else{running=true;go.textContent='Pausar';breath();}});
    mark();
  }

  /* Carrusel de testimonios: flechas en desktop, deslizable con puntos en mobile */
  $$('.quotes').forEach(function(q){
    var track=$('.q-track',q),cards=$$('.q',track),prev=$('.q-prev',q),next=$('.q-next',q),dots=$('.q-dots',q);
    var step=function(){return cards[1]?cards[1].offsetLeft-cards[0].offsetLeft:track.clientWidth;};
    var idx=function(){return Math.round(track.scrollLeft/step());};
    cards.forEach(function(c,i){var b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Testimonio '+(i+1)+' de '+cards.length);b.addEventListener('click',function(){track.scrollTo({left:i*step(),behavior:reduce?'auto':'smooth'});});dots.appendChild(b);});
    var sync=function(){var i=idx(),vis=Math.round(track.clientWidth/step())||1;$$('button',dots).forEach(function(b,k){b.setAttribute('aria-current',k===i)});if(prev)prev.disabled=track.scrollLeft<4;if(next)next.disabled=i>=cards.length-vis;};
    if(prev)prev.addEventListener('click',function(){track.scrollBy({left:-step(),behavior:reduce?'auto':'smooth'})});
    if(next)next.addEventListener('click',function(){track.scrollBy({left:step(),behavior:reduce?'auto':'smooth'})});
    track.addEventListener('scroll',function(){requestAnimationFrame(sync)},{passive:true});window.addEventListener('resize',sync);sync();
  });

  /* Cifras: conteo suave al entrar en pantalla (no en capturas) */
  var counters=$$('[data-count]');
  if(counters.length&&!reduce&&!captura&&'IntersectionObserver' in window){
    var fmt=function(el,v){return el.hasAttribute('data-sep')?v.toLocaleString('en-US'):String(v);};
    counters.forEach(function(el){el.dataset.final=el.textContent;});
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io.unobserve(e.target);
      var el=e.target,to=+el.dataset.count,t0=null,dur=1200;
      var tick=function(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/dur);el.textContent=fmt(el,Math.round(to*(1-Math.pow(1-k,3))))+(el.dataset.suffix||'');if(k<1)requestAnimationFrame(tick);else el.textContent=el.dataset.final;};
      requestAnimationFrame(tick);});},{threshold:.6});
    counters.forEach(function(el){io.observe(el)});
  }

  /* Altura para capturas de página completa */
  /* (en Kajabi este archivo carga después del evento load, así que también corre si la página ya terminó de cargar) */
  var alto=function(){setTimeout(function(){var d=document.documentElement;d.dataset.h=d.scrollHeight;
    if(captura)d.dataset.secs=JSON.stringify($$('main>section,footer').map(function(s){var r=s.getBoundingClientRect();return [s.id||s.getAttribute('aria-labelledby')||s.className,Math.round(r.top+scrollY),Math.round(r.height)];}));},900);};
  if(document.readyState==='complete')alto();else addEventListener('load',alto);

  /* Masterclass: formulario propio → Make (x-www-form-urlencoded, sin preflight de CORS).
     Honeypot lleno = no se envía. Sin datos personales en la URL de gracias. */
  /* Masterclass: en celular la barra aparece cuando el formulario del hero ya no se ve */
  var mcBar=$(".mc-bar"),mcReg=document.getElementById("registro");
  if(mcBar&&mcReg&&IO){window.__ypObs.push(new IntersectionObserver(function(es){es.forEach(function(e){mcBar.classList.toggle("on",!e.isIntersecting&&e.boundingClientRect.top<0);});},{root:root}));window.__ypObs[window.__ypObs.length-1].observe(mcReg);}

  var HOOK='https://hook.us2.make.com/qrlmjo4imsgn7x2bjjv5fs0542b2brnq',GRACIAS='/gracias-masterclass';
  /* Origen del registro (solo donde hay formulario de la Masterclass): utm_medium y utm_content de la URL
     al cargar, guardados en sessionStorage. Si la URL trae UTM, reemplazan a los guardados; si no, se usan los guardados. */
  var mcForms=$$('form[data-mc-form]'),utm={m:'',c:''};
  if(mcForms.length){var q=new URLSearchParams(location.search),um=q.get('utm_medium'),uc=q.get('utm_content');utm={m:um||'',c:uc||''};
    try{if(um||uc)sessionStorage.setItem('yomu_utm',JSON.stringify(utm));else utm=JSON.parse(sessionStorage.getItem('yomu_utm')||'null')||utm;}catch(e){}}
  var uM=String(utm.m||'').trim().toLowerCase(),origen=['ads','org','email'].indexOf(uM)>-1?uM:'otro';
  mcForms.forEach(function(f){
    var btn=$('button[type="submit"]',f),err=$('.mc-err',f),label=btn.textContent,busy=false;
    var req=$$('[required]',f);
    req.forEach(function(el){el.addEventListener(el.tagName==='SELECT'?'change':'input',function(){if(el.getAttribute('aria-invalid')==='true')el.setAttribute('aria-invalid',String(!el.checkValidity()||!el.value.trim()));});});
    f.addEventListener('submit',function(e){e.preventDefault();if(busy)return;err.hidden=true;
      var first=null;
      req.forEach(function(el){var bad=!el.value.trim()||!el.checkValidity();el.setAttribute('aria-invalid',String(bad));if(bad&&!first)first=el;});
      if(first){first.focus();return;}
      if(f.elements.website&&f.elements.website.value){location.href=GRACIAS;return;}
      busy=true;btn.disabled=true;btn.textContent='Enviando…';
      var data=new URLSearchParams();
      data.append('name',f.elements.name.value.trim());data.append('email',f.elements.email.value.trim());
      data.append('perfil',f.elements.perfil.value);data.append('source','landing-mc-dic5');
      data.append('origen',origen);data.append('origen_detalle',String(utm.c||''));
      var fail=function(){busy=false;btn.disabled=false;btn.textContent=label;err.hidden=false;};
      var ctl=window.AbortController?new AbortController():null,to=setTimeout(function(){if(ctl)ctl.abort();},20000);
      fetch(HOOK,{method:'POST',mode:'no-cors',body:data,keepalive:true,signal:ctl?ctl.signal:undefined})
        .then(function(){clearTimeout(to);location.href=GRACIAS;},function(){clearTimeout(to);fail();});
    });
  });
})();
