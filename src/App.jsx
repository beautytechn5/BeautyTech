import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { supabase } from './supabase.js'

const T = {
  rose:"#C8907A", roseDp:"#A8705A", roseL:"#F0D9D1", roseHov:"#96604A",
  gold:"#B8A060", goldL:"#E8D8A0", goldPale:"#F5EDD8", gold2:"#C8A870",
  cream:"#FAF7F2", creamDk:"#F2EDE5",
  ink:"#2C2018", inkSoft:"#6B5A4E", inkMuted:"#A89888",
  white:"#FFFFFF", green:"#25A050", greenL:"#E8F8EE",
  red:"#C03030", redL:"#FDE8E8", wa:"#25D366", waL:"#E8F8EE",
}

/* ── Toast ── */
const ToastCtx = createContext(null)
function ToastProvider({ children }) {
  const [t, setT] = useState({ msg:"", show:false })
  const show = useCallback((msg) => {
    setT({ msg, show:true })
    setTimeout(() => setT(p => ({ ...p, show:false })), 3000)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{
        position:"fixed", bottom:24, left:"50%", zIndex:9999,
        transform:`translateX(-50%) translateY(${t.show ? 0 : 90}px)`,
        transition:"transform .3s", background:T.ink, color:T.white,
        padding:"12px 24px", borderRadius:50, fontSize:14, fontWeight:600,
        boxShadow:"0 8px 32px rgba(44,32,24,.25)", whiteSpace:"nowrap", pointerEvents:"none",
      }}>{t.msg}</div>
    </ToastCtx.Provider>
  )
}
const useToast = () => useContext(ToastCtx)

/* ── Shared UI ── */
function Card({ children, style }) {
  return <div style={{ background:T.white, borderRadius:16, boxShadow:"0 2px 16px rgba(44,32,24,.07)", ...style }}>{children}</div>
}

function PBtn({ children, onClick, disabled, gold, full, sm }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseOver={() => setH(true)} onMouseOut={() => setH(false)}
      style={{
        width:full?"100%":"auto", padding:sm?"9px 18px":"14px 28px",
        borderRadius:50, border:"none",
        background:disabled ? T.roseL : gold ? (h?"#A89050":T.gold) : (h ? T.roseHov : T.roseDp),
        color:disabled ? T.rose : T.white,
        fontSize:sm?13:15, fontWeight:800, cursor:disabled?"not-allowed":"pointer",
        fontFamily:"Tajawal,sans-serif", transition:"all .2s",
        boxShadow:disabled?"none":"0 4px 14px rgba(0,0,0,.12)",
      }}>{children}</button>
  )
}

function OBtn({ children, onClick, full, sm }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick}
      onMouseOver={() => setH(true)} onMouseOut={() => setH(false)}
      style={{
        width:full?"100%":"auto", padding:sm?"9px 18px":"13px 24px",
        borderRadius:50, border:`1.5px solid ${h ? T.roseDp : T.creamDk}`,
        background:h ? T.roseL : T.white, color:h ? T.roseDp : T.inkSoft,
        fontSize:sm?13:14, fontWeight:700, cursor:"pointer",
        fontFamily:"Tajawal,sans-serif", transition:"all .2s",
      }}>{children}</button>
  )
}

function Field({ label, type, placeholder, value, onChange, required }) {
  const [f, setF] = useState(false)
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>
        {label} {required && <span style={{ color:T.rose }}>*</span>}
      </label>}
      <input type={type||"text"} placeholder={placeholder} value={value} onChange={onChange}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{
          width:"100%", padding:"13px 16px",
          border:`1.5px solid ${f ? T.rose : T.creamDk}`,
          borderRadius:12, fontSize:15, color:T.ink,
          background:f ? T.white : T.cream,
          outline:"none", transition:"all .2s", fontFamily:"Tajawal,sans-serif",
        }} />
    </div>
  )
}

function Empty({ icon, title, desc }) {
  return (
    <div style={{ padding:"48px 24px", textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:12, opacity:.5 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, color:T.inkSoft, lineHeight:1.7 }}>{desc}</div>
    </div>
  )
}

