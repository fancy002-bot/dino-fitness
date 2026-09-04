import fs from "fs";
const F = "/private/tmp/claude-501/-Users-nigletlove/4a77a77d-444a-4342-908a-77fd49cc479c/scratchpad/loadbook.html";
let s = fs.readFileSync(F, "utf8");
let n = 0;
function sub(find, repl, label){
  const i = s.indexOf(find);
  if (i === -1) throw new Error("NOT FOUND: " + label);
  if (s.indexOf(find, i + 1) !== -1) throw new Error("NOT UNIQUE: " + label);
  s = s.slice(0, i) + repl + s.slice(i + find.length);
  n++; console.log("ok  " + label);
}

/* ---------- 1. CSS: catalogue-plate tile replaces the dashed pending tile ---------- */
sub(
`  .vit.pending{background:var(--surface); flex-direction:column; gap:5px; border-style:dashed;}
  .vit.pending::after{display:none;}
  .vit.pending .vno{font-family:'JetBrains Mono',monospace; font-size:0.7rem; letter-spacing:0.18em; color:var(--bronze);}
  .vit.pending .vlab{font-family:'Cormorant Garamond',serif; font-style:italic; font-size:0.82rem; color:var(--ink-mute);}`,
`  .vit.card{background:var(--study);}
  .vit.card::after{display:none;}
  .vit.card svg{width:100%; height:100%; display:block;}`,
  "css: .vit.card");

sub(
`  .plate.locked .vit img{filter:grayscale(1) brightness(0.55);}`,
`  .plate.locked .vit img{filter:grayscale(1) brightness(0.55);}
  .plate.locked .vit.card svg{filter:grayscale(1); opacity:0.6;}
  .plate{content-visibility:auto; contain-intrinsic-size:auto 268px;}`,
  "css: locked plate + content-visibility");

