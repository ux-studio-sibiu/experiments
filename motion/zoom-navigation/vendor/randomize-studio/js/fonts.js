/* Google Fonts catalog + loader. Loaded as a plain <script> before script.js;
   exposes FONTS, FB, byName, CATS, loadFont on the global scope.
   name, category, available weights, italics? — weights kept accurate to avoid
   Google Fonts css2 returning 400 for an unavailable variant. */
const FONTS = [
 {n:'Inter',c:'sans',w:[100,200,300,400,500,600,700,800,900],i:true},
 {n:'Roboto',c:'sans',w:[100,300,400,500,700,900],i:true},
 {n:'Open Sans',c:'sans',w:[300,400,500,600,700,800],i:true},
 {n:'Montserrat',c:'sans',w:[100,200,300,400,500,600,700,800,900],i:true},
 {n:'Poppins',c:'sans',w:[100,200,300,400,500,600,700,800,900],i:true},
 {n:'Work Sans',c:'sans',w:[100,200,300,400,500,600,700,800,900],i:true},
 {n:'Raleway',c:'sans',w:[100,200,300,400,500,600,700,800,900],i:true},
 {n:'Nunito',c:'sans',w:[200,300,400,500,600,700,800,900],i:true},
 {n:'Manrope',c:'sans',w:[200,300,400,500,600,700,800],i:false},
 {n:'DM Sans',c:'sans',w:[400,500,700],i:true},
 {n:'Space Grotesk',c:'sans',w:[300,400,500,600,700],i:false},
 {n:'Sora',c:'sans',w:[100,200,300,400,500,600,700,800],i:false},
 {n:'Outfit',c:'sans',w:[100,200,300,400,500,600,700,800,900],i:false},
 {n:'Lexend',c:'sans',w:[100,200,300,400,500,600,700,800,900],i:false},
 {n:'Plus Jakarta Sans',c:'sans',w:[200,300,400,500,600,700,800],i:true},
 {n:'Archivo',c:'sans',w:[100,200,300,400,500,600,700,800,900],i:true},
 {n:'Figtree',c:'sans',w:[300,400,500,600,700,800,900],i:true},
 {n:'Playfair Display',c:'serif',w:[400,500,600,700,800,900],i:true},
 {n:'Merriweather',c:'serif',w:[300,400,700,900],i:true},
 {n:'Lora',c:'serif',w:[400,500,600,700],i:true},
 {n:'PT Serif',c:'serif',w:[400,700],i:true},
 {n:'Cormorant Garamond',c:'serif',w:[300,400,500,600,700],i:true},
 {n:'EB Garamond',c:'serif',w:[400,500,600,700,800],i:true},
 {n:'Libre Baskerville',c:'serif',w:[400,700],i:true},
 {n:'Bitter',c:'serif',w:[100,200,300,400,500,600,700,800,900],i:true},
 {n:'Spectral',c:'serif',w:[200,300,400,500,600,700,800],i:true},
 {n:'Source Serif 4',c:'serif',w:[200,300,400,500,600,700,800,900],i:true},
 {n:'Fraunces',c:'serif',w:[100,200,300,400,500,600,700,800,900],i:true},
 {n:'DM Serif Display',c:'serif',w:[400],i:true},
 {n:'Bebas Neue',c:'display',w:[400],i:false},
 {n:'Anton',c:'display',w:[400],i:false},
 {n:'Abril Fatface',c:'display',w:[400],i:false},
 {n:'Oswald',c:'display',w:[200,300,400,500,600,700],i:false},
 {n:'Archivo Black',c:'display',w:[400],i:false},
 {n:'Lobster',c:'display',w:[400],i:false},
 {n:'Space Mono',c:'mono',w:[400,700],i:true},
 {n:'JetBrains Mono',c:'mono',w:[100,200,300,400,500,600,700,800],i:true},
 {n:'IBM Plex Mono',c:'mono',w:[100,200,300,400,500,600,700],i:true},
 {n:'Caveat',c:'hand',w:[400,500,600,700],i:false},
 {n:'Dancing Script',c:'hand',w:[400,500,600,700],i:false},
 {n:'Pacifico',c:'hand',w:[400],i:false},
];
const FB = { sans:'sans-serif', serif:'serif', display:'sans-serif', mono:'monospace', hand:'cursive' };
const byName = (n) => FONTS.find(f => f.n === n) || FONTS[0];
const CATS = [['sans','Sans-serif'],['serif','Serif'],['display','Display'],['mono','Monospace'],['hand','Handwriting']];

const loaded = new Set();
function loadFont(name) {
  if (loaded.has(name)) return;
  loaded.add(name);
  const f = byName(name);
  const w = [...f.w].sort((a,b)=>a-b);
  const axis = f.i
    ? 'ital,wght@' + w.map(x=>`0,${x}`).concat(w.map(x=>`1,${x}`)).join(';')
    : 'wght@' + w.join(';');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g,'+')}:${axis}&display=swap`;
  document.head.appendChild(link);
}