/* ── Terms Modal ── */
function TermsModal({ open, onClose }) {
  if (!open) return null
  const items = [
    { t:"١. طبيعة المنصة", b:"بيوتي تيك وسيط تقني يربط العملاء بالصالونات. الصالون مسؤول بالكامل عن صحة بياناته وجودة خدماته." },
    { t:"٢. الحجز والعربون", b:"يُشترط دفع عربون 30% عند الحجز. العربون غير مسترد عند الإلغاء، ويُخصم من الفاتورة النهائية." },
    { t:"٣. تعديل المواعيد", b:"يحق للعميلة تعديل موعدها مرة واحدة فقط قبل 24 ساعة من الموعد." },
    { t:"٤. الخصوصية", b:"تلتزم المنصة بحماية بيانات المستخدمين وعدم مشاركتها مع أطراف ثالثة." },
    { t:"٥. إلغاء الاشتراك", b:"رسوم الاشتراك المدفوعة غير مستردة. رسوم التأسيس 600 ر.س غير مستردة في جميع الأحوال." },
  ]
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(44,32,24,.5)", zIndex:3000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.white, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:560, maxHeight:"85vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"18px 22px", borderBottom:`1px solid ${T.creamDk}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>الشروط والأحكام</div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", border:"none", background:T.cream, color:T.inkSoft, fontSize:15, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", padding:"18px 22px", flex:1 }}>
          {items.map((s, i) => (
            <div key={i} style={{ marginBottom:16, paddingBottom:16, borderBottom:i < items.length-1 ? `1px solid ${T.creamDk}` : "none" }}>
              <div style={{ fontSize:13, fontWeight:800, color:T.roseDp, marginBottom:6 }}>{s.t}</div>
              <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.8 }}>{s.b}</p>
            </div>
          ))}
          <div style={{ background:T.goldPale, borderRadius:12, padding:"12px 16px", fontSize:12, color:T.inkSoft }}>
            📌 بالتسجيل فأنتِ توافقين على جميع الشروط أعلاه.
          </div>
        </div>
        <div style={{ padding:"14px 22px", borderTop:`1px solid ${T.creamDk}` }}>
          <PBtn full onClick={onClose}>فهمت — إغلاق</PBtn>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   🏠 CLIENT HOME
══════════════════════════════════════════ */
// الصالونات تُجلب من Supabase
const SALONS = []

function useSalons() {
  const [data, setData] = useState([])
  useEffect(() => {
    const load = async () => {
      const { data: rows } = await supabase.from('salons').select('*')
      if (!rows) return
      // جلب الخدمات لكل صالون
      const { data: allServices } = await supabase.from('services').select('*').eq('active', true)
      setData(rows.map(s => ({
        id: s.id,
        name: s.name || "",
        emoji: "💅",
        city: s.city || "",
        area: s.city || "",
        pkg: s.package || "basic",
        rating: 5.0,
        reviews: 0,
        tags: s.bio ? [s.bio.slice(0,10)] : [],
        services: (allServices || [])
          .filter(sv => sv.salon_id === s.id)
          .map(sv => ({ n: sv.name, p: sv.price, dur: sv.duration, timeFrom: sv.time_from, timeTo: sv.time_to, days: sv.days })),
        wa: (s.phone || "0500000000"),
        mapUrl: s.map_url || "",
        availNow: true,
      })))
    }
    load()
  }, [])
  return data
}

// اقتراحات البحث الذكي
const SUGGESTIONS = [
  { text:"صبغ شعر",      icon:"🎨", cat:"خدمات" },
  { text:"قص شعر",       icon:"✂️",  cat:"خدمات" },
  { text:"مكياج",        icon:"💄", cat:"خدمات" },
  { text:"كيراتين",      icon:"💇‍♀️", cat:"خدمات" },
  { text:"سبا",          icon:"🧖‍♀️", cat:"خدمات" },
  { text:"أكريليك أظافر",icon:"💅", cat:"خدمات" },
  { text:"تنظيف بشرة",   icon:"✨", cat:"خدمات" },
  { text:"مساج",         icon:"💆‍♀️", cat:"خدمات" },
  { text:"عرائس",        icon:"👰", cat:"مناسبات" },
  { text:"الرياض",       icon:"📍", cat:"مدن" },
  { text:"جدة",          icon:"📍", cat:"مدن" },
  { text:"الدمام",       icon:"📍", cat:"مدن" },
]

/* ══════════════════════════════════════════
   ✨ ANIMATED TYPING TEXT
══════════════════════════════════════════ */
const PHRASES = [
  "أنتِ تستحقين الأفضل دائماً",
  "جمالكِ يبدأ من اهتمامكِ بنفسكِ",
  "كل موعد هو لحظة تجديد لروحكِ",
  "أنتِ أجمل نسخة من نفسكِ",
  "اعتني بنفسكِ، أنتِ تستأهلين",
  "وقتكِ الخاص أغلى شيء",
  "احجزي لحظتكِ الخاصة اليوم",
  "جمالكِ استثمار لا تقصيري فيه",
  "ثقتكِ بنفسكِ هي أجمل إكسسوار",
  "لأنكِ تستحقين لحظة خاصة بكِ",
]

function TypingText() {
  const [idx, setIdx]     = useState(0)
  const [displayed, setDisplayed] = useState("")
  const [phase, setPhase] = useState("typing")  // typing | pause | erasing

  useEffect(() => {
    const target = PHRASES[idx]
    let timer

    if (phase === "typing") {
      if (displayed.length < target.length) {
        timer = setTimeout(() => {
          setDisplayed(target.slice(0, displayed.length + 1))
        }, 80)
      } else {
        timer = setTimeout(() => setPhase("pause"), 1800)
      }
    } else if (phase === "pause") {
      timer = setTimeout(() => setPhase("erasing"), 400)
    } else if (phase === "erasing") {
      if (displayed.length > 0) {
        timer = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1))
        }, 40)
      } else {
        setIdx((idx + 1) % PHRASES.length)
        setPhase("typing")
      }
    }
    return () => clearTimeout(timer)
  }, [displayed, phase, idx])

  return (
    <div style={{
      minHeight: 28,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      marginBottom: 22,
    }}>
      <span style={{
        fontSize: 15,
        fontWeight: 700,
        color: T.roseDp,
        fontFamily: "Tajawal, sans-serif",
        letterSpacing: ".3px",
        direction: "rtl",
      }}>
        {displayed}
      </span>
      {/* cursor blink */}
      <span style={{
        display: "inline-block",
        width: 2,
        height: 18,
        background: T.rose,
        borderRadius: 2,
        animation: "none",
        opacity: phase === "pause" ? 0 : 1,
        transition: "opacity .15s",
        flexShrink: 0,
      }} />
    </div>
  )
}

function ClientHome({ setScreen, setSalon }) {
  const salons = useSalons()
  const [q, setQ]           = useState("")
  const [fq, setFq]         = useState(false)
  const [showSugg, setShowSugg] = useState(false)
  const [availNow, setAvailNow] = useState(false)
  const [sortBy, setSortBy] = useState("recommended") // recommended | rating | price | popular
  const [priceRange, setPriceRange] = useState([0, 1000])
  const [dragging, setDragging] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [timeSlot, setTimeSlot] = useState(null) // null | morning | afternoon | evening

  const filtered_sugg = q.length > 0
    ? SUGGESTIONS.filter(s => s.text.includes(q))
    : SUGGESTIONS.slice(0, 6)

  // فلترة + ترتيب الصالونات
  let list = salons.filter(s => {
    if (availNow && !s.availNow) return false
    if (q && !s.name.includes(q) && !s.area.includes(q) && !(s.tags || []).some(t => t.includes(q))) return false
    const minP = s.services && s.services.length > 0 ? Math.min(...s.services.map(sv => sv.p)) : 0
    if (minP < priceRange[0] || minP > priceRange[1]) return false
    return true
  })

  if (sortBy === "rating")      list = [...list].sort((a,b) => b.rating - a.rating)
  if (sortBy === "price")       list = [...list].sort((a,b) => Math.min(...a.services.map(s=>s.p)) - Math.min(...b.services.map(s=>s.p)))
  if (sortBy === "popular")     list = [...list].sort((a,b) => b.reviews - a.reviews)
  if (sortBy === "recommended") list = [...list].sort((a,b) => (b.rating * 0.6 + (b.reviews/100) * 0.4) - (a.rating * 0.6 + (a.reviews/100) * 0.4))

  const activeFilters = (availNow ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < 1000 ? 1 : 0) + (timeSlot ? 1 : 0)

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>

      {/* Hero */}
      <div style={{ background:`linear-gradient(145deg,${T.roseL} 0%,${T.goldPale} 65%,${T.cream} 100%)`, padding:"44px 20px 36px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%", background:"radial-gradient(circle,rgba(200,144,122,.18),transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-30, left:-30, width:140, height:140, borderRadius:"50%", background:"radial-gradient(circle,rgba(184,160,96,.14),transparent 70%)", pointerEvents:"none" }} />
        <div style={{ display:"inline-block", background:T.white, color:T.gold, fontSize:11, fontWeight:700, padding:"4px 14px", borderRadius:20, letterSpacing:".8px", marginBottom:14, border:`1px solid ${T.goldL}` }}>
          ✦ منصة صالونات التجميل الأولى في المملكة
        </div>
        <h1 style={{ fontSize:30, fontWeight:900, color:T.ink, lineHeight:1.2, marginBottom:10 }}>
          احجزي موعدك<br /><span style={{ color:T.roseDp }}>بثقة ويُسر</span>
        </h1>
        <TypingText />
        <p style={{ fontSize:14, color:T.inkSoft, marginBottom:24, lineHeight:1.7 }}>
          اكتشفي أفضل صالونات التجميل واحجزي بضمان العربون
        </p>

        {/* Smart Search */}
        <div style={{ position:"relative", maxWidth:480, margin:"0 auto", zIndex:10 }}>
          <span style={{ position:"absolute", right:16, top:17, fontSize:17, pointerEvents:"none" }}>🔍</span>
          <input value={q} onChange={e => { setQ(e.target.value); setShowSugg(true) }}
            placeholder="ابحثي عن خدمة أو صالون أو مدينة..."
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            style={{ width:"100%", padding:"14px 46px 14px 18px", border:`2px solid ${fq||showSugg ? T.rose : "transparent"}`, borderRadius:showSugg && filtered_sugg.length > 0 ? "14px 14px 0 0" : 14, fontSize:14, color:T.ink, background:T.white, outline:"none", fontFamily:"Tajawal,sans-serif", boxShadow:"0 6px 24px rgba(44,32,24,.12)", transition:"all .2s" }} />
          {showSugg && filtered_sugg.length > 0 && (
            <div style={{ position:"absolute", top:"100%", right:0, left:0, background:T.white, borderRadius:"0 0 14px 14px", boxShadow:"0 8px 24px rgba(44,32,24,.14)", border:`2px solid ${T.rose}`, borderTop:"none", overflow:"hidden" }}>
              {q.length === 0 && <div style={{ padding:"8px 14px 4px", fontSize:11, fontWeight:700, color:T.inkMuted, letterSpacing:".5px" }}>اقتراحات شائعة</div>}
              {filtered_sugg.map((s, i) => (
                <div key={i} onMouseDown={() => { setQ(s.text); setShowSugg(false) }}
                  style={{ padding:"10px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", borderBottom:i < filtered_sugg.length-1 ? `1px solid ${T.creamDk}` : "none" }}
                  onMouseOver={e => e.currentTarget.style.background = T.roseL}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize:18 }}>{s.icon}</span>
                  <span style={{ fontSize:14, color:T.ink, fontWeight:500 }}>{s.text}</span>
                  <span style={{ fontSize:10, color:T.inkMuted, marginRight:"auto", background:T.creamDk, padding:"2px 8px", borderRadius:10 }}>{s.cat}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── فلاتر ذكية ── */}
      <div style={{ padding:"16px 16px 0" }}>

        {/* Quick filters row */}
        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:12 }}>

          {/* متاح الآن */}
          <button onClick={() => setAvailNow(!availNow)}
            style={{ padding:"8px 16px", borderRadius:50, border:`1.5px solid ${availNow ? T.green : T.creamDk}`, background:availNow ? T.greenL : T.white, color:availNow ? T.green : T.inkSoft, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"Tajawal,sans-serif", transition:"all .2s", display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:availNow ? T.green : "#CCC", display:"inline-block" }} />
            متاح الآن
          </button>

          {/* فلاتر إضافية */}
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ padding:"8px 16px", borderRadius:50, border:`1.5px solid ${showFilters || activeFilters > 0 ? T.roseDp : T.creamDk}`, background:showFilters || activeFilters > 0 ? T.roseL : T.white, color:showFilters || activeFilters > 0 ? T.roseDp : T.inkSoft, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"Tajawal,sans-serif", transition:"all .2s", display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            🎛 فلترة {activeFilters > 0 && <span style={{ background:T.roseDp, color:T.white, borderRadius:"50%", width:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>{activeFilters}</span>}
          </button>

          {/* ترتيب */}
          {[
            { id:"recommended", label:"الأنسب", icon:"✦" },
            { id:"rating",      label:"الأعلى تقييماً", icon:"⭐" },
            { id:"price",       label:"الأقل سعراً", icon:"💰" },
            { id:"popular",     label:"الأكثر حجزاً", icon:"🔥" },
          ].map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id)}
              style={{ padding:"8px 14px", borderRadius:50, border:`1.5px solid ${sortBy===s.id ? T.roseDp : T.creamDk}`, background:sortBy===s.id ? T.roseL : T.white, color:sortBy===s.id ? T.roseDp : T.inkSoft, fontSize:12, fontWeight:sortBy===s.id ? 700 : 500, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"Tajawal,sans-serif", transition:"all .2s", flexShrink:0 }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Expanded filters panel */}
        {showFilters && (
          <div style={{ background:T.white, borderRadius:16, padding:"16px", marginBottom:14, boxShadow:"0 2px 16px rgba(44,32,24,.07)" }}>

            {/* Price range */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>نطاق السعر</div>
                <div style={{ fontSize:12, color:T.roseDp, fontWeight:700 }}>
                  {priceRange[0]} — {priceRange[1]} ر.س
                </div>
              </div>
              {/* Simple range display with two buttons */}
              <div style={{ background:T.cream, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:12, color:T.inkSoft, flexShrink:0 }}>من</span>
                  <input type="range" min={0} max={900} step={50} value={priceRange[0]}
                    onChange={e => setPriceRange([Math.min(Number(e.target.value), priceRange[1]-50), priceRange[1]])}
                    style={{ flex:1, accentColor:T.roseDp }} />
                  <span style={{ fontSize:12, color:T.inkSoft, flexShrink:0 }}>إلى</span>
                  <input type="range" min={100} max={1000} step={50} value={priceRange[1]}
                    onChange={e => setPriceRange([priceRange[0], Math.max(Number(e.target.value), priceRange[0]+50)])}
                    style={{ flex:1, accentColor:T.roseDp }} />
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {[[0,200,"أقل من 200"],[200,500,"200-500"],[500,800,"500-800"],[0,1000,"الكل"]].map(r => (
                    <button key={r[2]} onClick={() => setPriceRange([r[0], r[1]])}
                      style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${priceRange[0]===r[0]&&priceRange[1]===r[1] ? T.roseDp : T.creamDk}`, background:priceRange[0]===r[0]&&priceRange[1]===r[1] ? T.roseL : T.white, color:priceRange[0]===r[0]&&priceRange[1]===r[1] ? T.roseDp : T.inkSoft, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                      {r[2]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Time slot */}
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:10 }}>الوقت المفضل</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {[
                  { id:"morning",   icon:"🌅", label:"صباح", time:"8-12" },
                  { id:"afternoon", icon:"☀️",  label:"ظهيرة", time:"12-5" },
                  { id:"evening",   icon:"🌙", label:"مساء", time:"5-10" },
                ].map(sl => (
                  <button key={sl.id} onClick={() => setTimeSlot(timeSlot===sl.id ? null : sl.id)}
                    style={{ padding:"12px 8px", borderRadius:12, border:`1.5px solid ${timeSlot===sl.id ? T.roseDp : T.creamDk}`, background:timeSlot===sl.id ? T.roseL : T.cream, cursor:"pointer", textAlign:"center", fontFamily:"Tajawal,sans-serif", transition:"all .2s" }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{sl.icon}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:timeSlot===sl.id ? T.roseDp : T.ink }}>{sl.label}</div>
                    <div style={{ fontSize:10, color:T.inkSoft }}>{sl.time}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            {activeFilters > 0 && (
              <button onClick={() => { setAvailNow(false); setPriceRange([0,1000]); setTimeSlot(null) }}
                style={{ marginTop:12, width:"100%", padding:"9px", borderRadius:10, border:`1px solid ${T.roseL}`, background:T.white, color:T.roseDp, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                ✕ إلغاء كل الفلاتر
              </button>
            )}
          </div>
        )}

        {/* Results header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:900, color:T.ink }}>الصالونات المسجّلة</div>
            <div style={{ fontSize:12, color:T.inkSoft, marginTop:2 }}>ستظهر هنا بعد انضمام الصالونات</div>
          </div>
          {list.length > 0 && <div style={{ fontSize:12, color:T.inkSoft }}>{list.length} نتيجة</div>}
        </div>

        {/* Empty state */}
        {list.length === 0 && (
          <div style={{ background:T.white, borderRadius:20, padding:"44px 24px", textAlign:"center", border:`2px dashed ${T.roseL}`, marginBottom:20 }}>
            <div style={{ fontSize:52, marginBottom:14 }}>🌸</div>
            <div style={{ fontSize:18, fontWeight:900, color:T.ink, lineHeight:1.4, marginBottom:10 }}>
              المنصة في طور النمو،<br /><span style={{ color:T.roseDp }}>كوني أول صالون ينضم!</span>
            </div>
            <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.8, marginBottom:24 }}>
              سيظهر صالونك في أول القائمة وتحصلين على<br />أفضل ظهور أمام العملاء منذ اليوم الأول.
            </p>
            <PBtn gold onClick={() => setScreen("owner-register")}>✦ سجّلي صالونك الآن</PBtn>
          </div>
        )}

        {/* Salon cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {list.map(s => (
            <Card key={s.id} style={{ overflow:"hidden" }}>
              <div style={{ height:90, background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, position:"relative" }}>
                {s.emoji}
                <div style={{ position:"absolute", top:10, right:12, background:T.white, color:T.gold, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, border:`1px solid ${T.goldL}` }}>
                  {s.pkg === "نخبة" ? "✦ نخبة" : "⚡ توسع"}
                </div>
                {s.availNow && (
                  <div style={{ position:"absolute", top:10, left:12, background:T.greenL, color:T.green, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:T.green, display:"inline-block" }} />
                    متاح الآن
                  </div>
                )}
              </div>
              <div style={{ padding:"14px 16px 16px" }}>
                <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:5 }}>{s.name}</div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <span style={{ color:T.gold, fontSize:13, fontWeight:700 }}>
                    {"★★★★★".slice(0, Math.floor(s.rating))}
                    <span style={{ color:T.inkSoft, fontWeight:400 }}> ({s.reviews})</span>
                  </span>
                  <span style={{ fontSize:12, color:T.inkSoft }}>📍 {s.city}، {s.area}</span>
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                  {s.tags.map(tg => (
                    <span key={tg} style={{ background:T.roseL, color:T.roseDp, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20 }}>{tg}</span>
                  ))}
                </div>
                {/* Services with time slots */}
                <div style={{ background:T.cream, borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.inkSoft, marginBottom:8 }}>أبرز الخدمات</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {s.services.slice(0, 3).map(sv => (
                      <div key={sv.n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13 }}>
                        <span style={{ color:T.ink }}>{sv.n}</span>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, color:T.inkSoft }}>⏱ {sv.dur || 60}د</span>
                          <span style={{ color:T.gold, fontWeight:700, fontSize:12 }}>{sv.p} ر.س</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Time slots visual */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.inkSoft, marginBottom:6 }}>الأوقات المتاحة</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                    {[
                      { id:"morning",   icon:"🌅", label:"صباح",  available:true },
                      { id:"afternoon", icon:"☀️",  label:"ظهيرة", available:true },
                      { id:"evening",   icon:"🌙", label:"مساء",  available:false },
                    ].map(sl => (
                      <div key={sl.id} style={{ padding:"8px 6px", borderRadius:10, background:sl.available ? T.greenL : T.creamDk, textAlign:"center", opacity:sl.available ? 1 : .5 }}>
                        <div style={{ fontSize:16 }}>{sl.icon}</div>
                        <div style={{ fontSize:10, fontWeight:600, color:sl.available ? T.green : T.inkMuted, marginTop:2 }}>{sl.label}</div>
                        <div style={{ fontSize:9, color:sl.available ? T.green : T.inkMuted }}>
                          {sl.available ? "متاح" : "محجوز"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display:"flex", gap:8 }}>
                  <PBtn full onClick={() => { setSalon(s); setScreen("booking") }}>احجزي الآن</PBtn>
                  <a href={"https://wa.me/966" + s.wa.slice(1)} target="_blank" rel="noreferrer"
                    style={{ width:46, height:46, borderRadius:12, background:T.waL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, textDecoration:"none", flexShrink:0 }}>💬</a>
                  <button onClick={() => { if (s.mapUrl) window.open(s.mapUrl, "_blank"); else alert("الصالون لم يضف موقعه بعد") }}
                    style={{ width:46, height:46, borderRadius:12, background:T.goldPale, border:"none", fontSize:20, cursor:"pointer", flexShrink:0 }}>📍</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Trust bar */}
      <div style={{ margin:"16px 16px 0", background:T.white, borderRadius:16, padding:"16px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[
            { icon:"🛡️", t:"حجوزات آمنة", d:"تشفير كامل" },
            { icon:"🤖", t:"بوت واتساب", d:"ردود آلية" },
            { icon:"💬", t:"دعم 24/7", d:"فريقنا معكِ" },
            { icon:"🔒", t:"عربون مضمون", d:"سياسة شفافة" },
          ].map(it => (
            <div key={it.t} style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:T.roseL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{it.icon}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{it.t}</div>
                <div style={{ fontSize:11, color:T.inkSoft }}>{it.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Owner CTA */}
      <div style={{ margin:"16px", background:"linear-gradient(135deg,#A8705A,#7A4830)", borderRadius:16, padding:"22px 20px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,.6)", letterSpacing:1, marginBottom:6 }}>هل تملكين صالوناً؟</div>
        <div style={{ fontSize:18, fontWeight:800, color:T.white, marginBottom:6 }}>انضمي لبيوتي تيك</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,.8)", lineHeight:1.7, marginBottom:16 }}>
          حجوزات إلكترونية · عربون آلي · بوت واتساب<br />رسوم تأسيس 600 ر.س مرة واحدة
        </div>
        <PBtn gold onClick={() => setScreen("owner-register")}>ابدأي الآن ←</PBtn>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   📅 BOOKING
══════════════════════════════════════════ */
function BookingPage({ salon, setScreen }) {
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [svc, setSvc] = useState(null)
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const deposit = svc ? Math.round(svc.p * 0.3) : 0
  const ALL_SVC_TIMES = ["00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30","05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"]
  const getSvcTimes = () => {
    if (!svc || !svc.timeFrom || !svc.timeTo) return ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"]
    const fi = ALL_SVC_TIMES.indexOf(svc.timeFrom)
    const ti = ALL_SVC_TIMES.indexOf(svc.timeTo)
    if (fi < 0 || ti < 0) return ALL_SVC_TIMES
    return ALL_SVC_TIMES.slice(fi, ti + 1)
  }
  const TIMES = getSvcTimes()

  if (!salon) return null

  const confirm = async () => {
    if (!agreed) { toast("⚠ يرجى الموافقة على الشروط"); return }
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('bookings').insert([{
      salon_id: salon.id || null,
      client_name: name,
      client_phone: phone,
      appointment_date: date,
      appointment_time: time,
      total_amount: svc ? svc.p : 0,
      deposit_amount: deposit,
      status: 'pending',
      user_id: session?.user?.id || null,
    }])
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    toast("✅ تم الحجز! سيصلكِ تأكيد على واتساب")
    setTimeout(() => setScreen("client-home"), 1500)
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
      {/* Header */}
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>{salon.name}</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>📍 {salon.city}، {salon.area}</div>
        </div>
      </div>

      <div style={{ padding:"16px 18px" }}>
        {/* Step indicators */}
        <div style={{ display:"flex", gap:6, marginBottom:22 }}>
          {["اختاري الخدمة","التاريخ والبيانات","تأكيد الحجز"].map((lbl, i) => (
            <div key={lbl} style={{ flex:1, textAlign:"center" }}>
              <div style={{ height:4, borderRadius:4, background:step>i ? T.roseDp : step===i+1 ? T.rose : T.creamDk, marginBottom:5, transition:"background .3s" }} />
              <div style={{ fontSize:10, color:step===i+1 ? T.roseDp : T.inkMuted, fontWeight:step===i+1 ? 700 : 400 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:14 }}>اختاري الخدمة</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:22 }}>
              {salon.services.map(sv => (
                <div key={sv.n} onClick={() => setSvc(sv)}
                  style={{ background:T.white, borderRadius:14, padding:"14px 16px", border:`2px solid ${svc && svc.n === sv.n ? T.roseDp : T.creamDk}`, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"all .2s" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{sv.n}</div>
                    {svc && svc.n === sv.n && <div style={{ fontSize:12, color:T.rose, marginTop:3 }}>عربون: {Math.round(sv.p * 0.3)} ر.س</div>}
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color:svc && svc.n === sv.n ? T.roseDp : T.gold }}>{sv.p} ر.س</div>
                </div>
              ))}
            </div>
            <PBtn full disabled={!svc} onClick={() => setStep(2)}>التالي ←</PBtn>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <Field label="التاريخ" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>الوقت <span style={{ color:T.rose }}>*</span></label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {TIMES.map(tm => (
                  <button key={tm} onClick={() => setTime(tm)}
                    style={{ padding:"10px 4px", borderRadius:10, border:`1.5px solid ${time === tm ? T.roseDp : T.creamDk}`, background:time === tm ? T.roseL : T.white, color:time === tm ? T.roseDp : T.ink, fontSize:12, fontWeight:time === tm ? 700 : 400, cursor:"pointer", fontFamily:"Tajawal,sans-serif", transition:"all .2s" }}>
                    {tm}
                  </button>
                ))}
              </div>
            </div>
            <Field label="الاسم الكامل" placeholder="مثال: نورة العتيبي" value={name} onChange={e => setName(e.target.value)} required />
            <Field label="رقم الجوال" type="tel" placeholder="05xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} required />
            <div style={{ display:"flex", gap:10 }}>
              <OBtn onClick={() => setStep(1)}>← رجوع</OBtn>
              <div style={{ flex:1 }}>
                <PBtn full disabled={!date || !time || !name || !phone} onClick={() => setStep(3)}>التالي ←</PBtn>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <Card style={{ padding:"16px", marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:12 }}>ملخص الحجز</div>
              {[
                ["الصالون", salon.name],
                ["الخدمة", svc ? svc.n : ""],
                ["التاريخ", date],
                ["الوقت", time],
                ["الاسم", name],
                ["الجوال", phone],
                ["السعر الكامل", (svc ? svc.p : 0) + " ر.س"],
              ].map(row => (
                <div key={row[0]} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.creamDk}`, fontSize:13 }}>
                  <span style={{ color:T.inkSoft }}>{row[0]}</span>
                  <span style={{ color:T.ink, fontWeight:600 }}>{row[1]}</span>
                </div>
              ))}
            </Card>
            <div style={{ background:T.goldPale, border:`1px solid ${T.goldL}`, borderRadius:14, padding:"14px 16px", marginBottom:14, display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ fontSize:26 }}>🔒</div>
              <div>
                <div style={{ fontSize:12, color:T.inkSoft }}>العربون المطلوب (30%)</div>
                <div style={{ fontSize:22, fontWeight:900, color:T.gold }}>{deposit} ريال</div>
                <div style={{ fontSize:11, color:T.inkSoft }}>غير مسترد عند الإلغاء</div>
              </div>
            </div>
            <label style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:13, color:T.inkSoft, lineHeight:1.6, marginBottom:18, cursor:"pointer" }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop:3, accentColor:T.roseDp }} />
              أوافق على{" "}
              <span onClick={e => { e.preventDefault(); e.stopPropagation(); setTermsOpen(true) }}
                style={{ color:T.roseDp, fontWeight:700, textDecoration:"underline", cursor:"pointer" }}>
                الشروط والأحكام
              </span>
              {" "}وسياسة العربون
            </label>
            <div style={{ display:"flex", gap:10 }}>
              <OBtn onClick={() => setStep(2)}>← رجوع</OBtn>
              <div style={{ flex:1 }}>
                <PBtn full onClick={confirm}>✓ تأكيد ودفع العربون</PBtn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   👤 CLIENT AUTH
══════════════════════════════════════════ */
function ClientRegister({ setScreen }) {
  const toast = useToast()
  const [form, setForm] = useState({ name:"", phone:"", email:"", pass:"", confirm:"" })
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))

  const submit = async () => {
    if (!form.name || !form.phone || !form.email || !form.pass) return toast("⚠ يرجى تعبئة جميع الحقول")
    if (form.pass !== form.confirm) return toast("⚠ كلمة المرور غير متطابقة")
    if (!agreed) return toast("⚠ يرجى الموافقة على الشروط")
    if (form.pass.length < 6) return toast("⚠ كلمة المرور 6 أحرف على الأقل")
    setLoading(true)
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.pass,
      options: { data: { role: "client", name: form.name } }
    })
    if (authError) { setLoading(false); toast("⚠ " + authError.message); return }
    await supabase.from('clients').insert([{ full_name: form.name, phone: form.phone, email: form.email }])
    setLoading(false)
    toast("✅ مرحباً بكِ! تم إنشاء حسابك 🌸")
    setScreen("client-home")
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>إنشاء حساب عميلة</div>
      </div>
      <div style={{ padding:"22px 18px" }}>
        <Field label="الاسم الكامل" placeholder="مثال: نورة العتيبي" value={form.name} onChange={set("name")} required />
        <Field label="رقم الجوال" type="tel" placeholder="05xxxxxxxx" value={form.phone} onChange={set("phone")} required />
        <Field label="البريد الإلكتروني" type="email" placeholder="example@email.com" value={form.email} onChange={set("email")} required />
        <Field label="كلمة المرور" type="password" placeholder="8 أحرف على الأقل" value={form.pass} onChange={set("pass")} required />
        <Field label="تأكيد كلمة المرور" type="password" placeholder="أعيدي الكتابة" value={form.confirm} onChange={set("confirm")} required />
        <label style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:13, color:T.inkSoft, lineHeight:1.6, marginBottom:22, cursor:"pointer" }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop:3, accentColor:T.roseDp }} />
          أوافق على{" "}
          <span onClick={e => { e.preventDefault(); e.stopPropagation(); setTermsOpen(true) }}
            style={{ color:T.roseDp, fontWeight:700, textDecoration:"underline", cursor:"pointer" }}>الشروط والأحكام</span>
        </label>
        <PBtn full disabled={loading} onClick={submit}>{loading ? "...جاري التسجيل" : "✓ إنشاء الحساب"}</PBtn>
        <div style={{ textAlign:"center", marginTop:18, fontSize:13, color:T.inkSoft }}>
          لديكِ حساب؟{" "}
          <span onClick={() => setScreen("client-login")} style={{ color:T.roseDp, fontWeight:700, cursor:"pointer" }}>تسجيل الدخول</span>
        </div>
      </div>
    </div>
  )
}

function ClientLogin({ setScreen }) {
  const toast = useToast()
  const [form, setForm] = useState({ emailOrPhone:"", pass:"" })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))

  const submit = async () => {
    if (!form.emailOrPhone || !form.pass) return toast("⚠ أدخلي البريد أو الجوال وكلمة المرور")
    setLoading(true)
    // تحديد هل الإدخال إيميل أو جوال
    let email = form.emailOrPhone
    if (!email.includes("@")) {
      // جوال — ابحث عن الإيميل في جدول clients
      const phone = email.replace(/\s/g, "")
      const { data: clientData } = await supabase.from('clients').select('email').eq('phone', phone)
      if (clientData && clientData.length > 0) {
        email = clientData[0].email
      } else {
        setLoading(false)
        toast("⚠ رقم الجوال غير مسجّل")
        return
      }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: form.pass })
    setLoading(false)
    if (error) { toast("⚠ البيانات غير صحيحة"); return }
    toast("✅ مرحباً بكِ! 🌸")
    setScreen("client-home")
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh" }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>تسجيل الدخول</div>
      </div>
      <div style={{ padding:"36px 18px" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:44, marginBottom:8 }}>💅</div>
          <p style={{ fontSize:14, color:T.inkSoft }}>أهلاً بعودتكِ 🌸</p>
        </div>
        <Field label="البريد الإلكتروني أو رقم الجوال" placeholder="example@email.com أو 05xxxxxxxx" value={form.emailOrPhone} onChange={set("emailOrPhone")} />
        <Field label="كلمة المرور" type="password" placeholder="••••••••" value={form.pass} onChange={set("pass")} />
        <div style={{ textAlign:"left", marginBottom:18 }}>
          <span style={{ fontSize:13, color:T.roseDp, fontWeight:600, cursor:"pointer" }}>نسيتِ كلمة المرور؟</span>
        </div>
        <PBtn full disabled={loading} onClick={submit}>{loading ? "..." : "دخول →"}</PBtn>
        <div style={{ textAlign:"center", marginTop:18, fontSize:13, color:T.inkSoft }}>
          ليس لديكِ حساب؟{" "}
          <span onClick={() => setScreen("client-register")} style={{ color:T.roseDp, fontWeight:700, cursor:"pointer" }}>إنشاء حساب جديد</span>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   🏪 OWNER REGISTER
══════════════════════════════════════════ */
const PKGS = [
  { id:"basic", name:"الأساسية", price:200, features:["حجوزات إلكترونية","عربون 30% آلي","ربط واتساب","تقارير مبيعات"], missing:["إدارة مخزون","بوت واتساب ذكي","دعم أولوية"] },
  { id:"pro", name:"التوسع", price:800, featured:true, features:["كل ما في الأساسية","إدارة مخزون ذكية","نقاط الولاء","بوت واتساب أساسي"], missing:["ربط ذكي للمخزون","دعم أولوية 24/7"] },
  { id:"elite", name:"النخبة", price:1500, features:["كل ما في التوسع","ربط ذكي للمخزون","تنبيهات إعادة الزيارة","عروض فورية","دعم أولوية 24/7","بوت واتساب ذكي كامل"], missing:[] },
]

function OwnerRegister({ setScreen }) {
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [pkg, setPkg] = useState("pro")
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [focusCity, setFocusCity] = useState(false)
  const [salonId, setSalonId] = useState(null)
  const [services, setServices] = useState([{ name:"", price:"" }])
  const [savingServices, setSavingServices] = useState(false)
  const [billing, setBilling] = useState("monthly")
  const [skipTrial, setSkipTrial] = useState(false)
  const [form, setForm] = useState({ name:"", owner:"", phone:"", email:"", city:"", pass:"", confirm:"" })
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))

  const next = async () => {
    if (!form.name || !form.owner || !form.phone || !form.email || !form.pass) return toast("⚠ يرجى تعبئة الحقول الإلزامية")
    if (form.pass !== form.confirm) return toast("⚠ كلمة المرور غير متطابقة")
    if (form.pass.length < 6) return toast("⚠ كلمة المرور 6 أحرف على الأقل")
    // تحقق من التجربة المجانية
    const { data: existing } = await supabase.from('salons').select('id').eq('email', form.email)
    if (existing && existing.length > 0) { toast("⚠ هذا الإيميل مسجّل مسبقاً — التجربة المجانية لمرة واحدة فقط"); return }
    const { data: existingPhone } = await supabase.from('salons').select('id').eq('phone', form.phone)
    if (existingPhone && existingPhone.length > 0) { toast("⚠ رقم الجوال مسجّل مسبقاً — التجربة المجانية لمرة واحدة فقط"); return }
    setStep(2)
  }

  const submit = async () => {
    if (!agreed) return toast("⚠ يرجى الموافقة على الشروط")
    setLoading(true)
    // إنشاء حساب Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.pass,
      options: { data: { role: "owner", name: form.owner } }
    })
    if (authError) { setLoading(false); toast("⚠ " + authError.message); return }
    // حفظ بيانات الصالون
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)
    const { data, error } = await supabase.from('salons').insert([{
      name: form.name,
      owner_name: form.owner,
      phone: form.phone,
      email: form.email,
      city: form.city,
      package: pkg,
      billing: billing,
      skip_trial: skipTrial,
      trial_end: skipTrial ? null : trialEnd.toISOString(),
    }]).select()
    setLoading(false)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    if (data && data[0]) setSalonId(data[0].id)
    setStep(3)
  }

  const addService = () => setServices(s => [...s, { name:"", price:"" }])
  const removeService = (i) => setServices(s => s.filter((_, j) => j !== i))
  const setServiceField = (i, k, v) => setServices(s => s.map((sv, j) => j === i ? { ...sv, [k]:v } : sv))

  const finishServices = async () => {
    const valid = services.filter(s => s.name && s.price)
    if (valid.length > 0 && salonId) {
      setSavingServices(true)
      await supabase.from('services').insert(valid.map(s => ({
        salon_id: salonId,
        name: s.name,
        price: Number(s.price),
        active: true,
        days: ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"],
        time_from: "09:00",
        time_to: "18:00",
      })))
      setSavingServices(false)
    }
    setStep(4)
  }

  if (step === 3) return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>أضيفي خدمات صالونك 💅</div>
      </div>
      <div style={{ padding:"20px 18px" }}>
        <div style={{ background:T.greenL, borderRadius:14, padding:"12px 16px", marginBottom:20, display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ fontSize:22 }}>✅</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.green }}>تم تسجيل الصالون!</div>
            <div style={{ fontSize:11, color:T.inkSoft }}>الآن أضيفي خدماتك لتظهر للعملاء</div>
          </div>
        </div>

        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:16 }}>الخدمات المقدّمة</div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {services.map((sv, i) => (
            <div key={i} style={{ background:T.white, borderRadius:14, padding:"14px", border:`1.5px solid ${T.creamDk}` }}>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <div style={{ flex:2 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:4 }}>اسم الخدمة</label>
                  <input value={sv.name} onChange={e => setServiceField(i, "name", e.target.value)}
                    placeholder="مثال: قص شعر"
                    style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:14, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:4 }}>السعر (ر.س)</label>
                  <input type="number" value={sv.price} onChange={e => setServiceField(i, "price", e.target.value)}
                    placeholder="150"
                    style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:14, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
                </div>
                {services.length > 1 && (
                  <button onClick={() => removeService(i)}
                    style={{ alignSelf:"flex-end", width:34, height:38, borderRadius:10, border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:16, cursor:"pointer", flexShrink:0 }}>✕</button>
                )}
              </div>
              {sv.name && sv.price && (
                <div style={{ fontSize:11, color:T.inkSoft }}>
                  عربون 30%: <span style={{ color:T.gold, fontWeight:700 }}>{Math.round(Number(sv.price)*0.3)} ر.س</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={addService}
          style={{ width:"100%", padding:"11px", borderRadius:12, border:`2px dashed ${T.roseL}`, background:T.white, color:T.roseDp, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif", marginBottom:20 }}>
          + إضافة خدمة أخرى
        </button>

        <PBtn full disabled={savingServices} onClick={finishServices}>
          {savingServices ? "...جاري الحفظ" : "✓ حفظ الخدمات والإنهاء"}
        </PBtn>
        <div style={{ textAlign:"center", marginTop:12 }}>
          <span onClick={() => setStep(4)} style={{ fontSize:13, color:T.inkSoft, cursor:"pointer" }}>تخطي لاحقاً ←</span>
        </div>
      </div>
    </div>
  )

  if (step === 4) return (
    <div style={{ background:T.cream, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", maxWidth:340 }}>
        <div style={{ fontSize:60, marginBottom:14 }}>🎉</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:T.ink, marginBottom:10 }}>صالونك جاهز!</h2>
        <div style={{ background:T.greenL, borderRadius:14, padding:"12px 16px", marginBottom:16, textAlign:"right" }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.green, marginBottom:4 }}>🎁 تجربة مجانية 14 يوم مفعّلة</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>مرة واحدة فقط لكل صالون</div>
        </div>
        <p style={{ fontSize:14, color:T.inkSoft, lineHeight:1.8, marginBottom:26 }}>
          سيتواصل فريقنا معكِ خلال 24 ساعة لإتمام إعداد الحساب ودفع رسوم التأسيس (600 ر.س).
        </p>
        <PBtn full onClick={() => setScreen("owner-login")}>الذهاب لتسجيل الدخول</PBtn>
      </div>
    </div>
  )

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={() => step === 1 ? setScreen("client-home") : setStep(1)} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>تسجيل صالون جديد</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>رسوم التأسيس 600 ر.س مرة واحدة</div>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {[1,2,3].map(s => <div key={s} style={{ width:20, height:4, borderRadius:4, background:step >= s ? T.roseDp : T.creamDk, transition:"background .3s" }} />)}
        </div>
      </div>

      <div style={{ padding:"20px 18px" }}>
        {step === 1 && (
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:16 }}>بيانات الصالون</div>
            <Field label="اسم الصالون" placeholder="مثال: صالون لوز" value={form.name} onChange={set("name")} required />
            <Field label="اسم المالكة" placeholder="الاسم الكامل" value={form.owner} onChange={set("owner")} required />
            <Field label="رقم الجوال" type="tel" placeholder="05xxxxxxxx" value={form.phone} onChange={set("phone")} required />
            <Field label="البريد الإلكتروني" type="email" placeholder="salon@email.com" value={form.email} onChange={set("email")} required />
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>المدينة</label>
              <select value={form.city} onChange={set("city")} onFocus={() => setFocusCity(true)} onBlur={() => setFocusCity(false)}
                style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${focusCity ? T.rose : T.creamDk}`, borderRadius:12, fontSize:14, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }}>
                <option value="">اختاري المدينة</option>
                {["الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام","الخبر","أبها","تبوك","القصيم"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <Field label="كلمة المرور" type="password" placeholder="8 أحرف على الأقل" value={form.pass} onChange={set("pass")} required />
            <Field label="تأكيد كلمة المرور" type="password" placeholder="أعيدي الكتابة" value={form.confirm} onChange={set("confirm")} required />
            <PBtn full onClick={next}>التالي — اختيار الباقة ←</PBtn>
            <div style={{ textAlign:"center", marginTop:14, fontSize:13, color:T.inkSoft }}>
              لديكِ حساب؟{" "}
              <span onClick={() => setScreen("owner-login")} style={{ color:T.gold, fontWeight:700, cursor:"pointer" }}>تسجيل الدخول</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            {/* Trial banner */}
            <div style={{ background:`linear-gradient(135deg,${T.roseDp},#7A4830)`, borderRadius:16, padding:"20px", marginBottom:20, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🎁</div>
              <div style={{ fontSize:18, fontWeight:900, color:T.white, marginBottom:6 }}>14 يوم مجاناً</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,.85)", lineHeight:1.7 }}>
                جربي المنصة كاملاً بدون أي رسوم<br />
                تجربة واحدة فقط لكل صالون
              </div>
            </div>

            {/* What's included */}
            <Card style={{ padding:"16px", marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:12 }}>ماذا تشمل التجربة؟</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  { icon:"📅", t:"حجوزات إلكترونية غير محدودة" },
                  { icon:"💰", t:"نظام العربون التلقائي 30%" },
                  { icon:"💬", t:"بوت واتساب كامل" },
                  { icon:"🧴", t:"إدارة المخزون الذكية" },
                  { icon:"📊", t:"تقارير المبيعات" },
                  { icon:"🌟", t:"كل مميزات باقة التوسع" },
                ].map(it => (
                  <div key={it.t} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:T.roseL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{it.icon}</div>
                    <div style={{ fontSize:13, color:T.ink, fontWeight:500 }}>{it.t}</div>
                    <span style={{ marginRight:"auto", color:T.green, fontWeight:800, fontSize:14 }}>✓</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* After trial — packages clickable */}
            <div style={{ background:T.cream, borderRadius:14, padding:"14px 16px", marginBottom:16, border:`1px solid ${T.creamDk}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.inkSoft, marginBottom:10 }}>بعد انتهاء التجربة — اختاري باقتك</div>
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                {PKGS.map(p => (
                  <div key={p.id}
                    onClick={() => setPkg(p.id)}
                    style={{
                      flex:1, background:pkg === p.id ? T.roseL : T.white,
                      borderRadius:10, padding:"10px 8px", textAlign:"center",
                      border:`2px solid ${pkg === p.id ? T.roseDp : p.featured ? T.gold : T.creamDk}`,
                      cursor:"pointer", transition:"all .2s"
                    }}>
                    <div style={{ fontSize:11, fontWeight:800, color:pkg === p.id ? T.roseDp : p.featured ? T.gold : T.inkSoft, marginBottom:4 }}>{p.name}</div>
                    <div style={{ fontSize:14, fontWeight:900, color:pkg === p.id ? T.roseDp : T.ink }}>{p.price.toLocaleString()}</div>
                    <div style={{ fontSize:10, color:T.inkSoft }}>ر.س/شهر</div>
                    {pkg === p.id && <div style={{ fontSize:10, color:T.roseDp, marginTop:3, fontWeight:700 }}>✓ محدد</div>}
                  </div>
                ))}
              </div>
              {/* خيار شهري / سنوي */}
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                {[
                  { id:"monthly", label:"شهري", sub:"ادفعي كل شهر" },
                  { id:"yearly",  label:"سنوي", sub:"شهر مجاني 🎁" },
                ].map(b => (
                  <div key={b.id}
                    onClick={() => setBilling(b.id)}
                    style={{ flex:1, padding:"10px 8px", borderRadius:10, textAlign:"center", border:`2px solid ${billing===b.id ? T.roseDp : T.creamDk}`, background:billing===b.id ? T.roseL : T.white, cursor:"pointer", transition:"all .2s" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:billing===b.id ? T.roseDp : T.ink }}>{b.label}</div>
                    <div style={{ fontSize:10, color:T.inkSoft }}>{b.sub}</div>
                    {b.id === "yearly" && billing === "yearly" && (
                      <div style={{ fontSize:10, color:T.green, fontWeight:700, marginTop:2 }}>
                        توفري {PKGS.find(p => p.id === pkg)?.price || 0} ر.س
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:T.inkSoft, textAlign:"center" }}>
                🎁 اشتراك سنوي = شهر مجاني (تدفع 11 شهراً)
              </div>
            </div>

            {/* خيار البدء بدون تجربة */}
            <div style={{ background:T.goldPale, borderRadius:12, padding:"12px 16px", marginBottom:16, border:`1px solid ${T.goldL}`, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:20 }}>⚡</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>تبين تبدأين الآن بدون تجربة؟</div>
                <div style={{ fontSize:11, color:T.inkSoft }}>ادفعي رسوم التأسيس (600 ر.س) وابدأي فوراً</div>
              </div>
              <button onClick={() => setSkipTrial(true)}
                style={{ padding:"7px 14px", borderRadius:20, border:"none", background:skipTrial ? T.gold : T.white, color:skipTrial ? T.white : T.gold, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif", border:`1px solid ${T.gold}` }}>
                {skipTrial ? "✓ محدد" : "اختاري"}
              </button>
            </div>

            {/* Terms */}
            <Card style={{ padding:"14px 16px", marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:10 }}>الشروط الرئيسية</div>
              {[
                "التجربة المجانية 14 يوم لكل صالون مرة واحدة فقط",
                "رسوم التأسيس 600 ر.س تُدفع بعد انتهاء التجربة عند الاشتراك",
                "العربون 30% غير مسترد عند إلغاء الحجز",
                "تعديل الموعد مرة واحدة قبل 24 ساعة",
              ].map((txt, i, a) => (
                <div key={i} style={{ fontSize:12, color:T.inkSoft, padding:"6px 0", borderBottom:i < a.length-1 ? `1px solid ${T.creamDk}` : "none", display:"flex", gap:8 }}>
                  <span style={{ color:T.roseDp, flexShrink:0 }}>•</span> {txt}
                </div>
              ))}
            </Card>

            <label style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:13, color:T.inkSoft, lineHeight:1.6, marginBottom:18, cursor:"pointer" }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop:3, accentColor:T.roseDp }} />
              أوافق على{" "}
              <span onClick={e => { e.preventDefault(); e.stopPropagation(); setTermsOpen(true) }}
                style={{ color:T.roseDp, fontWeight:700, textDecoration:"underline", cursor:"pointer" }}>الشروط والأحكام</span>
              {" "}وشروط التجربة المجانية
            </label>

            <PBtn full disabled={loading} onClick={submit}>
              {loading ? "...جاري التسجيل" : "🎁 ابدأي تجربتك المجانية — 14 يوم"}
            </PBtn>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   🔑 OWNER LOGIN
══════════════════════════════════════════ */
function OwnerLogin({ setScreen }) {
  const toast = useToast()
  const [form, setForm] = useState({ email:"", pass:"" })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))

  const submit = async () => {
    if (!form.email || !form.pass) return toast("⚠ أدخلي بيانات الدخول")
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.pass })
    setLoading(false)
    if (error) { toast("⚠ البريد أو كلمة المرور غير صحيحة"); return }
    toast("✅ أهلاً بكِ!")
    setScreen("owner-dashboard")
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh" }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>دخول المالكة</div>
      </div>
      <div style={{ padding:"40px 18px" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>✦</div>
          <h1 style={{ fontSize:20, fontWeight:900, color:T.ink, marginBottom:4 }}>لوحة تحكم صالونك</h1>
          <p style={{ fontSize:13, color:T.inkSoft }}>بانتظارك 🌸</p>
        </div>
        <Field label="البريد الإلكتروني" type="email" placeholder="salon@email.com" value={form.email} onChange={set("email")} />
        <Field label="كلمة المرور" type="password" placeholder="••••••••" value={form.pass} onChange={set("pass")} />
        <div style={{ textAlign:"left", marginBottom:18 }}>
          <span style={{ fontSize:13, color:T.roseDp, fontWeight:600, cursor:"pointer" }}>نسيتِ كلمة المرور؟</span>
        </div>
        <PBtn full disabled={loading} onClick={submit}>{loading ? "..." : "دخول لوحة التحكم →"}</PBtn>
        <div style={{ textAlign:"center", marginTop:18, fontSize:13, color:T.inkSoft }}>
          ليس لديكِ حساب؟{" "}
          <span onClick={() => setScreen("owner-register")} style={{ color:T.gold, fontWeight:700, cursor:"pointer" }}>سجّلي صالونك الآن</span>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   📊 OWNER DASHBOARD
══════════════════════════════════════════ */
const OWN_TABS = [
  { id:"overview",  icon:"📊", label:"نظرة عامة" },
  { id:"bookings",  icon:"📅", label:"الحجوزات" },
  { id:"services",  icon:"✂️",  label:"الخدمات" },
  { id:"inventory", icon:"🧴", label:"المخزون" },
  { id:"whatsapp",  icon:"💬", label:"بوت واتساب" },
  { id:"package",   icon:"📦", label:"باقتي" },
  { id:"settings",  icon:"⚙️",  label:"الإعدادات" },
]

function OwnerDashboard({ setScreen }) {
  const toast = useToast()
  const [tab, setTab] = useState("overview")
  const [salonInfo, setSalonInfo] = useState({ name:"...", trial_end:null })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('salons').select('name,trial_end,city').eq('email', session.user.email).then(({ data }) => {
        if (data && data[0]) setSalonInfo(data[0])
      })
    })
  }, [])

  const daysLeft = salonInfo.trial_end
    ? Math.max(0, Math.ceil((new Date(salonInfo.trial_end) - new Date()) / (1000*60*60*24)))
    : 14

  return (
    <div style={{ background:T.cream, minHeight:"100vh" }}>
      {/* Top bar */}
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>💅</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{salonInfo.name}</div>
            <div style={{ fontSize:11, color:T.roseDp, fontWeight:700 }}>🎁 تجربة مجانية — باقي {daysLeft} يوم</div>
          </div>
        </div>
        <button onClick={() => { toast("👋 تم تسجيل الخروج"); setScreen("owner-login") }}
          style={{ padding:"7px 14px", borderRadius:50, border:`1px solid ${T.roseL}`, background:T.white, color:T.inkSoft, fontSize:12, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
          خروج
        </button>
      </div>

      {/* Trial progress bar */}
      <div style={{ background:"linear-gradient(135deg,#FFF8F5,#FFF3E8)", borderBottom:`1px solid ${T.roseL}`, padding:"10px 18px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.roseDp }}>🎁 تجربة مجانية — 14 يوم</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>مضى {14 - daysLeft} يوم من 14</div>
        </div>
        <div style={{ background:T.roseL, borderRadius:50, height:6, overflow:"hidden" }}>
          <div style={{ width:`${((14-daysLeft)/14)*100}%`, height:"100%", borderRadius:50, background:`linear-gradient(90deg,${T.rose},${T.roseDp})`, transition:"width .3s" }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:6 }}>
          <div style={{ fontSize:11, color:T.inkSoft }}>باقي {daysLeft} يوم على انتهاء التجربة</div>
          <button onClick={() => toast("💳 تواصلي معنا على واتساب 0552401658 للاشتراك")}
            style={{ fontSize:11, fontWeight:700, color:T.white, background:T.roseDp, border:"none", padding:"4px 12px", borderRadius:20, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
            اشتركي الآن
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", overflowX:"auto", background:T.white, borderBottom:`1px solid ${T.creamDk}`, padding:"0 4px" }}>
        {OWN_TABS.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            style={{ padding:"10px 14px", border:"none", borderBottom:`3px solid ${tab === n.id ? T.roseDp : "transparent"}`, background:"transparent", cursor:"pointer", fontSize:11, fontWeight:tab === n.id ? 700 : 400, color:tab === n.id ? T.roseDp : T.inkSoft, whiteSpace:"nowrap", fontFamily:"Tajawal,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", gap:3, flexShrink:0 }}>
            <span style={{ fontSize:18 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:"18px 16px" }}>
        {tab === "overview"  && <OwnerOverview />}
        {tab === "bookings"  && <OwnerBookings />}
        {tab === "services"  && <OwnerServices toast={toast} />}
        {tab === "inventory" && <OwnerInventory toast={toast} />}
        {tab === "whatsapp"  && <OwnerWhatsapp toast={toast} />}
        {tab === "settings"  && <OwnerSettings toast={toast} />}
        {tab === "package"   && <OwnerPackage toast={toast} />}
      </div>
    </div>
  )
}


function OwnerBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("active")
  const toast = useToast()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      // جلب بيانات الصالون أولاً
      const { data: salonData } = await supabase.from('salons').select('id').eq('email', session.user.email)
      if (!salonData || salonData.length === 0) { setLoading(false); return }
      const salonId = salonData[0].id
      const { data } = await supabase.from('bookings')
        .select('*')
        .eq('salon_id', salonId)
        .order('appointment_date', { ascending: true })
      setBookings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const updateStatus = async (id, status) => {
    await supabase.from('bookings').update({ status }).eq('id', id)
    setBookings(b => b.map(bk => bk.id === id ? { ...bk, status } : bk))
    toast(status === "completed" ? "✅ تم تحديد الحجز كمكتمل" : "تم إلغاء الحجز")
  }

  const filtered = bookings.filter(b => {
    if (tab === "active")    return b.status === "pending" || b.status === "confirmed"
    if (tab === "done")      return b.status === "completed"
    if (tab === "cancelled") return b.status === "cancelled"
    return true
  })

  const STATUS = {
    pending:   { label:"قيد الانتظار", color:T.gold,    bg:T.goldPale },
    confirmed: { label:"مؤكد",         color:T.green,   bg:T.greenL },
    completed: { label:"مكتمل",        color:T.inkSoft, bg:T.creamDk },
    cancelled: { label:"ملغي",         color:T.red,     bg:T.redL },
  }

  return (
    <div>
      <div style={{ display:"flex", background:T.white, borderRadius:12, overflow:"hidden", marginBottom:14, border:`1px solid ${T.creamDk}` }}>
        {[
          { id:"active",    label:"الفعّالة",  icon:"🟢", count: bookings.filter(b => b.status==="pending"||b.status==="confirmed").length },
          { id:"done",      label:"المكتملة",  icon:"✅", count: bookings.filter(b => b.status==="completed").length },
          { id:"cancelled", label:"الملغية",   icon:"❌", count: bookings.filter(b => b.status==="cancelled").length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"10px 8px", border:"none", borderBottom:`3px solid ${tab===t.id ? T.roseDp : "transparent"}`, background:"transparent", cursor:"pointer", fontSize:11, fontWeight:tab===t.id ? 700 : 400, color:tab===t.id ? T.roseDp : T.inkSoft, fontFamily:"Tajawal,sans-serif" }}>
            {t.icon} {t.label} {t.count > 0 && <span style={{ background:tab===t.id?T.roseDp:T.creamDk, color:tab===t.id?T.white:T.inkSoft, borderRadius:"50%", padding:"1px 6px", fontSize:10, marginRight:3 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:"center", padding:40, color:T.inkSoft }}>...جاري التحميل</div>}
      {!loading && filtered.length === 0 && <Empty icon="📅" title="لا توجد حجوزات" desc="ستظهر هنا فور بدء الاستقبال" />}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map(bk => {
          const st = STATUS[bk.status] || STATUS.pending
          return (
            <Card key={bk.id} style={{ padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{bk.client_name}</div>
                <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{st.label}</span>
              </div>
              <div style={{ fontSize:12, color:T.inkSoft, marginBottom:8 }}>
                📞 {bk.client_phone} · 📅 {bk.appointment_date} · ⏰ {bk.appointment_time}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:10 }}>
                <span style={{ color:T.inkSoft }}>المبلغ: <span style={{ color:T.ink, fontWeight:700 }}>{bk.total_amount} ر.س</span></span>
                <span style={{ color:T.inkSoft }}>العربون: <span style={{ color:T.gold, fontWeight:700 }}>{bk.deposit_amount} ر.س</span></span>
              </div>
              {(bk.status === "pending" || bk.status === "confirmed") && (
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => updateStatus(bk.id, "completed")}
                    style={{ flex:1, padding:"8px", borderRadius:10, border:"none", background:T.greenL, color:T.green, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ✅ مكتمل
                  </button>
                  <button onClick={() => updateStatus(bk.id, "cancelled")}
                    style={{ flex:1, padding:"8px", borderRadius:10, border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ❌ إلغاء
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}


function OwnerRecentBookings({ stats }) {
  const [bookings, setBookings] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: salon } = await supabase.from('salons').select('id').eq('email', session.user.email)
      if (!salon || !salon[0]) { setLoading(false); return }
      const { data } = await supabase.from('bookings').select('*').eq('salon_id', salon[0].id).order('created_at', { ascending:false }).limit(10)
      setBookings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ textAlign:"center", padding:20, color:T.inkSoft }}>...</div>
  if (bookings.length === 0) return <Empty icon="📅" title="لا توجد حجوزات حتى الآن" desc="ستظهر هنا فور بدء الاستقبال" />

  const STATUS = {
    pending:   { label:"انتظار", color:T.gold, bg:T.goldPale },
    confirmed: { label:"مؤكد",   color:T.green, bg:T.greenL },
    completed: { label:"مكتمل", color:T.inkSoft, bg:T.creamDk },
    cancelled: { label:"ملغي",  color:T.red, bg:T.redL },
  }

  return (
    <div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {bookings.map(bk => {
          const st = STATUS[bk.status] || STATUS.pending
          return (
            <div key={bk.id}>
              <div onClick={() => setSelected(selected===bk.id ? null : bk.id)}
                style={{ background:T.cream, borderRadius:10, padding:"10px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{bk.client_name}</div>
                  <div style={{ fontSize:11, color:T.inkSoft }}>{bk.appointment_date} · {bk.appointment_time}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>{st.label}</span>
                  <span style={{ fontSize:11, color:T.inkMuted }}>{selected===bk.id ? "▲" : "▼"}</span>
                </div>
              </div>
              {selected === bk.id && (
                <div style={{ background:T.white, borderRadius:10, padding:"12px 14px", marginTop:4, border:`1px solid ${T.creamDk}` }}>
                  {[
                    ["👤 العميلة", bk.client_name],
                    ["📞 الجوال", bk.client_phone],
                    ["📅 التاريخ", bk.appointment_date],
                    ["⏰ الوقت", bk.appointment_time],
                    ["💰 المبلغ الكامل", (bk.total_amount||0) + " ر.س"],
                    ["🔒 العربون", (bk.deposit_amount||0) + " ر.س"],
                    ["📊 الحالة", STATUS[bk.status]?.label || bk.status],
                  ].map(r => (
                    <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:`1px solid ${T.creamDk}` }}>
                      <span style={{ color:T.inkSoft }}>{r[0]}</span>
                      <span style={{ color:T.ink, fontWeight:600 }}>{r[1]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OwnerOverview() {
  const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو"]
  const BARS = [70,85,60,90,75,100]
  const [ownerStats, setOwnerStats] = useState({ revenue:0, todayBookings:0, totalBookings:0, clients:0 })

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: salon } = await supabase.from('salons').select('id').eq('email', session.user.email)
      if (!salon || !salon[0]) return
      const salonId = salon[0].id
      const today = new Date().toISOString().split('T')[0]
      const { data: bookings } = await supabase.from('bookings').select('*').eq('salon_id', salonId)
      if (bookings) {
        const todayB = bookings.filter(b => b.appointment_date === today).length
        const revenue = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.total_amount || 0), 0)
        const clients = new Set(bookings.map(b => b.client_phone)).size
        setOwnerStats({ revenue, todayBookings: todayB, totalBookings: bookings.length, clients })
      }
    }
    load()
  }, [])

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        {[
          { l:"إيرادات الشهر", v: ownerStats.revenue + " ر.س", s: ownerStats.revenue > 0 ? "من الحجوزات" : "لا توجد بيانات", gold:true },
          { l:"حجوزات اليوم",  v: ownerStats.todayBookings, s: ownerStats.todayBookings > 0 ? "حجز اليوم" : "لا توجد حجوزات" },
          { l:"إجمالي الحجوزات", v: ownerStats.totalBookings, s:"كل الحجوزات" },
          { l:"عملاء",    v: ownerStats.clients, s:"مسجلين" },
        ].map(st => (
          <Card key={st.l} style={{ padding:14, background:st.gold ? `linear-gradient(135deg,${T.gold},${T.gold2})` : T.white }}>
            <div style={{ fontSize:11, color:st.gold ? "rgba(255,255,255,.8)" : T.inkSoft, marginBottom:5, fontWeight:600 }}>{st.l}</div>
            <div style={{ fontSize:24, fontWeight:900, color:st.gold ? T.white : T.ink }}>{st.v}</div>
            <div style={{ fontSize:11, color:st.gold ? "rgba(255,255,255,.7)" : T.rose, marginTop:3 }}>{st.s}</div>
          </Card>
        ))}
      </div>
      <Card style={{ padding:16, marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:14 }}>المبيعات — آخر 6 أشهر</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:110 }}>
          {MONTHS.map((m, i) => (
            <div key={m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
              <div style={{ width:"100%", height:`${BARS[i]}%`, borderRadius:"5px 5px 0 0", background:i === 5 ? `linear-gradient(${T.rose},${T.roseDp})` : T.roseL }} />
              <div style={{ fontSize:9, color:T.inkSoft }}>{m}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ padding:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>آخر الحجوزات</div>
          <span style={{ fontSize:10, background:T.roseL, color:T.roseDp, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>🔴 مباشر</span>
        </div>
        <OwnerRecentBookings stats={ownerStats} />
      </Card>
    </div>
  )
}

function OwnerInventory({ toast }) {
  const [items, setItems] = useState([
    { id:1, n:"صبغة لوريال #5",  pct:72, total:500, used:140, unit:"مل", alert:false },
    { id:2, n:"أسيتون مزيل ورنيش", pct:20, total:500, used:400, unit:"مل", alert:true  },
    { id:3, n:"كيراتين برازيلي", pct:55, total:1000, used:450, unit:"مل", alert:false },
    { id:4, n:"كريم مرطب شعر", pct:88, total:500, used:60, unit:"مل", alert:false },
  ])
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ n:"", total:"", unit:"مل" })
  const [focusF, setFocusF] = useState(null)

  const addItem = () => {
    if (!newItem.n || !newItem.total) { toast("⚠ أدخلي اسم المنتج والكمية"); return }
    setItems(i => [...i, { id:Date.now(), n:newItem.n, pct:100, total:Number(newItem.total), used:0, unit:newItem.unit, alert:false }])
    setNewItem({ n:"", total:"", unit:"مل" })
    setShowAdd(false)
    toast("✅ تمت إضافة المنتج!")
  }

  const useItem = (id, amount) => {
    setItems(i => i.map(item => {
      if (item.id !== id) return item
      const newUsed = Math.min(item.used + amount, item.total)
      const pct = Math.round(((item.total - newUsed) / item.total) * 100)
      return { ...item, used: newUsed, pct, alert: pct < 25 }
    }))
  }

  const inp = (k) => ({
    width:"100%", padding:"10px 12px",
    border:`1.5px solid ${focusF===k ? T.rose : T.creamDk}`,
    borderRadius:10, fontSize:14, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif",
  })

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>إدارة المخزون</div>
          <div style={{ fontSize:11, color:T.inkSoft, marginTop:2 }}>تتبع المواد المستخدمة</div>
        </div>
        <PBtn sm onClick={() => setShowAdd(!showAdd)}>+ إضافة</PBtn>
      </div>

      {showAdd && (
        <Card style={{ padding:16, marginBottom:14, border:`2px solid ${T.roseL}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:12 }}>منتج جديد</div>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>اسم المنتج *</label>
            <input value={newItem.n} onChange={e => setNewItem(i => ({ ...i, n:e.target.value }))}
              placeholder="مثال: صبغة لوريال" onFocus={() => setFocusF("n")} onBlur={() => setFocusF(null)} style={inp("n")} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>الكمية الكلية *</label>
              <input type="number" value={newItem.total} onChange={e => setNewItem(i => ({ ...i, total:e.target.value }))}
                placeholder="500" onFocus={() => setFocusF("t")} onBlur={() => setFocusF(null)} style={inp("t")} />
            </div>
            <div>
              <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>الوحدة</label>
              <select value={newItem.unit} onChange={e => setNewItem(i => ({ ...i, unit:e.target.value }))}
                style={{ ...inp("u"), cursor:"pointer" }}>
                {["مل","غرام","كغ","قطعة","علبة"].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <OBtn onClick={() => setShowAdd(false)}>إلغاء</OBtn>
            <div style={{ flex:1 }}><PBtn full onClick={addItem}>✓ إضافة</PBtn></div>
          </div>
        </Card>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {items.map(item => (
          <Card key={item.id} style={{ padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{item.n}</div>
              <button onClick={() => setItems(i => i.filter(x => x.id !== item.id))}
                style={{ width:24, height:24, borderRadius:"50%", border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:12, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ background:T.creamDk, borderRadius:4, height:6, overflow:"hidden", margin:"8px 0" }}>
              <div style={{ height:"100%", borderRadius:4, width:item.pct + "%", background:item.alert ? `linear-gradient(90deg,#E87070,${T.red})` : `linear-gradient(90deg,${T.rose},${T.roseDp})` }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:8 }}>
              {item.alert
                ? <span style={{ color:T.red, fontWeight:700 }}>⚠ {item.pct}% — اطلبي الآن!</span>
                : <span style={{ color:T.inkSoft }}>{item.pct}% متبقي</span>}
              <span style={{ color:T.inkSoft }}>{item.total - item.used}/{item.total} {item.unit}</span>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {[10,25,50].map(amt => (
                <button key={amt} onClick={() => useItem(item.id, amt)}
                  style={{ flex:1, padding:"6px", borderRadius:8, border:`1px solid ${T.creamDk}`, background:T.cream, color:T.inkSoft, fontSize:11, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  -{amt} {item.unit}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   💬 WHATSAPP BOT
══════════════════════════════════════════ */
function OwnerWhatsapp({ toast }) {
  const [waNum,     setWaNum]     = useState("")
  const [salonName, setSalonName] = useState("")
  const [bookLink,  setBookLink]  = useState("")
  const [saved,     setSaved]     = useState(false)
  const [activeMsg, setActiveMsg] = useState(null)
  const [editId,    setEditId]    = useState(null)
  const [editText,  setEditText]  = useState("")
  const [focusF,    setFocusF]    = useState(null)

  const DEFAULT_MSGS = [
    { id:"confirm",  icon:"✅", title:"تأكيد الحجز",         trigger:"عند كل حجز جديد",            color:"#25A050", colorL:T.greenL,
      text:"أهلاً بكِ 🌸 تم تأكيد حجزك في {اسم_الصالون}\nالموعد: {التاريخ} — {الوقت}\nالخدمة: {الخدمة}\nالعربون: {العربون} ر.س\nنراكِ قريباً! 💅" },
    { id:"reminder", icon:"⏰", title:"تذكير قبل 3 ساعات",   trigger:"تلقائي قبل الموعد بـ 3 ساعات", color:T.gold, colorL:T.goldPale,
      text:"تذكير لطيف 🌸\nموعدك في {اسم_الصالون} بعد 3 ساعات\nالوقت: {الوقت}\nالخدمة: {الخدمة}\nهل أنتِ مستعدة؟ ✨" },
    { id:"revisit",  icon:"💌", title:"تنبيه إعادة الزيارة", trigger:"بعد 30 يوم من آخر زيارة",     color:T.roseDp, colorL:T.roseL,
      text:"وحشتينا! 🌸\nمضى وقت على آخر زيارتك.\nاحجزي موعدك: {رابط_الحجز}" },
    { id:"cancel",   icon:"❌", title:"تأكيد الإلغاء",        trigger:"عند إلغاء أي حجز",            color:T.red, colorL:T.redL,
      text:"تم إلغاء حجزك في {اسم_الصالون}.\nالعربون 30% غير مسترد وفق سياستنا.\nنتطلع لرؤيتك! 🌸" },
    { id:"welcome",  icon:"👋", title:"رد آلي على الرسائل",  trigger:"على أي رسالة واردة",          color:T.inkSoft, colorL:T.creamDk,
      text:"أهلاً! 🌸 أنتِ تتواصلين مع {اسم_الصالون}.\nللحجز: {رابط_الحجز}\nأو تواصلي معنا مباشرة." },
  ]
  const [msgs, setMsgs] = useState(DEFAULT_MSGS)

  const preview = (text) => text
    .replace(/{اسم_الصالون}/g, salonName || "اسم الصالون")
    .replace(/{رابط_الحجز}/g,  bookLink  || "beautytech.sa/book")
    .replace(/{التاريخ}/g,  "الخميس ١٩ يونيو")
    .replace(/{الوقت}/g,    "٢:٣٠ م")
    .replace(/{الخدمة}/g,   "قص شعر")
    .replace(/{العربون}/g,  "٤٥")

  const handleSave = () => {
    if (!waNum || waNum.length < 9) return toast("⚠ أدخلي رقم واتساب صحيح")
    if (!salonName) return toast("⚠ أدخلي اسم الصالون")
    setSaved(true)
    toast("✅ تم تفعيل بوت واتساب الصالون!")
  }

  const inpStyle = (k) => ({
    width:"100%", padding:"12px 14px",
    border:`1.5px solid ${focusF === k ? T.rose : saved ? T.green : T.creamDk}`,
    borderRadius:12, fontSize:14, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif", transition:"border-color .2s",
  })

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>بوت واتساب الذكي</div>
        <div style={{ fontSize:11, color:T.inkSoft, marginTop:3 }}>كل صالون له بوت مستقل برقمه الخاص — ليس رقم المنصة</div>
      </div>

      {/* Setup */}
      <Card style={{ padding:16, marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", background:T.waL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>💬</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>إعداد رقم الصالون</div>
            <div style={{ fontSize:11, color:T.inkSoft }}>البوت يُرسل من رقمك أنتِ</div>
          </div>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>رقم واتساب بزنس <span style={{ color:T.rose }}>*</span></label>
          <input type="tel" placeholder="05xxxxxxxx" value={waNum}
            onChange={e => { setWaNum(e.target.value); setSaved(false) }}
            onFocus={() => setFocusF("wa")} onBlur={() => setFocusF(null)}
            style={inpStyle("wa")} />
          <div style={{ fontSize:10, color:T.inkSoft, marginTop:4 }}>يجب أن يكون مفعّلاً على WhatsApp Business</div>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>اسم الصالون في الرسائل <span style={{ color:T.rose }}>*</span></label>
          <input type="text" placeholder="مثال: صالون لوز" value={salonName}
            onChange={e => { setSalonName(e.target.value); setSaved(false) }}
            onFocus={() => setFocusF("nm")} onBlur={() => setFocusF(null)}
            style={inpStyle("nm")} />
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>رابط الحجز (اختياري)</label>
          <input type="url" placeholder="beautytech.sa/book/salon" value={bookLink}
            onChange={e => { setBookLink(e.target.value); setSaved(false) }}
            onFocus={() => setFocusF("lk")} onBlur={() => setFocusF(null)}
            style={inpStyle("lk")} />
        </div>
        <button onClick={handleSave}
          style={{ width:"100%", padding:13, borderRadius:50, border:"none", background:saved ? `linear-gradient(135deg,${T.green},#1A8040)` : `linear-gradient(135deg,${T.roseDp},#7A4830)`, color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif", transition:"all .3s" }}>
          {saved ? "✓ البوت مفعّل ويعمل 🎉" : "⚡ تفعيل البوت"}
        </button>
        {saved && (
          <div style={{ marginTop:10, background:T.greenL, borderRadius:10, padding:"10px 14px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.green, marginBottom:5 }}>{"✅ يُرسل من رقم: " + waNum}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {["تأكيد الحجز","تذكير ٣ ساعات","إعادة الزيارة","رد آلي"].map(f => (
                <span key={f} style={{ fontSize:11, color:T.green }}>{"✓ " + f}</span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Messages */}
      <Card style={{ padding:16, marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:4 }}>🤖 رسائل البوت</div>
        <div style={{ fontSize:11, color:T.inkSoft, marginBottom:14 }}>اضغطي لمعاينة أو تعديل كل رسالة</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {msgs.map(msg => (
            <div key={msg.id} style={{ borderRadius:12, border:`1.5px solid ${activeMsg === msg.id ? msg.color : T.creamDk}`, background:activeMsg === msg.id ? msg.colorL : T.white, overflow:"hidden", transition:"all .2s" }}>
              <div onClick={() => { setActiveMsg(activeMsg === msg.id ? null : msg.id); setEditId(null) }}
                style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                <div style={{ width:34, height:34, borderRadius:"50%", background:msg.colorL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{msg.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{msg.title}</div>
                  <div style={{ fontSize:11, color:msg.color, marginTop:2 }}>{msg.trigger}</div>
                </div>
                <span style={{ fontSize:11, color:T.inkMuted, display:"inline-block", transform:activeMsg === msg.id ? "rotate(180deg)" : "rotate(0)", transition:"transform .2s" }}>▼</span>
              </div>

              {activeMsg === msg.id && (
                <div style={{ borderTop:`1px solid ${T.creamDk}`, padding:"12px 14px" }}>
                  {/* WA preview */}
                  <div style={{ background:"#ECE5DD", borderRadius:12, padding:"10px 10px", marginBottom:12 }}>
                    <div style={{ background:"#fff", borderRadius:"12px 12px 4px 12px", padding:"10px 12px", fontSize:12, color:"#1A3A25", lineHeight:1.75, whiteSpace:"pre-line", maxWidth:"90%", marginRight:"auto", boxShadow:"0 1px 4px rgba(0,0,0,.1)" }}>
                      {preview(editId === msg.id ? editText : msg.text)}
                      <div style={{ textAlign:"left", fontSize:10, color:"#999", marginTop:5 }}>
                        {new Date().toLocaleTimeString("ar", { hour:"2-digit", minute:"2-digit" })}
                        {" "}<span style={{ color:"#4FC3F7" }}>✓✓</span>
                      </div>
                    </div>
                    <div style={{ fontSize:10, color:"#888", textAlign:"center", marginTop:6 }}>{"يُرسل من: " + (waNum || "05xxxxxxxx")}</div>
                  </div>

                  {editId === msg.id ? (
                    <div>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4}
                        style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.rose}`, borderRadius:10, fontSize:12, color:T.ink, background:T.white, outline:"none", resize:"none", lineHeight:1.7, fontFamily:"Tajawal,sans-serif", marginBottom:6 }} />
                      <div style={{ fontSize:10, color:T.inkMuted, marginBottom:8 }}>
                        المتغيرات: {"{اسم_الصالون} {رابط_الحجز} {التاريخ} {الوقت} {الخدمة} {العربون}"}
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => { setMsgs(ms => ms.map(m => m.id === editId ? { ...m, text:editText } : m)); setEditId(null); toast("✅ تم حفظ الرسالة") }}
                          style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:T.roseDp, color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif", fontSize:12 }}>
                          ✓ حفظ
                        </button>
                        <button onClick={() => setEditId(null)}
                          style={{ padding:"9px 14px", borderRadius:10, border:`1px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, cursor:"pointer", fontFamily:"Tajawal,sans-serif", fontSize:12 }}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setEditId(msg.id); setEditText(msg.text) }}
                      style={{ width:"100%", padding:"9px", borderRadius:10, border:`1.5px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif", fontSize:12 }}>
                      ✏️ تعديل نص الرسالة
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Info */}
      <Card style={{ padding:16 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:12 }}>⚙️ كيف يعمل البوت؟</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { icon:"📱", t:"رقمك أنتِ",   d:"البوت يُرسل من رقم صالونك — ليس رقم المنصة" },
            { icon:"🔗", t:"ربط تلقائي",  d:"كل حجز جديد يُطلق رسالة تأكيد فورية" },
            { icon:"⏱️", t:"توقيت ذكي",   d:"التذكيرات تُرسل تلقائياً بدون تدخل منكِ" },
            { icon:"✏️", t:"نصوص مخصصة", d:"كل رسالة قابلة للتعديل بأسلوبك" },
          ].map(it => (
            <div key={it.t} style={{ background:T.cream, borderRadius:10, padding:"12px", display:"flex", gap:8, alignItems:"flex-start" }}>
              <div style={{ fontSize:18, flexShrink:0 }}>{it.icon}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:T.ink, marginBottom:3 }}>{it.t}</div>
                <div style={{ fontSize:11, color:T.inkSoft, lineHeight:1.5 }}>{it.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, background:T.goldPale, borderRadius:10, padding:"10px 14px", fontSize:11, color:T.inkSoft, lineHeight:1.7, border:`1px solid ${T.goldL}` }}>
          {"💡 "}
          <strong style={{ color:T.ink }}>ملاحظة:</strong>
          {" كل صالون مستقل تماماً — لا توجد رسائل مشتركة بين الصالونات."}
        </div>
      </Card>
    </div>
  )
}


/* ══════════════════════════════════════════
   ⏰ OWNER SERVICES — مع الأوقات المتاحة
══════════════════════════════════════════ */
const DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]
const ALL_TIMES = ["00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30","05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"]

function OwnerServices({ toast }) {
  const [services, setServices] = useState([
    { id:1, name:"قص شعر", price:150, duration:45, active:true,
      days:["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"],
      timeFrom:"09:00", timeTo:"18:00" },
    { id:2, name:"صبغ كامل", price:380, duration:120, active:true,
      days:["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"],
      timeFrom:"09:00", timeTo:"16:00" },
  ])
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editSvc, setEditSvc] = useState(null)
  const [newSvc, setNewSvc] = useState({ name:"", price:"", duration:60, days:["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"], timeFrom:"09:00", timeTo:"18:00" })
  const [focusF, setFocusF] = useState(null)

  const startEdit = (sv) => {
    setEditId(sv.id)
    setEditSvc({ name:sv.name, price:sv.price, duration:sv.duration, days:sv.days, timeFrom:sv.timeFrom, timeTo:sv.timeTo })
  }

  const saveEdit = () => {
    if (!editSvc.name || !editSvc.price) { toast("⚠ أدخلي اسم الخدمة والسعر"); return }
    setServices(s => s.map(sv => sv.id === editId ? { ...sv, ...editSvc, price:Number(editSvc.price) } : sv))
    setEditId(null)
    setEditSvc(null)
    toast("✅ تم تعديل الخدمة!")
  }

  const inp = (k) => ({
    padding:"10px 12px", border:`1.5px solid ${focusF===k ? T.rose : T.creamDk}`,
    borderRadius:10, fontSize:14, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif", transition:"border-color .2s",
  })

  const toggleDay = (day) => {
    setNewSvc(s => ({
      ...s,
      days: s.days.includes(day) ? s.days.filter(d => d !== day) : [...s.days, day]
    }))
  }

  const addService = async () => {
    if (!newSvc.name || !newSvc.price) { toast("⚠ أدخلي اسم الخدمة والسعر"); return }
    if (newSvc.days.length === 0) { toast("⚠ اختاري يوم واحد على الأقل"); return }
    const newItem = { id:Date.now(), ...newSvc, price:Number(newSvc.price), active:true }
    setServices(s => [...s, newItem])
    await supabase.from('services').insert([{
      name: newSvc.name,
      price: Number(newSvc.price),
      duration: newSvc.duration,
      days: newSvc.days,
      time_from: newSvc.timeFrom,
      time_to: newSvc.timeTo,
      active: true,
    }])
    setNewSvc({ name:"", price:"", duration:60, days:["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"], timeFrom:"09:00", timeTo:"18:00" })
    setShowAdd(false)
    toast("✅ تمت إضافة الخدمة!")
  }

  const toggleActive = (id) => {
    setServices(s => s.map(sv => sv.id === id ? { ...sv, active:!sv.active } : sv))
  }

  const deleteService = (id) => {
    setServices(s => s.filter(sv => sv.id !== id))
    toast("🗑 تم حذف الخدمة")
  }

  // حساب الأوقات المتاحة بين from و to
  const getAvailableTimes = (from, to) => {
    const fi = ALL_TIMES.indexOf(from)
    const ti = ALL_TIMES.indexOf(to)
    if (fi < 0 || ti < 0 || fi >= ti) return []
    return ALL_TIMES.slice(fi, ti + 1)
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:T.ink }}>الخدمات وأوقاتها</div>
          <div style={{ fontSize:11, color:T.inkSoft, marginTop:2 }}>حددي أيام وأوقات كل خدمة</div>
        </div>
        <PBtn sm onClick={() => setShowAdd(!showAdd)}>+ إضافة خدمة</PBtn>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card style={{ padding:18, marginBottom:16, border:`2px solid ${T.roseL}` }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:14 }}>خدمة جديدة</div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>اسم الخدمة *</label>
              <input value={newSvc.name} onChange={e => setNewSvc(s => ({ ...s, name:e.target.value }))}
                placeholder="مثال: قص شعر" onFocus={() => setFocusF("nm")} onBlur={() => setFocusF(null)}
                style={{ ...inp("nm"), width:"100%" }} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>السعر (ر.س) *</label>
              <input type="number" value={newSvc.price} onChange={e => setNewSvc(s => ({ ...s, price:e.target.value }))}
                placeholder="150" onFocus={() => setFocusF("pr")} onBlur={() => setFocusF(null)}
                style={{ ...inp("pr"), width:"100%" }} />
            </div>
          </div>

          {/* Duration */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:8 }}>مدة الخدمة</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[30,45,60,90,120,150,180].map(d => (
                <button key={d} onClick={() => setNewSvc(s => ({ ...s, duration:d }))}
                  style={{ padding:"7px 14px", borderRadius:20, border:`1.5px solid ${newSvc.duration===d ? T.roseDp : T.creamDk}`, background:newSvc.duration===d ? T.roseL : T.white, color:newSvc.duration===d ? T.roseDp : T.ink, fontSize:12, fontWeight:newSvc.duration===d ? 700 : 400, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {d < 60 ? d+"د" : (d/60)+"س"}
                </button>
              ))}
            </div>
          </div>

          {/* Days */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:8 }}>أيام العمل *</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {DAYS.map(day => (
                <button key={day} onClick={() => toggleDay(day)}
                  style={{ padding:"7px 12px", borderRadius:20, border:`1.5px solid ${newSvc.days.includes(day) ? T.roseDp : T.creamDk}`, background:newSvc.days.includes(day) ? T.roseL : T.white, color:newSvc.days.includes(day) ? T.roseDp : T.ink, fontSize:12, fontWeight:newSvc.days.includes(day) ? 700 : 400, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:8 }}>ساعات العمل لهذه الخدمة</label>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:T.inkSoft, marginBottom:4 }}>من</div>
                <select value={newSvc.timeFrom} onChange={e => setNewSvc(s => ({ ...s, timeFrom:e.target.value }))}
                  style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }}>
                  {ALL_TIMES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ fontSize:16, color:T.inkSoft, marginTop:16 }}>←</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:T.inkSoft, marginBottom:4 }}>إلى</div>
                <select value={newSvc.timeTo} onChange={e => setNewSvc(s => ({ ...s, timeTo:e.target.value }))}
                  style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }}>
                  {ALL_TIMES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {/* Preview available times */}
            <div style={{ marginTop:10, background:T.cream, borderRadius:10, padding:"10px 14px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.inkSoft, marginBottom:6 }}>الأوقات المتاحة للحجز:</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {getAvailableTimes(newSvc.timeFrom, newSvc.timeTo).map(t => (
                  <span key={t} style={{ background:T.roseL, color:T.roseDp, fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20 }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <OBtn onClick={() => setShowAdd(false)}>إلغاء</OBtn>
            <div style={{ flex:1 }}><PBtn full onClick={addService}>✓ إضافة الخدمة</PBtn></div>
          </div>
        </Card>
      )}

      {/* Services list */}
      {services.length === 0 && <Empty icon="✂️" title="لا توجد خدمات" desc="أضيفي خدماتكِ لتظهر للعملاء" />}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {services.map(sv => (
          <Card key={sv.id} style={{ padding:16, opacity:sv.active ? 1 : .6, transition:"opacity .2s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>{sv.name}</div>
                  {!sv.active && <span style={{ fontSize:10, background:T.redL, color:T.red, padding:"2px 8px", borderRadius:10, fontWeight:700 }}>متوقفة</span>}
                </div>
                <div style={{ display:"flex", gap:12, fontSize:12, color:T.inkSoft }}>
                  <span style={{ color:T.gold, fontWeight:700, fontSize:14 }}>{sv.price} ر.س</span>
                  <span>⏱ {sv.duration < 60 ? sv.duration+"د" : (sv.duration/60)+"س"}</span>
                  <span style={{ color:T.green, fontWeight:600 }}>🔒 عربون: {Math.round(sv.price*.3)} ر.س</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => toggleActive(sv.id)}
                  style={{ padding:"5px 10px", borderRadius:20, border:`1px solid ${sv.active ? T.green : T.creamDk}`, background:sv.active ? T.greenL : T.cream, color:sv.active ? T.green : T.inkSoft, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {sv.active ? "✓ فعّالة" : "متوقفة"}
                </button>
                <button onClick={() => startEdit(sv)}
                  style={{ width:30, height:30, borderRadius:"50%", border:`1px solid ${T.goldL}`, background:T.goldPale, color:T.gold, fontSize:14, cursor:"pointer" }}>
                  ✏
                </button>
                <button onClick={() => deleteService(sv.id)}
                  style={{ width:30, height:30, borderRadius:"50%", border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:14, cursor:"pointer" }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Days */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
              {sv.days.map(d => (
                <span key={d} style={{ background:T.goldPale, color:T.gold, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20 }}>{d}</span>
              ))}
            </div>

            {/* Available times */}
            <div style={{ background:T.cream, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.inkSoft, marginBottom:6 }}>
                ⏰ الأوقات المتاحة ({sv.timeFrom} — {sv.timeTo})
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, direction:"ltr" }}>
                {getAvailableTimes(sv.timeFrom, sv.timeTo).map(t => (
                  <span key={t} style={{ background:T.white, border:`1px solid ${T.roseL}`, color:T.roseDp, fontSize:10, fontWeight:600, padding:"4px 10px", borderRadius:20, cursor:"default" }}>{t}</span>
                ))}
              </div>
            </div>

            {/* نموذج التعديل */}
            {editId === sv.id && editSvc && (
              <div style={{ marginTop:12, background:T.roseL, borderRadius:12, padding:"14px" }}>
                <div style={{ fontSize:13, fontWeight:800, color:T.roseDp, marginBottom:10 }}>✏ تعديل الخدمة</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>اسم الخدمة</label>
                    <input value={editSvc.name} onChange={e => setEditSvc(s => ({ ...s, name:e.target.value }))}
                      style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${T.rose}`, borderRadius:8, fontSize:13, color:T.ink, background:T.white, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>السعر (ر.س)</label>
                    <input type="number" value={editSvc.price} onChange={e => setEditSvc(s => ({ ...s, price:e.target.value }))}
                      style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${T.rose}`, borderRadius:8, fontSize:13, color:T.ink, background:T.white, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:6 }}>الأيام</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {DAYS.map(d => (
                      <button key={d} onClick={() => setEditSvc(s => ({ ...s, days: s.days.includes(d) ? s.days.filter(x => x!==d) : [...s.days, d] }))}
                        style={{ padding:"4px 10px", borderRadius:20, border:`1.5px solid ${editSvc.days.includes(d) ? T.roseDp : T.creamDk}`, background:editSvc.days.includes(d) ? T.white : "transparent", color:editSvc.days.includes(d) ? T.roseDp : T.inkSoft, fontSize:11, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                  <div>
                    <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>من</label>
                    <select value={editSvc.timeFrom} onChange={e => setEditSvc(s => ({ ...s, timeFrom:e.target.value }))}
                      style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${T.rose}`, borderRadius:8, fontSize:13, color:T.ink, background:T.white, outline:"none", fontFamily:"Tajawal,sans-serif" }}>
                      {ALL_TIMES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>إلى</label>
                    <select value={editSvc.timeTo} onChange={e => setEditSvc(s => ({ ...s, timeTo:e.target.value }))}
                      style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${T.rose}`, borderRadius:8, fontSize:13, color:T.ink, background:T.white, outline:"none", fontFamily:"Tajawal,sans-serif" }}>
                      {ALL_TIMES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => { setEditId(null); setEditSvc(null) }}
                    style={{ flex:1, padding:"9px", borderRadius:10, border:`1px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:12, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    إلغاء
                  </button>
                  <button onClick={saveEdit}
                    style={{ flex:2, padding:"9px", borderRadius:10, border:"none", background:T.roseDp, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ✓ حفظ التعديل
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   ⚙️ OWNER SETTINGS
══════════════════════════════════════════ */

function OwnerPackage({ toast }) {
  const [currentPkg, setCurrentPkg] = useState("pro")
  const [billing, setBilling] = useState("monthly")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('salons').select('package,billing').eq('email', session.user.email).then(({ data }) => {
        if (data && data[0]) {
          setCurrentPkg(data[0].package || "pro")
          setBilling(data[0].billing || "monthly")
        }
      })
    })
  }, [])

  const changePkg = async (newPkg) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('salons').update({ package: newPkg }).eq('email', session.user.email)
    setCurrentPkg(newPkg)
    toast("✅ تم تغيير الباقة — سيتم التفعيل بعد الدفع")
  }

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:6 }}>باقتي الحالية</div>
      <div style={{ fontSize:12, color:T.inkSoft, marginBottom:20 }}>يمكنكِ تغيير الباقة في أي وقت</div>

      {/* الباقة الحالية */}
      <div style={{ background:`linear-gradient(135deg,${T.roseDp},#7A4830)`, borderRadius:16, padding:"16px", marginBottom:20, textAlign:"center" }}>
        <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginBottom:4 }}>باقتك الحالية</div>
        <div style={{ fontSize:22, fontWeight:900, color:T.white }}>
          {PKGS.find(p => p.id === currentPkg)?.name || "التوسع"}
        </div>
        <div style={{ fontSize:14, color:"rgba(255,255,255,.8)", marginTop:4 }}>
          {PKGS.find(p => p.id === currentPkg)?.price?.toLocaleString()} ر.س/{billing === "yearly" ? "سنة" : "شهر"}
        </div>
      </div>

      {/* خيار شهري/سنوي */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[
          { id:"monthly", label:"شهري", sub:"ادفعي كل شهر" },
          { id:"yearly",  label:"سنوي", sub:"شهر مجاني 🎁" },
        ].map(b => (
          <div key={b.id} onClick={() => setBilling(b.id)}
            style={{ flex:1, padding:"12px", borderRadius:12, textAlign:"center", border:`2px solid ${billing===b.id ? T.roseDp : T.creamDk}`, background:billing===b.id ? T.roseL : T.white, cursor:"pointer" }}>
            <div style={{ fontSize:14, fontWeight:800, color:billing===b.id ? T.roseDp : T.ink }}>{b.label}</div>
            <div style={{ fontSize:11, color:T.inkSoft }}>{b.sub}</div>
          </div>
        ))}
      </div>

      {/* الباقات */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {PKGS.map(p => (
          <div key={p.id} onClick={() => changePkg(p.id)}
            style={{ background:T.white, borderRadius:14, padding:"14px 16px", border:`2px solid ${currentPkg===p.id ? T.roseDp : p.featured ? T.gold : T.creamDk}`, cursor:"pointer", transition:"all .2s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{p.name}</div>
                <div style={{ fontSize:13, color:T.roseDp, fontWeight:700 }}>
                  {billing === "yearly" ? (p.price * 11).toLocaleString() : p.price.toLocaleString()} ر.س/{billing === "yearly" ? "سنة" : "شهر"}
                </div>
              </div>
              {currentPkg === p.id
                ? <span style={{ background:T.roseL, color:T.roseDp, fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>✓ باقتك الحالية</span>
                : <span style={{ background:T.creamDk, color:T.inkSoft, fontSize:11, fontWeight:600, padding:"4px 12px", borderRadius:20 }}>اختاري</span>
              }
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {p.features.slice(0,3).map(f => <span key={f} style={{ fontSize:11, color:T.green }}>✓ {f}</span>)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:16, background:T.goldPale, borderRadius:12, padding:"12px 16px", fontSize:12, color:T.inkSoft, lineHeight:1.7, border:`1px solid ${T.goldL}` }}>
        💡 لتغيير الباقة أو الدفع تواصلي معنا على واتساب:<br />
        <strong style={{ color:T.ink }}>0552401658</strong>
      </div>
    </div>
  )
}

function OwnerSettings({ toast }) {
  const [form, setForm] = useState({ salonName:"", ownerName:"", phone:"", email:"", city:"", bio:"", wa:"", insta:"", mapUrl:"" })
  const [photos, setPhotos] = useState([])
  const [focusF, setFocusF] = useState(null)
  const [saving, setSaving] = useState(false)
  const [salonId, setSalonId] = useState(null)
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))

  // جلب بيانات الصالون عند الفتح
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('salons').select('*').eq('email', session.user.email).then(({ data }) => {
        if (data && data[0]) {
          const s = data[0]
          setSalonId(s.id)
          setForm({
            salonName: s.name || "",
            ownerName: s.owner_name || "",
            phone: s.phone || "",
            email: s.email || "",
            city: s.city || "",
            bio: s.bio || "",
            wa: s.phone || "",
            insta: s.insta || "",
            mapUrl: s.map_url || "",
          })
        }
      })
    })
  }, [])

  const saveSettings = async () => {
    if (!salonId) { toast("⚠ لم يتم العثور على الصالون"); return }
    setSaving(true)
    const { error } = await supabase.from('salons').update({
      name: form.salonName,
      owner_name: form.ownerName,
      phone: form.phone,
      city: form.city,
      bio: form.bio,
      insta: form.insta,
      map_url: form.mapUrl,
    }).eq('id', salonId)
    setSaving(false)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    toast("✅ تم حفظ إعدادات الصالون!")
  }

  const inp = (k) => ({
    width:"100%", padding:"12px 14px",
    border:`1.5px solid ${focusF===k ? T.rose : T.creamDk}`,
    borderRadius:12, fontSize:14, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif", transition:"border-color .2s",
  })

  return (
    <div>
      <div style={{ fontSize:17, fontWeight:800, color:T.ink, marginBottom:18 }}>إعدادات الصالون</div>

      {/* Basic info */}
      <Card style={{ padding:18, marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:14 }}>المعلومات الأساسية</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>اسم الصالون</label>
            <input value={form.salonName} onChange={set("salonName")} placeholder="صالون لوز" onFocus={() => setFocusF("sn")} onBlur={() => setFocusF(null)} style={inp("sn")} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>اسم المالكة</label>
            <input value={form.ownerName} onChange={set("ownerName")} placeholder="الاسم الكامل" onFocus={() => setFocusF("on")} onBlur={() => setFocusF(null)} style={inp("on")} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>رقم الجوال</label>
            <input value={form.phone} onChange={set("phone")} placeholder="05xxxxxxxx" onFocus={() => setFocusF("ph")} onBlur={() => setFocusF(null)} style={inp("ph")} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>البريد الإلكتروني</label>
            <input value={form.email} onChange={set("email")} placeholder="salon@email.com" onFocus={() => setFocusF("em")} onBlur={() => setFocusF(null)} style={inp("em")} />
          </div>
        </div>
        <div style={{ marginTop:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>نبذة عن الصالون</label>
          <textarea value={form.bio} onChange={set("bio")} placeholder="اكتبي نبذة قصيرة تظهر للعملاء..." rows={3}
            onFocus={() => setFocusF("bi")} onBlur={() => setFocusF(null)}
            style={{ ...inp("bi"), resize:"none", lineHeight:1.6 }} />
        </div>
      </Card>

      {/* Social */}
      <Card style={{ padding:18, marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:14 }}>التواصل الاجتماعي</div>
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>💬 واتساب البزنس</label>
          <input value={form.wa} onChange={set("wa")} placeholder="05xxxxxxxx" onFocus={() => setFocusF("wa")} onBlur={() => setFocusF(null)} style={inp("wa")} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>📷 إنستغرام (اختياري)</label>
          <input value={form.insta} onChange={set("insta")} placeholder="@salon_name" onFocus={() => setFocusF("ig")} onBlur={() => setFocusF(null)} style={inp("ig")} />
        </div>
        <div style={{ marginTop:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>📍 رابط قوقل ماب (اختياري)</label>
          <input value={form.mapUrl} onChange={set("mapUrl")} placeholder="https://maps.google.com/..." onFocus={() => setFocusF("mp")} onBlur={() => setFocusF(null)} style={inp("mp")} />
          <div style={{ fontSize:11, color:T.inkSoft, marginTop:4 }}>افتحي موقعك في قوقل ماب ← Share ← Copy Link</div>
        </div>
      </Card>

      {/* Photos */}
      <Card style={{ padding:18, marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:6 }}>صور الصالون</div>
        <div style={{ fontSize:12, color:T.inkSoft, marginBottom:14 }}>أضيفي صوراً للصالون وأعمالكِ — تظهر للعملاء</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
          {photos.map((p,i) => (
            <div key={i} style={{ aspectRatio:"1", background:T.roseL, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, position:"relative" }}>
              🖼
              <button onClick={() => setPhotos(ph => ph.filter((_,j) => j !== i))}
                style={{ position:"absolute", top:4, left:4, width:20, height:20, borderRadius:"50%", background:T.red, border:"none", color:"#fff", fontSize:10, cursor:"pointer" }}>✕</button>
            </div>
          ))}
          <button onClick={() => { setPhotos(p => [...p, "new"]); toast("📷 رفع الصور سيتوفر بعد ربط Supabase") }}
            style={{ aspectRatio:"1", background:T.cream, borderRadius:10, border:`2px dashed ${T.roseL}`, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
            <span style={{ fontSize:22 }}>+</span>
            <span style={{ fontSize:10, color:T.inkSoft }}>إضافة صورة</span>
          </button>
        </div>
      </Card>

      <PBtn full disabled={saving} onClick={saveSettings}>{saving ? "...جاري الحفظ" : "✓ حفظ التغييرات"}</PBtn>
    </div>
  )
}

/* ══════════════════════════════════════════
   💳 PAYMENT PAGE — Moyasar placeholder
══════════════════════════════════════════ */
function PaymentPage({ amount, salonName, serviceName, onSuccess, onCancel }) {
  const toast = useToast()
  const [method, setMethod] = useState("mada")
  const [card, setCard] = useState({ num:"", exp:"", cvv:"", name:"" })
  const [loading, setLoading] = useState(false)
  const [focusF, setFocusF] = useState(null)

  const inp = (k) => ({
    width:"100%", padding:"13px 14px",
    border:`1.5px solid ${focusF===k ? T.rose : T.creamDk}`,
    borderRadius:12, fontSize:15, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif", transition:"border-color .2s",
  })

  const pay = () => {
    if (method === "card" && (!card.num || !card.exp || !card.cvv || !card.name)) {
      toast("⚠ أكملي بيانات البطاقة"); return
    }
    setLoading(true)
    setTimeout(() => { setLoading(false); onSuccess() }, 2000)
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onCancel} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>دفع العربون</div>
      </div>

      <div style={{ padding:"20px 18px" }}>
        {/* Summary */}
        <Card style={{ padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:10 }}>ملخص الدفع</div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
            <span style={{ color:T.inkSoft }}>الصالون</span>
            <span style={{ fontWeight:600 }}>{salonName}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
            <span style={{ color:T.inkSoft }}>الخدمة</span>
            <span style={{ fontWeight:600 }}>{serviceName}</span>
          </div>
          <div style={{ height:1, background:T.creamDk, margin:"10px 0" }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:14, fontWeight:700, color:T.ink }}>العربون (30%)</span>
            <span style={{ fontSize:22, fontWeight:900, color:T.gold }}>{amount} ر.س</span>
          </div>
          <div style={{ fontSize:11, color:T.inkSoft, marginTop:4, textAlign:"left" }}>يُخصم من الفاتورة النهائية عند الحضور</div>
        </Card>

        {/* Payment methods */}
        <Card style={{ padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:12 }}>طريقة الدفع</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            {[
              { id:"mada", label:"مدى", icon:"💳", desc:"بطاقة مدى السعودية" },
              { id:"apple", label:"Apple Pay", icon:"🍎", desc:"ادفعي ببصمتك" },
              { id:"card", label:"فيزا / ماستر", icon:"💳", desc:"بطاقة ائتمانية" },
            ].map(m => (
              <div key={m.id} onClick={() => setMethod(m.id)}
                style={{ padding:"12px 14px", borderRadius:12, border:`2px solid ${method===m.id ? T.roseDp : T.creamDk}`, background:method===m.id ? T.roseL : T.white, cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"all .2s" }}>
                <span style={{ fontSize:22 }}>{m.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{m.label}</div>
                  <div style={{ fontSize:11, color:T.inkSoft }}>{m.desc}</div>
                </div>
                <div style={{ width:20, height:20, borderRadius:"50%", border:`2px solid ${method===m.id ? T.roseDp : T.creamDk}`, background:method===m.id ? T.roseDp : "transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {method===m.id && <div style={{ width:8, height:8, borderRadius:"50%", background:T.white }} />}
                </div>
              </div>
            ))}
          </div>

          {method === "card" && (
            <div>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>رقم البطاقة</label>
                <input value={card.num} onChange={e => setCard(c => ({ ...c, num:e.target.value }))}
                  placeholder="xxxx xxxx xxxx xxxx" maxLength={19}
                  onFocus={() => setFocusF("cn")} onBlur={() => setFocusF(null)}
                  style={inp("cn")} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>تاريخ الانتهاء</label>
                  <input value={card.exp} onChange={e => setCard(c => ({ ...c, exp:e.target.value }))}
                    placeholder="MM/YY" maxLength={5}
                    onFocus={() => setFocusF("ex")} onBlur={() => setFocusF(null)}
                    style={inp("ex")} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>CVV</label>
                  <input value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv:e.target.value }))}
                    placeholder="xxx" maxLength={4} type="password"
                    onFocus={() => setFocusF("cv")} onBlur={() => setFocusF(null)}
                    style={inp("cv")} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>اسم حامل البطاقة</label>
                <input value={card.name} onChange={e => setCard(c => ({ ...c, name:e.target.value }))}
                  placeholder="الاسم كما على البطاقة"
                  onFocus={() => setFocusF("cn2")} onBlur={() => setFocusF(null)}
                  style={inp("cn2")} />
              </div>
            </div>
          )}

          {method === "apple" && (
            <div style={{ background:T.ink, borderRadius:12, padding:"14px", textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🍎</div>
              <div style={{ fontSize:13, color:T.white, fontWeight:600 }}>سيتوفر Apple Pay بعد ربط Moyasar</div>
            </div>
          )}
        </Card>

        {/* Moyasar note */}
        <div style={{ background:T.goldPale, borderRadius:12, padding:"12px 14px", marginBottom:16, fontSize:11, color:T.inkSoft, lineHeight:1.7, border:`1px solid ${T.goldL}` }}>
          🔒 <strong style={{ color:T.ink }}>دفع آمن عبر Moyasar</strong> — جميع معاملاتك محمية بتشفير SSL
        </div>

        <PBtn full disabled={loading} onClick={pay}>
          {loading ? "...جاري المعالجة" : "✓ ادفعي " + amount + " ر.س الآن"}
        </PBtn>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   📖 ABOUT PAGE
══════════════════════════════════════════ */
function AboutPage({ setScreen }) {
  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>عن بيوتي تيك</div>
      </div>

      <div style={{ background:`linear-gradient(145deg,${T.roseL},${T.goldPale})`, padding:"40px 20px", textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:12 }}>🌸</div>
        <h1 style={{ fontSize:26, fontWeight:900, color:T.ink, marginBottom:8 }}>بيوتي تيك</h1>
        <p style={{ fontSize:14, color:T.inkSoft, lineHeight:1.8 }}>منصة تقنية سعودية متكاملة لإدارة صالونات التجميل</p>
      </div>

      <div style={{ padding:"24px 18px" }}>
        <Card style={{ padding:20, marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:10 }}>🎯 رؤيتنا</div>
          <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.9 }}>
            نؤمن بأن كل سيدة تستحق تجربة حجز سهلة وموثوقة، وكل صاحبة صالون تستحق أدوات تقنية احترافية تساعدها على النمو وإدارة أعمالها بكفاءة.
          </p>
        </Card>

        <Card style={{ padding:20, marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:14 }}>✨ ما نقدمه</div>
          {[
            { icon:"📅", t:"حجوزات إلكترونية", d:"نظام حجز ذكي يمنع التضارب ويضمن حقوق الطرفين" },
            { icon:"💰", t:"عربون مضمون", d:"30% يُدفع مسبقاً لضمان الحجز ويُخصم من الفاتورة" },
            { icon:"🤖", t:"بوت واتساب", d:"تأكيدات وتذكيرات تلقائية من رقم الصالون مباشرة" },
            { icon:"📊", t:"تقارير ذكية", d:"إحصائيات المبيعات والعملاء في متناول يدكِ" },
          ].map(it => (
            <div key={it.t} style={{ display:"flex", gap:12, marginBottom:12, padding:"10px 12px", background:T.cream, borderRadius:10 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:T.roseL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{it.icon}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:3 }}>{it.t}</div>
                <div style={{ fontSize:12, color:T.inkSoft, lineHeight:1.6 }}>{it.d}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card style={{ padding:20, marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:10 }}>🏆 أرقامنا</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[
              { n:"١٤ يوم", l:"تجربة مجانية" },
              { n:"٢٪",    l:"عمولة فقط" },
              { n:"٢٤/٧",  l:"دعم فني" },
              { n:"١٠٠٪",  l:"سعودي" },
            ].map(s => (
              <div key={s.l} style={{ background:T.roseL, borderRadius:12, padding:"14px", textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:900, color:T.roseDp }}>{s.n}</div>
                <div style={{ fontSize:12, color:T.inkSoft, marginTop:4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>

        <PBtn full gold onClick={() => setScreen("owner-register")}>✦ انضمي كصالون الآن</PBtn>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   📞 CONTACT PAGE
══════════════════════════════════════════ */
function ContactPage({ setScreen }) {
  const toast = useToast()
  const [msg, setMsg] = useState("")
  const [name, setName] = useState("")
  const [focusF, setFocusF] = useState(null)

  const inp = (k) => ({
    width:"100%", padding:"12px 14px",
    border:`1.5px solid ${focusF===k ? T.rose : T.creamDk}`,
    borderRadius:12, fontSize:14, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif", transition:"border-color .2s",
  })

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>تواصل معنا</div>
      </div>

      <div style={{ padding:"24px 18px" }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>💬</div>
          <div style={{ fontSize:18, fontWeight:800, color:T.ink, marginBottom:6 }}>نحن هنا لمساعدتك</div>
          <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.7 }}>فريقنا متاح على مدار الساعة</p>
        </div>

        {/* Contact options */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
          {[
            { icon:"💬", title:"واتساب", desc:"تواصل مباشر مع الدعم", action:"wa.me/9660552401658", color:T.waL, tcolor:"#25A050" },
            { icon:"📧", title:"البريد الإلكتروني", desc:"beauty.techn5@gmail.com", action:"mailto:beauty.techn5@gmail.com", color:T.roseL, tcolor:T.roseDp },
            { icon:"📷", title:"إنستغرام", desc:"@beautytech_sa", action:"https://instagram.com/beautytech_sa", color:T.goldPale, tcolor:T.gold },
            { icon:"🎵", title:"تيك توك", desc:"@beautytech_sa", action:"https://tiktok.com/@beautytech_sa", color:"#E8F0FF", tcolor:"#4A4AFF" },
          ].map(it => (
            <a key={it.title} href={it.action} target="_blank" rel="noreferrer"
              style={{ background:T.white, borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, textDecoration:"none", border:`1px solid ${T.creamDk}`, transition:"all .2s" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:it.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{it.icon}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{it.title}</div>
                <div style={{ fontSize:12, color:it.tcolor, fontWeight:600 }}>{it.desc}</div>
              </div>
              <span style={{ marginRight:"auto", color:T.inkMuted, fontSize:16 }}>←</span>
            </a>
          ))}
        </div>

        {/* Message form */}
        <Card style={{ padding:18 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:14 }}>أرسلي رسالة</div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>اسمك</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الكامل"
              onFocus={() => setFocusF("nm")} onBlur={() => setFocusF(null)} style={inp("nm")} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:5 }}>رسالتك</label>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="اكتبي رسالتك هنا..." rows={4}
              onFocus={() => setFocusF("ms")} onBlur={() => setFocusF(null)}
              style={{ ...inp("ms"), resize:"none", lineHeight:1.6 }} />
          </div>
          <PBtn full onClick={() => { if (!name || !msg) { toast("⚠ أكملي البيانات"); return } toast("✅ تم إرسال رسالتك! سنرد خلال 24 ساعة") }}>
            إرسال الرسالة ←
          </PBtn>
        </Card>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   ❓ FAQ PAGE
══════════════════════════════════════════ */
function FAQPage({ setScreen }) {
  const [open, setOpen] = useState(null)

  const FAQS = [
    { cat:"للعميلة", items:[
      { q:"كيف أحجز موعداً؟", a:"ابحثي عن الصالون المناسب، اختاري الخدمة والموعد، ثم ادفعي العربون (30%) لتأكيد الحجز. ستصلك رسالة تأكيد على واتساب." },
      { q:"ما هو العربون وهل يُسترد؟", a:"العربون هو 30% من قيمة الخدمة يُدفع عند الحجز لضمان الموعد. العربون غير مسترد عند الإلغاء، لكنه يُخصم من فاتورتك النهائية عند الحضور." },
      { q:"هل يمكنني تعديل موعدي؟", a:"نعم، يمكنك تعديل الموعد مرة واحدة فقط، شرط أن يكون التعديل قبل 24 ساعة من الموعد الأصلي." },
      { q:"كيف أدفع الباقي؟", a:"تدفعين الـ 70% المتبقية مباشرة في الصالون بعد انتهاء الخدمة نقداً أو بالبطاقة." },
    ]},
    { cat:"للصالونات", items:[
      { q:"كم تبلغ رسوم التأسيس؟", a:"رسوم التأسيس 600 ريال تُدفع مرة واحدة فقط عند الاشتراك، وهي تشمل إعداد حسابك وربط جميع الأنظمة." },
      { q:"هل يوجد تجربة مجانية؟", a:"نعم! كل صالون يحصل على 14 يوم تجربة مجانية كاملة تشمل جميع مميزات باقة التوسع، بدون أي رسوم." },
      { q:"كيف أستلم مبالغ العربون؟", a:"تحصلين على 98% من العربون (نحن نأخذ 2% فقط كعمولة). تُحوَّل المبالغ لحسابك البنكي خلال 48 ساعة." },
      { q:"هل أحتاج واتساب بزنس؟", a:"نعم، ننصح بتفعيل WhatsApp Business على رقم الصالون ليعمل البوت التلقائي للتأكيدات والتذكيرات." },
    ]},
  ]

  let qIdx = 0

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>الأسئلة الشائعة</div>
      </div>

      <div style={{ padding:"20px 18px" }}>
        {FAQS.map(section => (
          <div key={section.cat} style={{ marginBottom:24 }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.gold, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ height:1, flex:1, background:T.goldL }} />
              {section.cat}
              <div style={{ height:1, flex:1, background:T.goldL }} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {section.items.map(item => {
                const i = qIdx++
                return (
                  <Card key={i} style={{ overflow:"hidden" }}>
                    <div onClick={() => setOpen(open===i ? null : i)}
                      style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:T.ink, flex:1, paddingLeft:10 }}>{item.q}</div>
                      <span style={{ fontSize:12, color:T.inkMuted, transform:open===i?"rotate(180deg)":"rotate(0)", transition:"transform .2s", flexShrink:0 }}>▼</span>
                    </div>
                    {open===i && (
                      <div style={{ padding:"0 16px 14px", borderTop:`1px solid ${T.creamDk}`, paddingTop:12 }}>
                        <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.8 }}>{item.a}</p>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   🔒 PRIVACY PAGE
══════════════════════════════════════════ */
function PrivacyPage({ setScreen }) {
  const items = [
    { t:"١. البيانات التي نجمعها", b:"نجمع الاسم، رقم الجوال، البريد الإلكتروني، وبيانات الحجوزات الضرورية لتقديم الخدمة. لا نجمع أي بيانات إضافية." },
    { t:"٢. كيف نستخدم بياناتك", b:"نستخدم بياناتك لتأكيد الحجوزات، وإرسال التذكيرات، وتحسين تجربتك. لا نستخدمها لأغراض تسويقية دون إذنك." },
    { t:"٣. مشاركة البيانات", b:"لا نشارك بياناتك مع أطراف ثالثة إلا لضرورة تقديم الخدمة (مثل بوابة الدفع). جميع الشركاء ملتزمون بسياسات الخصوصية." },
    { t:"٤. أمان البيانات", b:"نستخدم تشفير SSL لحماية جميع البيانات المنقولة. كلمات المرور مشفرة ولا يمكن لأحد الاطلاع عليها." },
    { t:"٥. حقوقك", b:"يحق لكِ في أي وقت طلب عرض بياناتك أو تعديلها أو حذفها بالكامل من المنصة. تواصلي معنا عبر beauty.techn5@gmail.com" },
    { t:"٦. ملفات الكوكيز", b:"نستخدم ملفات كوكيز ضرورية فقط لتشغيل الموقع. لا نستخدم كوكيز التتبع أو الإعلانات." },
  ]
  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>سياسة الخصوصية</div>
      </div>
      <div style={{ padding:"20px 18px" }}>
        <div style={{ background:T.goldPale, borderRadius:14, padding:"14px 16px", marginBottom:20, fontSize:12, color:T.inkSoft, lineHeight:1.7, border:`1px solid ${T.goldL}` }}>
          آخر تحديث: يونيو ٢٠٢٦ — تسري على جميع مستخدمي منصة بيوتي تيك
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {items.map((s, i) => (
            <Card key={i} style={{ padding:"16px 18px" }}>
              <div style={{ fontSize:13, fontWeight:800, color:T.roseDp, marginBottom:8 }}>{s.t}</div>
              <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.8 }}>{s.b}</p>
            </Card>
          ))}
        </div>
        <div style={{ marginTop:20, textAlign:"center", fontSize:12, color:T.inkSoft }}>
          للاستفسار: beauty.techn5@gmail.com
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   💫 SPLASH SCREEN
══════════════════════════════════════════ */
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0) // 0=show, 1=fadeout

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1800)
    const t2 = setTimeout(() => onDone(), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:`linear-gradient(145deg,${T.roseL} 0%,${T.goldPale} 60%,${T.cream} 100%)`,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      opacity:phase===1 ? 0 : 1, transition:"opacity .6s",
      pointerEvents:"none",
    }}>
      <div style={{ fontSize:64, marginBottom:16, animation:"none" }}>🌸</div>
      <div style={{ fontSize:28, fontWeight:900, color:T.roseDp, letterSpacing:"-.5px" }}>بيوتي تيك</div>
      <div style={{ fontSize:13, color:T.inkSoft, marginTop:8 }}>منصة صالونات التجميل</div>
      <div style={{ marginTop:32, display:"flex", gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:T.rose, opacity:0.3 + i*0.35 }} />
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   🚫 404 PAGE
══════════════════════════════════════════ */
function NotFoundPage({ setScreen }) {
  return (
    <div style={{ background:T.cream, minHeight:"calc(100vh - 54px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", maxWidth:320 }}>
        <div style={{ fontSize:72, marginBottom:16 }}>🌸</div>
        <div style={{ fontSize:48, fontWeight:900, color:T.roseL, marginBottom:8 }}>404</div>
        <div style={{ fontSize:20, fontWeight:800, color:T.ink, marginBottom:10 }}>الصفحة غير موجودة</div>
        <p style={{ fontSize:14, color:T.inkSoft, lineHeight:1.7, marginBottom:28 }}>
          يبدو أن الصفحة التي تبحثين عنها غير موجودة أو تم نقلها.
        </p>
        <PBtn full onClick={() => setScreen("client-home")}>← العودة للرئيسية</PBtn>
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════
   🎁 GIFT VOUCHER PAGE
══════════════════════════════════════════ */
function GiftPage({ setScreen }) {
  const toast = useToast()
  const [step, setStep] = useState(1) // 1=choose, 2=details, 3=done
  const [amount, setAmount] = useState(200)
  const [customAmt, setCustomAmt] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [senderName, setSenderName] = useState("")
  const [msg, setMsg] = useState("")
  const [focusF, setFocusF] = useState(null)
  const voucherCode = "BT-" + Math.random().toString(36).slice(2,8).toUpperCase()

  const PRESETS = [100, 200, 300, 500]

  const inp = (k) => ({
    width:"100%", padding:"12px 14px",
    border:`1.5px solid ${focusF===k ? T.rose : T.creamDk}`,
    borderRadius:12, fontSize:14, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif", transition:"border-color .2s",
  })

  const send = () => {
    if (!recipientName || !recipientPhone || !senderName) { toast("⚠ أكملي البيانات"); return }
    setStep(3)
  }

  if (step === 3) return (
    <div style={{ background:T.cream, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        {/* Voucher card */}
        <div style={{ background:`linear-gradient(135deg,${T.roseDp},#7A4830)`, borderRadius:24, padding:"32px 24px", textAlign:"center", marginBottom:20, boxShadow:"0 12px 40px rgba(168,112,90,.35)" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🌸</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.7)", marginBottom:4 }}>هدية جمال من {senderName}</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.7)", marginBottom:16 }}>إلى {recipientName}</div>
          <div style={{ fontSize:42, fontWeight:900, color:T.white, marginBottom:4 }}>{amount} ر.س</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginBottom:20 }}>قسيمة هدية بيوتي تيك</div>
          {msg && <div style={{ fontSize:13, color:"rgba(255,255,255,.85)", fontStyle:"italic", marginBottom:20, padding:"10px 14px", background:"rgba(255,255,255,.1)", borderRadius:10 }}>{msg}</div>}
          <div style={{ background:"rgba(255,255,255,.15)", borderRadius:12, padding:"10px 16px" }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.7)", marginBottom:4 }}>كود القسيمة</div>
            <div style={{ fontSize:20, fontWeight:900, color:T.white, letterSpacing:3 }}>{voucherCode}</div>
          </div>
        </div>
        <div style={{ background:T.greenL, borderRadius:14, padding:"14px 16px", marginBottom:16, textAlign:"center" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.green, marginBottom:4 }}>✅ تم إنشاء القسيمة!</div>
          <div style={{ fontSize:12, color:T.inkSoft }}>سيصل الكود على واتساب لـ {recipientPhone}</div>
        </div>
        <PBtn full onClick={() => setScreen("client-home")}>← العودة للرئيسية</PBtn>
      </div>
    </div>
  )

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => step===1 ? setScreen("client-home") : setStep(1)} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>قسيمة هدية 🎁</div>
      </div>

      <div style={{ padding:"20px 18px" }}>
        {/* Steps */}
        <div style={{ display:"flex", gap:6, marginBottom:22 }}>
          {["اختاري المبلغ","تفاصيل الهدية"].map((lbl, i) => (
            <div key={lbl} style={{ flex:1 }}>
              <div style={{ height:4, borderRadius:4, background:step>i ? T.roseDp : step===i+1 ? T.rose : T.creamDk, marginBottom:5, transition:"background .3s" }} />
              <div style={{ fontSize:10, color:step===i+1 ? T.roseDp : T.inkMuted, fontWeight:step===i+1 ? 700 : 400 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ fontSize:44, marginBottom:8 }}>🌸</div>
              <div style={{ fontSize:17, fontWeight:800, color:T.ink, marginBottom:6 }}>أهدي جلسة جمال</div>
              <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.7 }}>اختاري مبلغ القسيمة — تستخدمها صاحبتها في أي صالون على المنصة</p>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {PRESETS.map(amt => (
                <button key={amt} onClick={() => { setAmount(amt); setCustomAmt("") }}
                  style={{ padding:"18px", borderRadius:16, border:`2px solid ${amount===amt && !customAmt ? T.roseDp : T.creamDk}`, background:amount===amt && !customAmt ? T.roseL : T.white, cursor:"pointer", fontFamily:"Tajawal,sans-serif", transition:"all .2s" }}>
                  <div style={{ fontSize:24, fontWeight:900, color:amount===amt && !customAmt ? T.roseDp : T.ink }}>{amt}</div>
                  <div style={{ fontSize:12, color:T.inkSoft }}>ريال سعودي</div>
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:7 }}>أو أدخلي مبلغاً مخصصاً</label>
              <input type="number" placeholder="مثال: 750" value={customAmt}
                onChange={e => { setCustomAmt(e.target.value); if(e.target.value) setAmount(Number(e.target.value)) }}
                onFocus={() => setFocusF("ca")} onBlur={() => setFocusF(null)}
                style={{ ...inp("ca"), fontSize:18, fontWeight:700 }} />
            </div>

            <PBtn full disabled={!amount || amount < 50} onClick={() => setStep(2)}>
              التالي ← ({amount} ر.س)
            </PBtn>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:7 }}>اسم من تهدينها <span style={{ color:T.rose }}>*</span></label>
              <input placeholder="مثال: نورة" value={recipientName} onChange={e => setRecipientName(e.target.value)} onFocus={() => setFocusF("rn")} onBlur={() => setFocusF(null)} style={inp("rn")} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:7 }}>رقم واتساب المستلِمة <span style={{ color:T.rose }}>*</span></label>
              <input type="tel" placeholder="05xxxxxxxx" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} onFocus={() => setFocusF("rp")} onBlur={() => setFocusF(null)} style={inp("rp")} />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:7 }}>اسمك (المُرسِلة) <span style={{ color:T.rose }}>*</span></label>
              <input placeholder="اسمك" value={senderName} onChange={e => setSenderName(e.target.value)} onFocus={() => setFocusF("sn")} onBlur={() => setFocusF(null)} style={inp("sn")} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:7 }}>رسالة شخصية (اختياري)</label>
              <textarea placeholder="اكتبي رسالة لصاحبتك... 🌸" value={msg} onChange={e => setMsg(e.target.value)} rows={3}
                onFocus={() => setFocusF("ms")} onBlur={() => setFocusF(null)}
                style={{ ...inp("ms"), resize:"none", lineHeight:1.6 }} />
            </div>

            {/* Preview */}
            <div style={{ background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, borderRadius:14, padding:"14px 16px", marginBottom:20, textAlign:"center" }}>
              <div style={{ fontSize:11, color:T.inkSoft, marginBottom:4 }}>معاينة القسيمة</div>
              <div style={{ fontSize:24, fontWeight:900, color:T.roseDp }}>{amount} ر.س</div>
              <div style={{ fontSize:12, color:T.inkSoft }}>من {senderName || "..."} إلى {recipientName || "..."}</div>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <OBtn onClick={() => setStep(1)}>← رجوع</OBtn>
              <div style={{ flex:1 }}><PBtn full onClick={send}>🎁 إرسال الهدية</PBtn></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



function RatingWidget({ bookingId, onRate }) {
  const [selected, setSelected] = useState(0)
  const [hover, setHover] = useState(0)
  const [saved, setSaved] = useState(false)
  const toast = useToast()

  const save = async () => {
    if (!selected) { toast("⚠ اختاري تقييماً"); return }
    await supabase.from('bookings').update({ rating: selected }).eq('id', bookingId)
    setSaved(true)
    onRate(selected)
    toast("✅ شكراً على تقييمك!")
  }

  if (saved) return null

  return (
    <div style={{ background:T.goldPale, borderRadius:12, padding:"12px 14px", border:`1px solid ${T.goldL}` }}>
      <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:8, textAlign:"center" }}>قيّمي تجربتك ⭐</div>
      <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:10 }}>
        {[1,2,3,4,5].map(n => (
          <span key={n}
            onClick={() => setSelected(n)}
            onMouseOver={() => setHover(n)}
            onMouseOut={() => setHover(0)}
            style={{ fontSize:28, cursor:"pointer", transition:"transform .1s", transform: (hover||selected) >= n ? "scale(1.2)" : "scale(1)" }}>
            {(hover||selected) >= n ? "★" : "☆"}
          </span>
        ))}
      </div>
      <PBtn full sm onClick={save}>إرسال التقييم</PBtn>
    </div>
  )
}

/* ══════════════════════════════════════════
   📅 MY BOOKINGS PAGE — للعميلة
══════════════════════════════════════════ */
function MyBookingsPage({ setScreen }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("active") // active | done | cancelled
  const toast = useToast()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setScreen("client-login"); return }
      const { data } = await supabase.from('bookings')
        .select('*, salons(name, city)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      setBookings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const cancelBooking = async (id) => {
    await supabase.from('bookings').update({ status:'cancelled' }).eq('id', id)
    setBookings(b => b.map(bk => bk.id === id ? { ...bk, status:'cancelled' } : bk))
    toast("تم إلغاء الحجز")
  }

  const filtered = bookings.filter(b => {
    if (tab === "active")    return b.status === "pending" || b.status === "confirmed"
    if (tab === "done")      return b.status === "completed"
    if (tab === "cancelled") return b.status === "cancelled"
    return true
  })

  const STATUS = {
    pending:   { label:"قيد الانتظار", color:T.gold,    bg:T.goldPale },
    confirmed: { label:"مؤكد",         color:T.green,   bg:T.greenL },
    completed: { label:"مكتمل",        color:T.inkSoft, bg:T.creamDk },
    cancelled: { label:"ملغي",         color:T.red,     bg:T.redL },
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>حجوزاتي 📅</div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", background:T.white, borderBottom:`1px solid ${T.creamDk}` }}>
        {[
          { id:"active",    label:"الفعّالة",   icon:"🟢" },
          { id:"done",      label:"المكتملة",   icon:"✅" },
          { id:"cancelled", label:"الملغية",    icon:"❌" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"12px 8px", border:"none", borderBottom:`3px solid ${tab===t.id ? T.roseDp : "transparent"}`, background:"transparent", cursor:"pointer", fontSize:12, fontWeight:tab===t.id ? 700 : 400, color:tab===t.id ? T.roseDp : T.inkSoft, fontFamily:"Tajawal,sans-serif" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:"16px 18px" }}>
        {loading && <div style={{ textAlign:"center", padding:40, color:T.inkSoft }}>...جاري التحميل</div>}

        {!loading && filtered.length === 0 && (
          <Empty icon="📅" title="لا توجد حجوزات" desc={tab==="active" ? "احجزي موعداً الآن!" : "لا يوجد شيء هنا"} />
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.map(bk => {
            const st = STATUS[bk.status] || STATUS.pending
            return (
              <Card key={bk.id} style={{ padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>{bk.salons?.name || "صالون"}</div>
                    <div style={{ fontSize:12, color:T.inkSoft }}>📍 {bk.salons?.city || ""}</div>
                  </div>
                  <span style={{ background:st.bg, color:st.color, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{st.label}</span>
                </div>

                <div style={{ background:T.cream, borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
                  {[
                    ["📋 الخدمة", bk.service_id || "—"],
                    ["📅 التاريخ", bk.appointment_date || "—"],
                    ["⏰ الوقت",  bk.appointment_time || "—"],
                    ["💰 المبلغ", (bk.total_amount || 0) + " ر.س"],
                    ["🔒 العربون", (bk.deposit_amount || 0) + " ر.س"],
                  ].map(row => (
                    <div key={row[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:`1px solid ${T.creamDk}` }}>
                      <span style={{ color:T.inkSoft }}>{row[0]}</span>
                      <span style={{ color:T.ink, fontWeight:600 }}>{row[1]}</span>
                    </div>
                  ))}
                </div>

                {bk.status === "pending" && (
                  <button onClick={() => cancelBooking(bk.id)}
                    style={{ width:"100%", padding:"9px", borderRadius:10, border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    إلغاء الحجز
                  </button>
                )}
                {bk.status === "completed" && !bk.rating && (
                  <RatingWidget bookingId={bk.id} onRate={(r) => {
                    setBookings(b => b.map(bk2 => bk2.id === bk.id ? { ...bk2, rating:r } : bk2))
                  }} />
                )}
                {bk.status === "completed" && bk.rating && (
                  <div style={{ textAlign:"center", fontSize:13, color:T.gold, fontWeight:700 }}>
                    {"★".repeat(bk.rating) + "☆".repeat(5-bk.rating)} تقييمك: {bk.rating}/5
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   👑 ADMIN DASHBOARD
══════════════════════════════════════════ */
function AdminDashboard({ setScreen }) {
  const toast = useToast()
  const [tab, setTab] = useState("stats")
  const [adminPass, setAdminPass] = useState("")
  const [auth, setAuth] = useState(false)
  const [focusPass, setFocusPass] = useState(false)
  const [stats, setStats] = useState({ salons:0, clients:0, bookings:0 })
  const [salonsList, setSalonsList] = useState([])
  const [pkgStats, setPkgStats] = useState({ basic:0, pro:0, elite:0 })

  useEffect(() => {
    if (!auth) return
    // جلب الإحصائيات
    supabase.from('salons').select('*').then(({ data }) => {
      if (data) {
        setStats(s => ({ ...s, salons: data.length }))
        setSalonsList(data)
        setPkgStats({
          basic:  data.filter(s => s.package === 'basic').length,
          pro:    data.filter(s => s.package === 'pro').length,
          elite:  data.filter(s => s.package === 'elite').length,
        })
      }
    })
    supabase.from('clients').select('id', { count:'exact' }).then(({ count }) => {
      if (count !== null) setStats(s => ({ ...s, clients: count }))
    })
    supabase.from('bookings').select('id,deposit_amount', { count:'exact' }).then(({ data, count }) => {
      if (count !== null) setStats(s => ({ ...s, bookings: count }))
    })
  }, [auth])

  const PKG_PRICES = { basic:200, pro:800, elite:1500 }
  const monthlyRevenue = (pkgStats.basic * PKG_PRICES.basic) + (pkgStats.pro * PKG_PRICES.pro) + (pkgStats.elite * PKG_PRICES.elite)

  if (!auth) return (
    <div style={{ background:T.cream, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:340 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>🔐</div>
          <h1 style={{ fontSize:20, fontWeight:900, color:T.ink, marginBottom:4 }}>لوحة المطوّر</h1>
          <p style={{ fontSize:13, color:T.inkSoft }}>للدخول يلزم كلمة مرور المدير</p>
        </div>
        <Card style={{ padding:22 }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>كلمة مرور المدير</label>
            <input type="password" placeholder="••••••••" value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              onFocus={() => setFocusPass(true)} onBlur={() => setFocusPass(false)}
              onKeyDown={e => { if (e.key === "Enter") { if (adminPass === "Majid@779") setAuth(true); else toast("⚠ كلمة المرور غير صحيحة") } }}
              style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${focusPass ? T.rose : T.creamDk}`, borderRadius:12, fontSize:14, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
          </div>
          <PBtn full onClick={() => { if (adminPass === "Majid@779") setAuth(true); else toast("⚠ كلمة المرور غير صحيحة") }}>
            دخول →
          </PBtn>
          <div style={{ textAlign:"center", marginTop:14 }}>
            <span onClick={() => setScreen("client-home")} style={{ fontSize:13, color:T.inkSoft, cursor:"pointer" }}>← العودة للرئيسية</span>
          </div>
        </Card>
      </div>
    </div>
  )

  const ADMIN_TABS = [
    { id:"stats",    label:"الإحصائيات", icon:"📊" },
    { id:"salons",   label:"الصالونات",  icon:"🏪" },
    { id:"packages", label:"الباقات",    icon:"📦" },
  ]

  return (
    <div style={{ background:T.cream, minHeight:"100vh" }}>
      <div style={{ background:"linear-gradient(135deg,#2C2018,#4A3428)", padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:22 }}>🔐</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:T.white }}>لوحة المطوّر</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.5)" }}>BeautyTech Admin</div>
          </div>
        </div>
        <button onClick={() => { setAuth(false); setScreen("client-home") }}
          style={{ padding:"6px 14px", borderRadius:50, border:"1px solid rgba(255,255,255,.3)", background:"transparent", color:"rgba(255,255,255,.8)", fontSize:11, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
          خروج
        </button>
      </div>
      <div style={{ display:"flex", background:T.white, borderBottom:`1px solid ${T.creamDk}` }}>
        {ADMIN_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"12px 8px", border:"none", borderBottom:`3px solid ${tab === t.id ? T.roseDp : "transparent"}`, background:"transparent", cursor:"pointer", fontSize:11, fontWeight:tab === t.id ? 700 : 400, color:tab === t.id ? T.roseDp : T.inkSoft, fontFamily:"Tajawal,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:18 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div style={{ padding:"18px 16px" }}>

        {tab === "stats" && (
          <div>
            {/* أرقام رئيسية */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              <Card style={{ padding:16, background:`linear-gradient(135deg,${T.gold},${T.gold2})`, textAlign:"center" }}>
                <div style={{ fontSize:32, fontWeight:900, color:T.white }}>{stats.salons}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,.8)", fontWeight:600, marginTop:5 }}>🏪 صالون مسجّل</div>
              </Card>
              <Card style={{ padding:16, textAlign:"center" }}>
                <div style={{ fontSize:32, fontWeight:900, color:T.roseDp }}>{stats.clients}</div>
                <div style={{ fontSize:11, color:T.inkSoft, fontWeight:600, marginTop:5 }}>👤 عميلة مسجّلة</div>
              </Card>
              <Card style={{ padding:16, textAlign:"center" }}>
                <div style={{ fontSize:32, fontWeight:900, color:T.roseDp }}>{stats.bookings}</div>
                <div style={{ fontSize:11, color:T.inkSoft, fontWeight:600, marginTop:5 }}>📅 حجز إجمالي</div>
              </Card>
              <Card style={{ padding:16, background:`linear-gradient(135deg,${T.roseDp},#7A4830)`, textAlign:"center" }}>
                <div style={{ fontSize:24, fontWeight:900, color:T.white }}>{monthlyRevenue.toLocaleString()}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.8)", fontWeight:600, marginTop:5 }}>💰 إيرادات الاشتراكات/شهر</div>
              </Card>
            </div>

            {/* توزيع الباقات */}
            <Card style={{ padding:16, marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:14 }}>توزيع الباقات</div>
              {[
                { name:"الأساسية", count:pkgStats.basic, price:200, color:T.inkSoft },
                { name:"التوسع",   count:pkgStats.pro,   price:800, color:T.gold },
                { name:"النخبة",   count:pkgStats.elite, price:1500, color:T.roseDp },
              ].map(p => (
                <div key={p.name} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <div>
                      <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{p.name}</span>
                      <span style={{ fontSize:11, color:T.inkSoft, marginRight:8 }}> — {p.price} ر.س/شهر</span>
                    </div>
                    <span style={{ fontSize:13, fontWeight:800, color:p.color }}>{p.count} صالون</span>
                  </div>
                  <div style={{ background:T.creamDk, borderRadius:50, height:6, overflow:"hidden" }}>
                    <div style={{ width: stats.salons > 0 ? `${(p.count/stats.salons)*100}%` : "0%", height:"100%", background:p.color, borderRadius:50, transition:"width .5s" }} />
                  </div>
                  <div style={{ fontSize:11, color:T.inkSoft, marginTop:3, textAlign:"left" }}>
                    إيراد: {(p.count * p.price).toLocaleString()} ر.س/شهر
                  </div>
                </div>
              ))}
              <div style={{ borderTop:`1px solid ${T.creamDk}`, paddingTop:12, marginTop:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                  <span style={{ fontWeight:700, color:T.ink }}>إجمالي الاشتراكات</span>
                  <span style={{ fontWeight:900, color:T.roseDp }}>{monthlyRevenue.toLocaleString()} ر.س/شهر</span>
                </div>
              </div>
            </Card>

            {/* رسوم التأسيس */}
            <div style={{ background:T.goldPale, border:`1px solid ${T.goldL}`, borderRadius:14, padding:"14px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:4 }}>💡 رسوم التأسيس المتوقعة</div>
              <div style={{ fontSize:20, fontWeight:900, color:T.gold }}>{(stats.salons * 600).toLocaleString()} ر.س</div>
              <div style={{ fontSize:12, color:T.inkSoft, marginTop:4 }}>{stats.salons} صالون × 600 ر.س</div>
            </div>
          </div>
        )}

        {tab === "salons" && (
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:14 }}>
              الصالونات المسجّلة ({salonsList.length})
            </div>
            {salonsList.length === 0
              ? <Empty icon="🏪" title="لا توجد صالونات بعد" desc="ستظهر هنا فور تسجيل الصالونات" />
              : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {salonsList.map(s => (
                    <Card key={s.id} style={{ padding:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{s.name}</div>
                          <div style={{ fontSize:12, color:T.inkSoft, marginTop:3 }}>{s.owner_name} — {s.phone}</div>
                          <div style={{ fontSize:12, color:T.inkSoft }}>{s.email}</div>
                          <div style={{ fontSize:12, color:T.inkSoft }}>📍 {s.city}</div>
                        </div>
                        <div style={{ textAlign:"left" }}>
                          <span style={{ background:s.package==="elite"?T.roseL:s.package==="pro"?T.goldPale:T.creamDk, color:s.package==="elite"?T.roseDp:s.package==="pro"?T.gold:T.inkSoft, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, display:"block", marginBottom:4 }}>
                            {s.package === "elite" ? "✦ نخبة" : s.package === "pro" ? "⚡ توسع" : "📦 أساسية"}
                          </span>
                          <div style={{ fontSize:10, color:T.inkSoft }}>
                            {new Date(s.created_at).toLocaleDateString("ar-SA")}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
            }
          </div>
        )}

        {tab === "packages" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {PKGS.map(p => (
              <Card key={p.id} style={{ padding:16, border:`2px solid ${p.featured ? T.gold : T.creamDk}`, position:"relative" }}>
                {p.featured && <div style={{ position:"absolute", top:-10, right:16, background:T.gold, color:T.white, fontSize:10, fontWeight:700, padding:"3px 12px", borderRadius:20 }}>الأكثر طلباً ✦</div>}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{p.name}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:T.roseDp }}>{p.price.toLocaleString()} <span style={{ fontSize:12, color:T.inkSoft, fontWeight:400 }}>ر.س/شهر</span></div>
                  </div>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:24, fontWeight:900, color:T.gold }}>
                      {p.id === "basic" ? pkgStats.basic : p.id === "pro" ? pkgStats.pro : pkgStats.elite}
                    </div>
                    <div style={{ fontSize:10, color:T.inkSoft }}>صالون</div>
                  </div>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {p.features.map(f => <span key={f} style={{ fontSize:11, color:T.green }}>{"✓ " + f}</span>)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   🧭 NAVBAR
══════════════════════════════════════════ */
function Navbar({ screen, setScreen }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user || null))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null))
    return () => listener?.subscription?.unsubscribe()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setScreen("client-home")
  }

  const hide = ["owner-dashboard","admin","booking","owner-register","owner-login","client-register","client-login","payment"]
  if (hide.includes(screen)) return null

  const role = user?.user_metadata?.role

  return (
    <nav style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"0 18px", display:"flex", alignItems:"center", justifyContent:"space-between", height:54, position:"sticky", top:0, zIndex:500, boxShadow:"0 2px 10px rgba(44,32,24,.06)" }}>
      <div onClick={() => setScreen("client-home")} style={{ display:"flex", alignItems:"center", gap:7, fontSize:17, fontWeight:900, color:T.roseDp, cursor:"pointer" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:T.gold }} />
        بيوتي تيك
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        {user ? (
          <>
            {role === "owner" && (
              <button onClick={() => setScreen("owner-dashboard")}
                style={{ padding:"7px 12px", borderRadius:50, border:`1.5px solid ${T.roseL}`, background:T.white, color:T.roseDp, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                🏪 لوحتي
              </button>
            )}
            {role === "client" && (
              <button onClick={() => setScreen("my-bookings")}
                style={{ padding:"7px 12px", borderRadius:50, border:`1.5px solid ${T.roseL}`, background:T.white, color:T.roseDp, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                📅 حجوزاتي
              </button>
            )}
            <button onClick={logout}
              style={{ padding:"7px 12px", borderRadius:50, border:`1.5px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              خروج
            </button>
          </>
        ) : (
          <>
            <span onClick={() => setScreen("client-login")} style={{ fontSize:12, fontWeight:600, color:T.inkSoft, cursor:"pointer", padding:"6px 4px" }}>دخول</span>
            <span onClick={() => setScreen("client-register")} style={{ fontSize:12, fontWeight:600, color:T.inkSoft, cursor:"pointer", padding:"6px 4px" }}>تسجيل</span>
            <div style={{ width:1, height:18, background:T.roseL }} />
            <button onClick={() => setScreen("owner-register")}
              style={{ padding:"7px 12px", borderRadius:50, border:"none", background:`linear-gradient(135deg,${T.gold},${T.gold2})`, color:T.white, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif", boxShadow:"0 3px 10px rgba(184,160,96,.35)", whiteSpace:"nowrap" }}>
              ✦ انضمي كصالون
            </button>
            <button onClick={() => setScreen("owner-login")}
              style={{ padding:"7px 12px", borderRadius:50, border:`1.5px solid ${T.roseL}`, background:T.white, color:T.roseDp, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif", whiteSpace:"nowrap" }}>
              🏪 دخول المالك
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

/* ══════════════════════════════════════════
   🚀 APP
══════════════════════════════════════════ */
export default function App() {
  const [splash, setSplash] = useState(true)
  const [screen, setScreen] = useState("client-home")
  const [salon, setSalon] = useState(null)
  const [payData, setPayData] = useState(null)
  const [user, setUser] = useState(null)

  // تحقق من الجلسة عند فتح الموقع
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        const role = session.user.user_metadata?.role
        if (role === "owner") setScreen("owner-dashboard")
        else if (role === "client") setScreen("client-home")
      }
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl")
    document.documentElement.setAttribute("lang", "ar")
    if (!document.querySelector("#bt-font")) {
      const lnk = document.createElement("link")
      lnk.id = "bt-font"
      lnk.rel = "stylesheet"
      lnk.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap"
      document.head.appendChild(lnk)
    }
    const st = document.createElement("style")
    st.textContent = "*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Tajawal',sans-serif;background:#FAF7F2;-webkit-font-smoothing:antialiased;overflow-x:hidden}input,select,textarea,button{font-family:'Tajawal',sans-serif}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#F0D9D1;border-radius:2px}"
    document.head.appendChild(st)
    document.body.style.margin = "0"
  }, [])

  const go = (s) => { setScreen(s); window.scrollTo(0, 0) }

  const renderScreen = () => {
    if (screen === "client-home")     return <ClientHome setScreen={go} setSalon={setSalon} />
    if (screen === "client-login")    return <ClientLogin setScreen={go} />
    if (screen === "client-register") return <ClientRegister setScreen={go} />
    if (screen === "booking")         return <BookingPage salon={salon} setScreen={go} />
    if (screen === "owner-register")  return <OwnerRegister setScreen={go} />
    if (screen === "owner-login")     return <OwnerLogin setScreen={go} />
    if (screen === "owner-dashboard") return <OwnerDashboard setScreen={go} />
    if (screen === "admin")           return <AdminDashboard setScreen={go} />
    if (screen === "about")           return <AboutPage      setScreen={go} />
    if (screen === "contact")         return <ContactPage    setScreen={go} />
    if (screen === "faq")             return <FAQPage        setScreen={go} />
    if (screen === "privacy")         return <PrivacyPage    setScreen={go} />
    if (screen === "404")             return <NotFoundPage   setScreen={go} />
    if (screen === "gift")             return <GiftPage        setScreen={go} />
    if (screen === "my-bookings")      return <MyBookingsPage  setScreen={go} />
    return <ClientHome setScreen={go} setSalon={setSalon} />
  }

  return (
    <ToastProvider>
      <div style={{ minHeight:"100vh", background:T.cream }}>
        {splash && <SplashScreen onDone={() => setSplash(false)} />}
        <Navbar screen={screen} setScreen={go} />
        {renderScreen()}
        {screen === "client-home" && (
          <div>
            {/* Footer links */}
            <div style={{ margin:"0 16px 16px", background:T.white, borderRadius:16, padding:"18px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                {[
                  { label:"حجوزاتي", screen:"my-bookings", icon:"📅" },
                  { label:"عن المنصة", screen:"about", icon:"🌸" },
                  { label:"قسيمة هدية", screen:"gift", icon:"🎁" },
                  { label:"تواصل معنا", screen:"contact", icon:"💬" },
                  { label:"الأسئلة الشائعة", screen:"faq", icon:"❓" },
                  { label:"سياسة الخصوصية", screen:"privacy", icon:"🔒" },
                ].map(l => (
                  <button key={l.label} onClick={() => go(l.screen)}
                    style={{ padding:"10px 12px", borderRadius:10, border:`1px solid ${T.creamDk}`, background:T.cream, color:T.inkSoft, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Tajawal,sans-serif", display:"flex", alignItems:"center", gap:6 }}>
                    <span>{l.icon}</span>{l.label}
                  </button>
                ))}
              </div>
              <div style={{ textAlign:"center", fontSize:11, color:T.inkMuted }}>
                © 2026 بيوتي تيك — جميع الحقوق محفوظة
              </div>
            </div>
            {/* Admin entry */}
            <div style={{ textAlign:"center", padding:"4px 0 24px" }}>
              <span onClick={() => go("admin")}
                style={{ fontSize:11, color:T.inkMuted, cursor:"pointer", opacity:.3, userSelect:"none", padding:"8px 16px" }}>
                ● إدارة المنصة
              </span>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