/* ---------- 2. JS: plate data + renderer, inserted above vitrine() ---------- */
sub(
`  /* ---------- figure rendering ---------- */
  function vitrine(id, owned, extraCls, forceFinish){
    var src = DINO_IMG[id] || "";
    if (!src) return '<div class="vit pending ' + (extraCls||"") + '"><span class="vno">' + specNo(id) + '</span><span class="vlab">cast pending</span></div>';`,
`  /* ---------- catalogue plates (specimens with no cast) ---------- */
  var PERIOD_HUE = {Cretaceous:"#6E8A56", Jurassic:"#4E7A85", Triassic:"#7A5A8C", Permian:"#A8563C"};
  function periodInfo(str){
    var t = String(str||""), key = null;
    if (/Cretaceous/i.test(t)) key = "Cretaceous";
    else if (/Jurassic/i.test(t)) key = "Jurassic";
    else if (/Triassic/i.test(t)) key = "Triassic";
    else if (/Permian/i.test(t)) key = "Permian";
    var label = (t.split(",")[0]||"").trim();
    return {color: key ? PERIOD_HUE[key] : "#6B6250", label: (label||"Period unrecorded").toUpperCase()};
  }
  function parseLengthM(str){
    var m = String(str||"").replace(/,/g,"").match(/([\\d.]+)\\s*(?:[\\u2013\\u2014-]\\s*([\\d.]+))?\\s*(m|cm)\\b/i);
    if (!m) return null;
    var a = parseFloat(m[1]), b = m[2] ? parseFloat(m[2]) : a, u = m[3].toLowerCase();
    var v = Math.max(a,b); if (u === "cm") v /= 100;
    return isFinite(v) && v > 0 ? v : null;
  }
  var DIET_GLYPH = {
    "Carnivore":       '<path d="M0 11 L5.5 0 L11 11 Z"/>',
    "Herbivore":       '<path d="M5.5 0 C10.5 3.6 10.5 8 5.5 11.5 C0.5 8 0.5 3.6 5.5 0 Z"/>',
    "Fish-eater":      '<path d="M0 5.8 Q5.5 0.4 11 5.8 Q5.5 11.2 0 5.8 Z"/>',
    "Omnivore":        '<circle cx="5.5" cy="5.5" r="5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5.5 0.5 A5 5 0 0 1 5.5 10.5 Z"/>',
    "Insectivore":     '<circle cx="2" cy="4" r="1.6"/><circle cx="9" cy="4" r="1.6"/><circle cx="5.5" cy="9.2" r="1.6"/>',
    "Filter-feeder":   '<rect x="0" y="1.4" width="11" height="1.7"/><rect x="0" y="5" width="11" height="1.7"/><rect x="0" y="8.6" width="11" height="1.7"/>',
    "Shellfish-eater": '<path d="M0.5 10.5 A5 5 0 0 1 10.5 10.5 Z"/>',
    "Scavenger":       '<path d="M0.7 10.4 L5.5 1 L10.3 10.4 Z" fill="none" stroke="currentColor" stroke-width="1.1"/>'
  };
  var PLATE_MAX_M = 40, PLATE_X = 13, PLATE_W = 94;
  function plateFrac(m){ return Math.max(0.028, Math.min(1, Math.sqrt(m/PLATE_MAX_M))); }
  function fmtLen(m){ return m >= 1 ? (Math.round(m*10)/10) + " m" : Math.round(m*100) + " cm"; }
  function fitSize(str, wide, mid, narrow){ var L = String(str).length; return L > 11 ? narrow : L > 8 ? mid : wide; }
  var MONO_STACK = "'JetBrains Mono',ui-monospace,Menlo,monospace";
  function specPlate(id){
    var d = DINOS.find(function(x){ return x.id === id; }) || {}, b = DINO_BIOS[id] || {};
    var p = periodInfo(b.period), len = parseLengthM(b.size);
    var ink = "#1A1710", mute = "rgba(26,23,16,0.52)", hair = "rgba(26,23,16,0.18)";
    var mass = b.mass || "\\u2014", diet = b.diet || "\\u2014";
    var glyph = DIET_GLYPH[diet] || '<circle cx="5.5" cy="5.5" r="5" fill="none" stroke="currentColor" stroke-width="1"/>';
    var barW = len ? Math.max(3, plateFrac(len)*PLATE_W) : 0;
    var humW = plateFrac(1.8)*PLATE_W;
    var o = [];
    o.push('<svg class="spec-plate" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeHtml((d.name||"Specimen") + " catalogue plate \\u2014 cast not yet commissioned") + '">');
    o.push('<rect width="120" height="120" fill="#ECE6D8"/>');
    o.push('<rect x="5.5" y="5.5" width="109" height="109" fill="none" stroke="' + hair + '" stroke-width="0.8"/>');
    o.push('<text x="12" y="19" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="6" letter-spacing="1.1" fill="' + mute + '">' + specNo(id) + '</text>');
    o.push('<g transform="translate(96 9)" fill="' + p.color + '" color="' + p.color + '">' + glyph + '</g>');
    o.push('<line x1="12" y1="26" x2="108" y2="26" stroke="' + hair + '" stroke-width="0.8"/>');
    o.push('<text x="12" y="36" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="5" letter-spacing="1" fill="' + mute + '">MASS</text>');
    o.push('<text x="12" y="46" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="' + fitSize(mass, 8, 6.4, 5.2) + '" fill="' + ink + '">' + escapeHtml(mass) + '</text>');
    o.push('<text x="66" y="36" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="5" letter-spacing="1" fill="' + mute + '">DIET</text>');
    o.push('<text x="66" y="46" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="' + fitSize(diet, 7, 5.8, 4.8) + '" fill="' + ink + '">' + escapeHtml(diet) + '</text>');
    o.push('<line x1="12" y1="53" x2="108" y2="53" stroke="' + hair + '" stroke-width="0.8"/>');
    o.push('<text x="12" y="63" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="5" letter-spacing="1" fill="' + mute + '">LENGTH</text>');
    o.push('<text x="108" y="63" text-anchor="end" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="8" fill="' + ink + '">' + (len ? fmtLen(len) : "\\u2014") + '</text>');
    if (len) o.push('<rect x="' + PLATE_X + '" y="68" width="' + barW.toFixed(1) + '" height="7" fill="' + p.color + '"/>');
    o.push('<line x1="' + PLATE_X + '" y1="78.6" x2="' + (PLATE_X+PLATE_W) + '" y2="78.6" stroke="' + hair + '" stroke-width="0.8" stroke-dasharray="1.5 2"/>');
    o.push('<rect x="' + PLATE_X + '" y="81" width="' + humW.toFixed(1) + '" height="3" fill="' + mute + '"/>');
    o.push('<text x="12" y="93" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="4.6" letter-spacing="0.55" fill="' + mute + '">1.8 M HUMAN FOR SCALE</text>');
    o.push('<rect x="6" y="98" width="108" height="16.5" fill="' + p.color + '" opacity="0.16"/>');
    o.push('<rect x="6" y="98" width="2.4" height="16.5" fill="' + p.color + '"/>');
    o.push('<text x="14" y="109" font-family=' + JSON.stringify(MONO_STACK) + ' font-size="5.6" letter-spacing="1.2" fill="' + ink + '">' + escapeHtml(p.label) + '</text>');
    o.push('</svg>');
    return o.join("");
  }

  /* ---------- figure rendering ---------- */
  function vitrine(id, owned, extraCls, forceFinish){
    var src = DINO_IMG[id] || "";
    if (!src) return '<div class="vit card ' + (extraCls||"") + '">' + specPlate(id) + '</div>';`,
  "js: specPlate + vitrine");

/* ---------- 3. shelf accepts any owned specimen, cast or not ---------- */
sub(
`      if (id && DINO_IMG[id]){`,
`      if (id && DINOS.some(function(x){ return x.id === id; })){`,
  "js: renderShelf");

/* ---------- 4. Uncast filter chip ---------- */
sub(
`  function shopMatches(d){
    if (state.shopGroup==="Bronze" && !isBronze(d.id)) return false;
    if (state.shopGroup==="Illustrated" && !DINO_IMG[d.id]) return false;
    if (state.shopGroup!=="All" && state.shopGroup!=="Bronze" && state.shopGroup!=="Illustrated" && d.group!==state.shopGroup) return false;`,
`  var SHOP_SPECIAL = {All:1, Illustrated:1, Uncast:1, Bronze:1};
  function shopMatches(d){
    if (state.shopGroup==="Bronze" && !isBronze(d.id)) return false;
    if (state.shopGroup==="Illustrated" && !DINO_IMG[d.id]) return false;
    if (state.shopGroup==="Uncast" && DINO_IMG[d.id]) return false;
    if (!SHOP_SPECIAL[state.shopGroup] && d.group!==state.shopGroup) return false;`,
  "js: shopMatches");

sub(
`    var list=["All","Illustrated","Bronze"].concat(GROUPS.slice(1));
    list.forEach(function(g){
      var n = g==="All" ? DINOS.length : g==="Illustrated" ? DINOS.filter(function(d){return !!DINO_IMG[d.id];}).length : g==="Bronze" ? BRONZE.length : DINOS.filter(function(d){return d.group===g;}).length;`,
`    var list=["All","Illustrated","Uncast","Bronze"].concat(GROUPS.slice(1));
    list.forEach(function(g){
      var n = g==="All" ? DINOS.length : g==="Illustrated" ? DINOS.filter(function(d){return !!DINO_IMG[d.id];}).length : g==="Uncast" ? DINOS.filter(function(d){return !DINO_IMG[d.id];}).length : g==="Bronze" ? BRONZE.length : DINOS.filter(function(d){return d.group===g;}).length;`,
  "js: renderFilterChips");

/* ---------- 5. wording: the plate IS the catalogue record, not an absence ---------- */
sub(
`(isBronze(d.id)?"Bronze cast":(DINO_IMG[d.id]?"Study model":"No cast yet"))`,
`(isBronze(d.id)?"Bronze cast":(DINO_IMG[d.id]?"Study model":"Catalogue plate"))`,
  "js: plate foot wording");

sub(
`(isBronze(id)?"Bronze cast":(DINO_IMG[id]?"Study model":"Cast not yet commissioned"))`,
`(isBronze(id)?"Bronze cast":(DINO_IMG[id]?"Study model":"Catalogue plate \\u00b7 cast not yet commissioned"))`,
  "js: sheet wording");

/* ---------- 6. debounce the catalogue search (618 plates rebuild per keystroke) ---------- */
sub(
`  document.getElementById("shopSearch").addEventListener("input",function(){ state.shopQuery=this.value; renderShop(); });`,
`  var shopSearchTimer=null;
  document.getElementById("shopSearch").addEventListener("input",function(){ var v=this.value; clearTimeout(shopSearchTimer); shopSearchTimer=setTimeout(function(){ state.shopQuery=v; renderShop(); },160); });`,
  "js: search debounce");

fs.writeFileSync(F, s);
console.log("\\n" + n + " edits applied; " + s.length + " bytes");
