import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { supabase } from './supabase.js'

/* ══════════════════════════════════════════
   💳 إعدادات بوابة الدفع — ميسر (Moyasar)
   المفتاح القابل للنشر (publishable) آمن للظهور بالمتصفح
   المفتاح السري يبقى محفوظاً فقط داخل Edge Function ولا يظهر هنا أبداً
══════════════════════════════════════════ */
const MOYASAR_PUBLISHABLE_KEY = "pk_test_XXXXXXXXXXXXXXXXXXXXXXXX" // 🔴 استبدليه بمفتاحك الفعلي من لوحة ميسر
const VERIFY_PAYMENT_URL = "https://cffjcobipldadwsgcwlx.supabase.co/functions/v1/verify-payment"

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

/* ══════════════════════════════════════════
   💳 MOYASAR PAYMENT MODAL — نافذة الدفع الآمنة
   تحمّل نموذج ميسر الرسمي (الكارت بياناته ما تلمس موقعنا أبداً)
   بعد نجاح الدفع، تستدعي Edge Function للتحقق والحفظ الآمن
══════════════════════════════════════════ */
function MoyasarPaymentModal({ amount, description, bookingFields, subscriptionFields, clientId, walletAmount, onSuccess, onClose, toast }) {
  const [loaded, setLoaded] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [formId] = useState(() => "mysr-form-" + Math.random().toString(36).slice(2, 9))
  const finalAmount = Math.max(0, amount - (walletAmount || 0))
  const walletOnly = !subscriptionFields && finalAmount <= 0 && (walletAmount || 0) > 0

  useEffect(() => {
    // الحالة الخاصة: المحفظة تغطي المبلغ كامل — ما نحتاج ميسر إطلاقاً
    if (walletOnly) {
      const submitWalletOnly = async () => {
        setVerifying(true)
        try {
          const res = await fetch(VERIFY_PAYMENT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wallet_only: true,
              client_id: clientId,
              wallet_amount: walletAmount,
              booking_data: { booking_fields: bookingFields },
            }),
          })
          const result = await res.json()
          setVerifying(false)
          if (!res.ok || result.error) {
            toast("⚠ " + (result.error || "تعذّر إتمام الحجز من المحفظة"))
            return
          }
          onSuccess(result.booking)
        } catch (e) {
          setVerifying(false)
          toast("⚠ حدث خطأ: " + e.message)
        }
      }
      submitWalletOnly()
      return
    }

    // تحميل سكربت ومكتبة ميسر مرة واحدة فقط
    const loadMoyasar = () => {
      if (window.Moyasar) { initForm(); return }
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/@moyasar/moyasar-payment-form@2/dist/moyasar.css'
      document.head.appendChild(css)
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/@moyasar/moyasar-payment-form@2/dist/moyasar.umd.js'
      script.onload = initForm
      document.body.appendChild(script)
    }

    const initForm = () => {
      window.Moyasar.init({
        element: `.${formId}`,
        amount: Math.round(finalAmount * 100), // بالهللات — بعد خصم المحفظة لو طُبِّقت
        currency: 'SAR',
        description,
        publishable_api_key: MOYASAR_PUBLISHABLE_KEY,
        callback_url: window.location.origin,
        supported_networks: ['mada', 'visa', 'mastercard'],
        methods: ['creditcard'],
        on_completed: async function (payment) {
          setVerifying(true)
          try {
            const payload = subscriptionFields
              ? {
                  payment_id: payment.id,
                  subscription_data: {
                    expected_amount: Math.round(finalAmount * 100),
                    email: subscriptionFields.email,
                    password: subscriptionFields.password,
                    owner_name: subscriptionFields.owner_name,
                    salon_fields: subscriptionFields.salon_fields,
                  },
                }
              : {
                  payment_id: payment.id,
                  client_id: clientId,
                  wallet_amount: walletAmount || 0,
                  booking_data: {
                    expected_amount: Math.round(finalAmount * 100),
                    booking_fields: bookingFields,
                  },
                }
            const res = await fetch(VERIFY_PAYMENT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            const result = await res.json()
            setVerifying(false)
            if (!res.ok || result.error) {
              toast("⚠ " + (result.error || "تعذّر تأكيد الدفع"))
              return
            }
            onSuccess(subscriptionFields ? result.salon : result.booking)
          } catch (e) {
            setVerifying(false)
            toast("⚠ حدث خطأ بالتحقق من الدفع: " + e.message)
          }
        },
      })
      setLoaded(true)
    }

    loadMoyasar()
  }, [])

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={verifying ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.white, borderRadius:18, padding:"20px 18px", width:"100%", maxWidth:420, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>💳 الدفع الآمن</div>
          {!verifying && <button onClick={onClose} style={{ width:30, height:30, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer" }}>✕</button>}
        </div>
        <div style={{ background:T.goldPale, borderRadius:10, padding:"10px 14px", marginBottom:14, textAlign:"center" }}>
          {walletAmount > 0 && (
            <div style={{ fontSize:11, color:T.gold, marginBottom:4 }}>💰 مخصوم من محفظتك: {walletAmount} ر.س</div>
          )}
          <div style={{ fontSize:11, color:T.inkSoft }}>{walletOnly ? "المبلغ مدفوع بالكامل من محفظتك" : "المبلغ المطلوب بالبطاقة"}</div>
          <div style={{ fontSize:22, fontWeight:900, color:T.gold }}>{walletOnly ? "0" : finalAmount} ر.س</div>
        </div>
        {verifying && (
          <div style={{ textAlign:"center", padding:30 }}>
            <div style={{ fontSize:14, color:T.inkSoft }}>...جارٍ {walletOnly ? "تأكيد الحجز من المحفظة" : "تأكيد الدفع وحفظ حجزك"}</div>
          </div>
        )}
        {!walletOnly && <div className={formId} style={{ display: verifying ? "none" : "block" }} />}
        {!walletOnly && !loaded && !verifying && (
          <div style={{ textAlign:"center", padding:20, color:T.inkSoft, fontSize:13 }}>...جارٍ تحميل نموذج الدفع</div>
        )}
        <div style={{ fontSize:10, color:T.inkMuted, textAlign:"center", marginTop:10 }}>
          🔒 بياناتك البنكية محمية بالكامل ولا تُحفظ في موقعنا
        </div>
      </div>
    </div>
  )
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
/* ══════════════════════════════════════════
   📋 TERMS MODALS — منفصلة تماماً حسب السياق
   شروط الصالون والعميلة (تظهر وقت حجز/تسجيل العميل)
══════════════════════════════════════════ */
function ClientTermsModal({ open, onClose }) {
  if (!open) return null
  const items = [
    { t:"١. توزيع العربون", b:"العربون المدفوع من العميلة (30% من قيمة الخدمة): 10% عمولة للمنصة، والباقي (20%) يُحوَّل للصالون." },
    { t:"٢. الحجز والعربون", b:"يُشترط دفع عربون 30% عند الحجز. العربون غير مسترد عند إلغاء العميلة، ويُخصم من الفاتورة النهائية." },
    { t:"٣. الإلغاء من الصالون", b:"إذا ألغى الصالون الموعد، يُرد العربون كاملاً للعميلة فوراً." },
    { t:"٤. تعديل المواعيد", b:"يحق للعميلة تعديل موعدها مرة واحدة فقط قبل 24 ساعة من الموعد." },
    { t:"٥. الشفافية في التسعير", b:"يُحظر على الصالون تغيير الأسعار بعد الحجز أو إضافة رسوم غير معلنة." },
    { t:"٦. الخصوصية", b:"تلتزم المنصة بحماية بيانات المستخدمين وعدم مشاركتها مع أطراف ثالثة." },
  ]
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(44,32,24,.5)", zIndex:3000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.white, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:560, maxHeight:"85vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"18px 22px", borderBottom:`1px solid ${T.creamDk}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>الشروط والأحكام — للعميلة</div>
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
            📌 بالحجز أو التسجيل فأنتِ توافقين على جميع الشروط أعلاه.
          </div>
        </div>
        <div style={{ padding:"14px 22px", borderTop:`1px solid ${T.creamDk}` }}>
          <PBtn full onClick={onClose}>فهمت — إغلاق</PBtn>
        </div>
      </div>
    </div>
  )
}

/* شروط المنصة والصالون (تظهر فقط وقت تسجيل صالون جديد) */
function SalonTermsModal({ open, onClose }) {
  if (!open) return null
  const items = [
    { t:"١. رسوم التأسيس", b:"تُدفع رسوم تأسيس مرة واحدة عند الانضمام للمنصة وإعداد الحساب." },
    { t:"٢. رسوم الاشتراك", b:"تُدفع رسوم الاشتراك الشهرية أو السنوية حسب الباقة المختارة. الاشتراك السنوي يوفر شهراً مجانياً." },
    { t:"٣. التجربة المجانية", b:"تُمنح تجربة مجانية لمدة 14 يوماً للصالون الجديد، مرة واحدة فقط لكل صالون." },
    { t:"٤. عمولة المنصة", b:"تأخذ المنصة عمولة 10% من قيمة كل خدمة مُنجزة عبر الحجز الأونلاين، تُخصم من العربون. مثال: خدمة 200 ر.س → عربون 60 ر.س → عمولة 20 ر.س → يُحوَّل للصالون 40 ر.س." },
    { t:"٥. عمولة الحجز اليدوي", b:"للحجوزات اليدوية (عميلة حاضرة تدفع كاش)، تستحق المنصة 3% من قيمة الخدمة، يُحوِّلها الصالون ضمن التسوية اليومية." },
    { t:"٦. موعد التحويل", b:"تُحوَّل مستحقات الصالون يومياً في نهاية كل يوم." },
    { t:"٧. ترقية/تخفيض الباقة", b:"يمكن الترقية في أي وقت بدفع الفرق + 100 ر.س. التخفيض فقط بعد انتهاء الاشتراك الحالي." },
    { t:"٨. التزامات الصالون", b:"تحديث حالة الحجوزات بانتظام، وعدم نشر محتوى مضلل أو مخالف للأنظمة." },
    { t:"٩. إيقاف الخدمة", b:"للمنصة الحق بإيقاف أي حساب مخالف للشروط بعد إشعار مسبق." },
  ]
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(44,32,24,.5)", zIndex:3000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.white, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:560, maxHeight:"85vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"18px 22px", borderBottom:`1px solid ${T.creamDk}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>الشروط والأحكام — للصالون</div>
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
            📌 بالتسجيل كصالون فأنتِ توافقين على جميع الشروط أعلاه.
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



/* ══════════════════════════════════════════
   💰 COMMISSION CALCULATOR — مركزي ودقيق
   خدمة/باقة/كوبون/عرض: عمولة 10% من الخدمة، تُخصم من العربون 30%
   إهداء محبة: عمولة 10% من المبلغ الكامل، للصالون 90%
   حجز يدوي: عمولة 3% من المبلغ الكامل — مستحقة على الصالون (عكس الاتجاه)
══════════════════════════════════════════ */
function calcCommission(booking) {
  const total = booking.total_amount || 0
  const isLoveGift = booking.booking_type === "love_gift"
  const isManual = booking.booking_type === "manual"

  if (isManual) {
    // العميلة دفعت كاش للصالون مباشرة — المنصة تستحق 3% منه فقط
    const fee = booking.platform_fee || Math.round(total * 0.03)
    return { fee, salonGet: total - fee, label: "مستحق على الصالون 3%", depositPaid: 0, owedToPlatform: fee }
  }

  if (isLoveGift) {
    // العميل دفع الكامل — عمولة 10% من الكامل
    const fee = booking.platform_fee || Math.round(total * 0.10)
    const salonGet = total - fee
    return { fee, salonGet, label: "90% من المبلغ الكامل", depositPaid: total }
  } else {
    // عربون 30% — عمولة 10% من الخدمة الكاملة تُخصم منه
    const deposit = booking.deposit_amount || Math.round(total * 0.30)
    const fee = booking.platform_fee || Math.round(total * 0.10)
    const salonGet = deposit - fee   // ما يحوّل للصالون من العربون
    return { fee, salonGet, label: "العربون - العمولة", depositPaid: deposit }
  }
}

function getServiceEmoji(name) {
  const n = (name || "").toLowerCase()
  if (n.includes("قص") || n.includes("تقصير")) return "✂️"
  if (n.includes("صبغ") || n.includes("لون")) return "🎨"
  if (n.includes("كيراتين")) return "💆"
  if (n.includes("مكياج")) return "💄"
  if (n.includes("حناء")) return "🌿"
  if (n.includes("اظافر") || n.includes("أظافر") || n.includes("مناكير")) return "💅"
  if (n.includes("وجه") || n.includes("بشره") || n.includes("بشرة")) return "✨"
  if (n.includes("رموش")) return "👁"
  if (n.includes("حاجب") || n.includes("حواجب")) return "🪮"
  if (n.includes("شعر")) return "💇"
  if (n.includes("عروس") || n.includes("زفاف")) return "👰"
  if (n.includes("مساج") || n.includes("سبا")) return "🧖"
  if (n.includes("تنظيف")) return "🧴"
  if (n.includes("بروتين")) return "💊"
  if (n.includes("سشوار") || n.includes("تمليس")) return "💨"
  return "💅"
}


function SkeletonCard() {
  return (
    <div style={{ background:T.white, borderRadius:16, overflow:"hidden", marginBottom:14 }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ height:90, background:`linear-gradient(90deg,${T.creamDk} 25%,${T.cream} 50%,${T.creamDk} 75%)`, backgroundSize:"200% 100%", animation:"shimmer 1.5s infinite" }} />
      <div style={{ padding:14 }}>
        <div style={{ height:16, width:"60%", background:T.creamDk, borderRadius:8, marginBottom:8 }} />
        <div style={{ height:12, width:"40%", background:T.cream, borderRadius:8, marginBottom:12 }} />
        <div style={{ height:36, background:T.creamDk, borderRadius:10 }} />
      </div>
    </div>
  )
}

function SkeletonList({ count=3 }) {
  return <>{Array(count).fill(0).map((_, i) => <SkeletonCard key={i} />)}</>
}

function useSalons() {
  const [data, setData] = useState([])
  useEffect(() => {
    const load = async () => {
      // فقط الصالونات المُفعَّلة (دفعت رسوم التأسيس وتأكدت من المنصة) تظهر للعميلات
      const { data: rows } = await supabase.from('salons').select('*').eq('visible', true)
      if (!rows) return
      // جلب الخدمات لكل صالون
      const { data: allServices } = await supabase.from('services').select('*').eq('active', true)
      const { data: allOffers } = await supabase.from('offers').select('salon_id').eq('active', true)
      setData(rows.map(s => ({
        id: s.id,
        name: s.name || "",
        emoji: "💅",
        city: s.city || "",
        area: s.city || "",
        pkg: s.package || "basic",
        rating: 5.0,
        reviews: 0,
        tags: s.bio ? [s.bio.slice(0,20)] : [],
        services: (allServices || [])
          .filter(sv => sv.salon_id === s.id)
          .map(sv => ({ n: sv.name, p: sv.price, dur: sv.duration, timeFrom: sv.time_from, timeTo: sv.time_to, days: sv.days, category: sv.category })),
        wa: (s.phone || "0500000000"),
        mapUrl: s.map_url || "",
        imageUrl: s.image_url || "",
        gallery: s.gallery || [],
        availNow: true,
        workingHours: s.working_hours || null,
        hasOffers: (allOffers || []).some(o => o.salon_id === s.id && o.type === 'offer'),
        hasPackages: (allOffers || []).some(o => o.salon_id === s.id && o.type === 'package'),
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
  { text:"كيراتين",      icon:"💇♀️", cat:"خدمات" },
  { text:"سبا",          icon:"🧖♀️", cat:"خدمات" },
  { text:"أكريليك أظافر",icon:"💅", cat:"خدمات" },
  { text:"تنظيف بشرة",   icon:"✨", cat:"خدمات" },
  { text:"مساج",         icon:"💆♀️", cat:"خدمات" },
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


function HomeOffersSection({ setScreen, setSalon, salons }) {
  const [offers, setOffers] = useState([])

  useEffect(() => {
    supabase.from('offers').select('*, salons(name, city, phone)').eq('active', true).order('created_at', { ascending:false }).limit(10).then(({ data }) => {
      setOffers(data || [])
    })
  }, [])

  if (offers.length === 0) return null

  const bookOffer = async (offer) => {
    const { data: { session } } = await supabase.auth.getSession()
    const salon = salons.find(s => s.id === offer.salon_id) || { id: offer.salon_id, name: offer.salons?.name || "", city: offer.salons?.city || "", services:[], wa: offer.salons?.phone || "" }
    if (!session) {
      setSalon({ ...salon, services: [{ n: offer.title, p: offer.discounted_price, dur:60, isOffer:true, offerType: offer.type }] })
      setScreen("client-login")
      return
    }
    setSalon({ ...salon, services: [{ n: offer.title, p: offer.discounted_price, dur:60, isOffer:true, offerType: offer.type }] })
    setScreen("booking")
  }

  const byType = (t) => offers.filter(o => o.type === t)

  return (
    <div style={{ marginBottom:6 }}>
      {byType("offer").length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:12, padding:"0 18px" }}>🏷️ عروض خاصة</div>
          <div style={{ display:"flex", gap:12, overflowX:"auto", padding:"0 18px 8px", scrollbarWidth:"none" }}>
            {byType("offer").map(o => {
              const disc = o.original_price ? Math.round((1 - o.discounted_price/o.original_price)*100) : 0
              return (
                <div key={o.id} style={{ minWidth:220, background:`linear-gradient(135deg,${T.roseL},#FFF0E8)`, borderRadius:16, padding:"14px", border:`1.5px solid ${T.rose}`, flexShrink:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:T.ink, flex:1 }}>{o.title}</div>
                    {disc > 0 && <span style={{ background:T.red, color:T.white, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, flexShrink:0 }}>-{disc}%</span>}
                  </div>
                  <div style={{ fontSize:11, color:T.inkSoft, marginBottom:6 }}>{o.salons?.name} — {o.salons?.city}</div>
                  {o.description && <div style={{ fontSize:11, color:T.inkSoft, marginBottom:8 }}>{o.description}</div>}
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    {o.original_price && <span style={{ fontSize:11, color:T.inkSoft, textDecoration:"line-through" }}>{o.original_price} ر.س</span>}
                    <span style={{ fontSize:16, fontWeight:900, color:T.roseDp }}>{o.discounted_price} ر.س</span>
                  </div>
                  {o.valid_until && <div style={{ fontSize:10, color:T.inkSoft, marginBottom:8 }}>⏰ حتى: {o.valid_until}</div>}
                  <button onClick={() => bookOffer(o)}
                    style={{ width:"100%", padding:"9px", borderRadius:10, border:"none", background:T.roseDp, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    احجزي الآن ←
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {byType("package").length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:12, padding:"0 18px" }}>🎁 باقات مميزة</div>
          <div style={{ display:"flex", gap:12, overflowX:"auto", padding:"0 18px 8px", scrollbarWidth:"none" }}>
            {byType("package").map(o => (
              <div key={o.id} style={{ minWidth:220, background:`linear-gradient(135deg,${T.goldPale},#FFFBF0)`, borderRadius:16, padding:"14px", border:`1.5px solid ${T.goldL}`, flexShrink:0 }}>
                <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:6 }}>📦 {o.title}</div>
                <div style={{ fontSize:11, color:T.inkSoft, marginBottom:6 }}>{o.salons?.name} — {o.salons?.city}</div>
                {o.description && <div style={{ fontSize:11, color:T.inkSoft, marginBottom:8 }}>{o.description}</div>}
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  {o.original_price && <span style={{ fontSize:11, color:T.inkSoft, textDecoration:"line-through" }}>{o.original_price} ر.س</span>}
                  <span style={{ fontSize:16, fontWeight:900, color:T.gold }}>{o.discounted_price} ر.س</span>
                </div>
                {o.valid_until && <div style={{ fontSize:10, color:T.inkSoft, marginBottom:8 }}>⏰ حتى: {o.valid_until}</div>}
                <button onClick={() => bookOffer(o)}
                  style={{ width:"100%", padding:"9px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.gold},${T.gold2})`, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  احجزي الباقة ←
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ClientHome({ setScreen, setSalon }) {
  const salons = useSalons()
  const salonsLoading = salons.length === 0
  const [filterType, setFilterType] = useState("")
  const [q, setQ]           = useState("")
  const [fq, setFq]         = useState(false)
  const [showSugg, setShowSugg] = useState(false)
  const [availNow, setAvailNow] = useState(false)
  const [sortBy, setSortBy] = useState("recommended") // recommended | rating | price | popular | nearest | fastest
  const [priceRange, setPriceRange] = useState([0, 1000])
  const [dragging, setDragging] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [timeSlot, setTimeSlot] = useState(null) // null | morning | afternoon | evening
  const [myCity, setMyCity] = useState("")        // مدينة العميلة — لفلتر المنطقة و"الأقرب لك"
  const [detectingCity, setDetectingCity] = useState(false)

  const CITIES = ["الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام","الخبر","أبها","تبوك","القصيم"]

  // أقرب وقت متاح اليوم لكل صالون (للترتيب بـ"الأسرع توفر")
  const earliestSlot = (s) => {
    const times = (s.services || []).map(sv => sv.timeFrom).filter(Boolean)
    if (times.length === 0) return "23:59"
    return times.sort()[0]
  }

  const filtered_sugg = q.length > 0
    ? SUGGESTIONS.filter(s => s.text.includes(q))
    : SUGGESTIONS.slice(0, 6)

  // فلترة + ترتيب الصالونات
  let list = salons.filter(s => !filterType || (filterType==="offers" ? s.hasOffers : filterType==="packages" ? s.hasPackages : true)).filter(s => {
    if (availNow && !s.availNow) return false
    if (myCity && s.city !== myCity) return false
    if (q && !s.name.includes(q) && !s.area.includes(q) && !(s.tags || []).some(t => t.includes(q))) return false
    const minP = s.services && s.services.length > 0 ? Math.min(...s.services.map(sv => sv.p)) : 0
    if (minP < priceRange[0] || minP > priceRange[1]) return false
    return true
  })

  if (sortBy === "rating")      list = [...list].sort((a,b) => b.rating - a.rating)
  if (sortBy === "price")       list = [...list].sort((a,b) => Math.min(...a.services.map(s=>s.p)) - Math.min(...b.services.map(s=>s.p)))
  if (sortBy === "popular")     list = [...list].sort((a,b) => b.reviews - a.reviews)
  if (sortBy === "recommended") list = [...list].sort((a,b) => (b.rating * 0.6 + (b.reviews/100) * 0.4) - (a.rating * 0.6 + (a.reviews/100) * 0.4))
  if (sortBy === "nearest")     list = [...list].sort((a,b) => {
    const aMatch = myCity && a.city === myCity ? 0 : 1
    const bMatch = myCity && b.city === myCity ? 0 : 1
    return aMatch - bMatch
  })
  if (sortBy === "fastest")     list = [...list].sort((a,b) => earliestSlot(a).localeCompare(earliestSlot(b)))

  const activeFilters = (availNow ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < 1000 ? 1 : 0) + (timeSlot ? 1 : 0) + (myCity ? 1 : 0)

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

          {/* مقارنة الصالونات */}
          <button onClick={() => setScreen("compare")}
            style={{ padding:"8px 16px", borderRadius:50, border:`1.5px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"Tajawal,sans-serif", transition:"all .2s", display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            ⚖️ مقارنة
          </button>

          {/* ترتيب */}
          {[
            { id:"recommended", label:"الأنسب", icon:"✦" },
            { id:"nearest",     label:"الأقرب لك", icon:"📍" },
            { id:"fastest",     label:"الأسرع توفر", icon:"⚡" },
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

            {/* المنطقة / المدينة */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>📍 المنطقة</div>
                <button onClick={async () => {
                    setDetectingCity(true)
                    if (!navigator.geolocation) { setDetectingCity(false); return }
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                      try {
                        const { latitude, longitude } = pos.coords
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ar`)
                        const data = await res.json()
                        const detected = data?.address?.city || data?.address?.state || ""
                        const matched = CITIES.find(c => detected.includes(c) || c.includes(detected))
                        if (matched) setMyCity(matched)
                      } catch(e) {}
                      setDetectingCity(false)
                    }, () => setDetectingCity(false))
                  }}
                  style={{ fontSize:11, fontWeight:700, color:T.roseDp, background:"none", border:"none", cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {detectingCity ? "...جارٍ التحديد" : "📡 حدد موقعي تلقائياً"}
                </button>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <button onClick={() => setMyCity("")}
                  style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${!myCity ? T.roseDp : T.creamDk}`, background:!myCity ? T.roseL : T.white, color:!myCity ? T.roseDp : T.inkSoft, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  كل المناطق
                </button>
                {CITIES.map(c => (
                  <button key={c} onClick={() => setMyCity(c)}
                    style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${myCity===c ? T.roseDp : T.creamDk}`, background:myCity===c ? T.roseL : T.white, color:myCity===c ? T.roseDp : T.inkSoft, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

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
              <button onClick={() => { setAvailNow(false); setPriceRange([0,1000]); setTimeSlot(null); setMyCity("") }}
                style={{ marginTop:12, width:"100%", padding:"9px", borderRadius:10, border:`1px solid ${T.roseL}`, background:T.white, color:T.roseDp, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                ✕ إلغاء كل الفلاتر
              </button>
            )}
          </div>
        )}

        {/* عروض وباقات */}
        {!filterType && !q && <HomeOffersSection setScreen={setScreen} setSalon={setSalon} salons={salons} />}

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
              المنصة في طور النمو,<br /><span style={{ color:T.roseDp }}>كوني أول صالون ينضم!</span>
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
              <div style={{ height:90, background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, position:"relative", overflow:"hidden" }}>
                {s.imageUrl
                  ? <img src={s.imageUrl} alt={s.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span>{s.emoji}</span>}

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
                  <span style={{ fontSize:12, color:T.inkSoft }}>📍 {s.city}, {s.area}</span>
                  {myCity && s.city === myCity && (
                    <span style={{ background:T.greenL, color:T.green, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>📍 في مدينتك</span>
                  )}
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
                {/* Time slots visual — مبني على أوقات عمل الصالون الفعلية */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.inkSoft, marginBottom:6 }}>الأوقات المتاحة اليوم</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                    {(() => {
                      const todayName = new Date().toLocaleDateString("ar-SA", { weekday:"long" })
                      const todaySchedule = s.workingHours?.[todayName]
                      const isOpenToday = !s.workingHours || !todaySchedule || todaySchedule.open !== false
                      const openFrom = todaySchedule?.from || "09:00"
                      const openTo   = todaySchedule?.to   || "21:00"
                      const toMinutes = (t) => { const [h,m] = t.split(":").map(Number); return h*60+m }
                      const ranges = [
                        { id:"morning",   icon:"🌅", label:"صباح",  from:"06:00", to:"12:00" },
                        { id:"afternoon", icon:"☀️",  label:"ظهيرة", from:"12:00", to:"17:00" },
                        { id:"evening",   icon:"🌙", label:"مساء",  from:"17:00", to:"23:59" },
                      ]
                      return ranges.map(sl => {
                        // الفترة متاحة لو فيها تداخل مع ساعات دوام الصالون اليوم
                        const available = isOpenToday && toMinutes(sl.from) < toMinutes(openTo) && toMinutes(sl.to) > toMinutes(openFrom)
                        return (
                          <div key={sl.id} style={{ padding:"8px 6px", borderRadius:10, background:available ? T.greenL : T.creamDk, textAlign:"center", opacity:available ? 1 : .5 }}>
                            <div style={{ fontSize:16 }}>{sl.icon}</div>
                            <div style={{ fontSize:10, fontWeight:600, color:available ? T.green : T.inkMuted, marginTop:2 }}>{sl.label}</div>
                            <div style={{ fontSize:9, color:available ? T.green : T.inkMuted }}>
                              {available ? "متاح" : "مغلق"}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <PBtn full onClick={() => { setSalon(s); setScreen("booking") }}>احجزي الآن</PBtn>
                  <a href={"https://wa.me/966" + (s.wa||"0500000000").replace(/^0/,"")} target="_blank" rel="noreferrer"
                    style={{ width:46, height:46, borderRadius:12, background:T.waL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, textDecoration:"none", flexShrink:0 }}>💬</a>
                  <button onClick={() => { if (s.mapUrl) window.open(s.mapUrl, "_blank"); else alert("الصالون لم يضف موقعه بعد") }}
                    style={{ width:46, height:46, borderRadius:12, background:T.goldPale, border:"none", fontSize:20, cursor:"pointer", flexShrink:0 }}>📍</button>
                </div>
                <button onClick={() => { setSalon(s); setScreen("salon-detail") }}
                  style={{ width:"100%", padding:"9px", borderRadius:12, border:`1px solid ${T.creamDk}`, background:T.cream, color:T.inkSoft, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  عرض كل الخدمات ({s.services?.length || 0}) ←
                </button>
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
   ⚖️ COMPARE SALONS
══════════════════════════════════════════ */
function ComparePage({ setScreen, setSalon }) {
  const salons = useSalons()
  const [selected, setSelected] = useState([])
  const [step, setStep] = useState(1) // 1=اختيار, 2=مقارنة
  const [servicesMap, setServicesMap] = useState({})

  const toggleSelect = (s) => {
    if (selected.find(x => x.id === s.id)) {
      setSelected(prev => prev.filter(x => x.id !== s.id))
    } else if (selected.length < 2) {
      setSelected(prev => [...prev, s])
    }
  }

  const loadCompare = async () => {
    const map = {}
    for (const s of selected) {
      const { data } = await supabase.from("services").select("*").eq("salon_id", s.id).eq("active", true)
      map[s.id] = data || []
    }
    setServicesMap(map)
    setStep(2)
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:80 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={() => step===2 ? setStep(1) : setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>⚖️ مقارنة الصالونات</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>{step===1 ? "اختاري صالونين للمقارنة" : "نتيجة المقارنة"}</div>
        </div>
        {step===1 && selected.length===2 && (
          <PBtn sm onClick={loadCompare}>مقارنة ←</PBtn>
        )}
      </div>

      {step === 1 && (
        <div style={{ padding:"16px 18px" }}>
          <div style={{ background:T.goldPale, borderRadius:12, padding:"10px 14px", marginBottom:16, border:`1px solid ${T.goldL}`, fontSize:12, color:T.inkSoft }}>
            💡 اختاري صالونين لمقارنتهما ({selected.length}/2)
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {salons.map(s => {
              const isSelected = selected.find(x => x.id === s.id)
              const isDisabled = !isSelected && selected.length >= 2
              return (
                <div key={s.id} onClick={() => !isDisabled && toggleSelect(s)}
                  style={{ background:T.white, borderRadius:14, padding:"14px 16px", border:`2px solid ${isSelected ? T.roseDp : T.creamDk}`, cursor:isDisabled ? "not-allowed" : "pointer", opacity:isDisabled ? .5 : 1, display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:48, height:48, borderRadius:12, overflow:"hidden", flexShrink:0, background:T.roseL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                    {s.imageUrl ? <img src={s.imageUrl} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "💅"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{s.name}</div>
                    <div style={{ fontSize:12, color:T.inkSoft }}>📍 {s.city} · {s.services?.length||0} خدمة</div>
                  </div>
                  <div style={{ width:24, height:24, borderRadius:"50%", border:`2px solid ${isSelected ? T.roseDp : T.creamDk}`, background:isSelected ? T.roseDp : T.white, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isSelected && <div style={{ fontSize:12, color:T.white }}>✓</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {step === 2 && selected.length === 2 && (
        <div style={{ padding:"16px 18px" }}>
          {/* هيدر المقارنة */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {selected.map(s => (
              <div key={s.id} style={{ background:T.white, borderRadius:14, padding:"14px", textAlign:"center", border:`2px solid ${T.roseL}` }}>
                <div style={{ width:56, height:56, borderRadius:14, overflow:"hidden", margin:"0 auto 8px", background:T.roseL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>
                  {s.imageUrl ? <img src={s.imageUrl} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "💅"}
                </div>
                <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{s.name}</div>
                <div style={{ fontSize:11, color:T.inkSoft }}>📍 {s.city}</div>
              </div>
            ))}
          </div>

          {/* مقارنة المعلومات */}
          <Card style={{ padding:16, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:12 }}>📊 معلومات عامة</div>
            {[
              ["عدد الخدمات", selected.map(s => (servicesMap[s.id]?.length||0) + " خدمة")],
              ["أقل سعر", selected.map(s => { const svcs = servicesMap[s.id]||[]; return svcs.length ? Math.min(...svcs.map(x=>x.price)) + " ر.س" : "—" })],
              ["أعلى سعر", selected.map(s => { const svcs = servicesMap[s.id]||[]; return svcs.length ? Math.max(...svcs.map(x=>x.price)) + " ر.س" : "—" })],
              ["التقييم", selected.map(s => "★★★★★ " + (s.rating||5.0))],
              ["المدينة", selected.map(s => s.city||"—")],
            ].map(row => (
              <div key={row[0]} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, padding:"8px 0", borderBottom:`1px solid ${T.creamDk}`, alignItems:"center" }}>
                <div style={{ fontSize:11, color:T.inkSoft, textAlign:"center" }}>{row[0]}</div>
                {row[1].map((v,i) => (
                  <div key={i} style={{ fontSize:12, fontWeight:700, color:T.ink, textAlign:"center" }}>{v}</div>
                ))}
              </div>
            ))}
          </Card>

          {/* مقارنة الخدمات */}
          <Card style={{ padding:16, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:12 }}>✂️ الخدمات</div>
            {selected.map(s => (
              <div key={s.id} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.roseDp, marginBottom:8 }}>{s.name}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {(servicesMap[s.id]||[]).slice(0,5).map(sv => (
                    <div key={sv.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, background:T.cream, borderRadius:8, padding:"6px 10px" }}>
                      <span style={{ color:T.ink }}>{getServiceEmoji(sv.name)} {sv.name}</span>
                      <span style={{ fontWeight:700, color:T.gold }}>{sv.price} ر.س</span>
                    </div>
                  ))}
                  {(servicesMap[s.id]||[]).length === 0 && <div style={{ fontSize:12, color:T.inkSoft }}>لا توجد خدمات</div>}
                </div>
              </div>
            ))}
          </Card>

          {/* أزرار الحجز */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {selected.map(s => (
              <PBtn key={s.id} full onClick={() => { setSalon(s); setScreen("booking") }}>
                احجزي في {s.name.split(" ")[0]}
              </PBtn>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   🏪 SALON DETAIL PAGE
══════════════════════════════════════════ */

function SalonOffers({ salonId, setScreen, setSalon, salon }) {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!salonId) return
    supabase.from('offers').select('*').eq('salon_id', salonId).eq('active', true).then(({ data }) => {
      setOffers(data || [])
      setLoading(false)
    })
  }, [salonId])

  if (loading || offers.length === 0) return null

  const bookOffer = async (offer) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setScreen("client-login"); return }
    // احجز العرض مباشرة
    setSalon({
      ...salon,
      services: [{ n: offer.title, p: offer.discounted_price, dur: 60, isOffer: true, offerId: offer.id, offerType: offer.type }]
    })
    setScreen("booking")
  }

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:12 }}>🏷️ العروض والباقات</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {offers.map(o => {
          const disc = o.original_price ? Math.round((1 - o.discounted_price/o.original_price)*100) : 0
          return (
            <div key={o.id} style={{ background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, borderRadius:16, padding:"14px 16px", border:`1.5px solid ${T.rose}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <span>{o.type==="package" ? "📦" : "🏷️"}</span>
                    <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{o.title}</div>
                    {disc > 0 && <span style={{ background:T.red, color:T.white, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>-{disc}%</span>}
                  </div>
                  {o.description && <div style={{ fontSize:12, color:T.inkSoft, marginBottom:6 }}>{o.description}</div>}
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    {o.original_price && <span style={{ fontSize:12, color:T.inkSoft, textDecoration:"line-through" }}>{o.original_price} ر.س</span>}
                    <span style={{ fontSize:18, fontWeight:900, color:T.roseDp }}>{o.discounted_price} ر.س</span>
                  </div>
                  {o.valid_until && <div style={{ fontSize:11, color:T.inkSoft, marginTop:4 }}>⏰ صالح حتى: {o.valid_until}</div>}
                </div>
              </div>
              <button onClick={() => bookOffer(o)}
                style={{ width:"100%", padding:"10px", borderRadius:12, border:"none", background:T.roseDp, color:T.white, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                احجزي هذا العرض ←
              </button>
              <div style={{ textAlign:"center", fontSize:10, color:T.inkMuted, marginTop:6 }}>
                🔒 يلزم تسجيل الدخول ودفع العربون للحجز
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SalonDetailPage({ salon, setScreen, setSalon }) {
  const [services, setServices] = useState(salon?.services || [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!salon?.id) return
    setLoading(true)
    supabase.from('services').select('*').eq('salon_id', salon.id).eq('active', true).then(({ data }) => {
      if (data) setServices(data.map(s => ({ n:s.name, p:s.price, dur:s.duration, timeFrom:s.time_from, timeTo:s.time_to })))
      setLoading(false)
    })
  }, [salon?.id])

  if (!salon) return null

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>{salon.name}</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>📍 {salon.city}</div>
        </div>
        <a href={"https://wa.me/966" + (salon.wa||"").replace(/^0/,"")} target="_blank" rel="noreferrer"
          style={{ width:38, height:38, borderRadius:"50%", background:T.waL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, textDecoration:"none" }}>💬</a>
      </div>

      {/* Hero */}
      <div style={{ height:180, background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:60, position:"relative", overflow:"hidden" }}>
        {salon.imageUrl
          ? <img src={salon.imageUrl} alt={salon.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
          : "💅"}
      </div>

      <div style={{ padding:"16px 18px" }}>
        {/* Info */}
        <Card style={{ padding:16, marginBottom:14 }}>
          <div style={{ fontSize:17, fontWeight:900, color:T.ink, marginBottom:6 }}>{salon.name}</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ color:T.gold, fontSize:14, fontWeight:700 }}>★★★★★</span>
            <span style={{ fontSize:12, color:T.inkSoft }}>📍 {salon.city}</span>
          </div>
          {salon.tags && salon.tags[0] && (
            <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.7 }}>{salon.tags[0]}</p>
          )}
          {salon.mapUrl && (
            <button onClick={() => window.open(salon.mapUrl, "_blank")}
              style={{ marginTop:10, padding:"8px 16px", borderRadius:20, border:`1px solid ${T.goldL}`, background:T.goldPale, color:T.gold, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              📍 عرض الموقع على الخريطة
            </button>
          )}
        </Card>

        {/* أوقات العمل */}
        {salon.workingHours && (
          <Card style={{ padding:16, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:10 }}>🕐 أوقات العمل</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"].map(day => {
                const d = salon.workingHours[day]
                const isToday = new Date().toLocaleDateString("ar-SA", { weekday:"long" }) === day
                return (
                  <div key={day} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", background:isToday ? T.roseL : "transparent", borderRadius:8, paddingRight:isToday?8:0, paddingLeft:isToday?8:0 }}>
                    <span style={{ fontSize:12, fontWeight:isToday?700:500, color:isToday ? T.roseDp : T.ink }}>{day}{isToday && " (اليوم)"}</span>
                    <span style={{ fontSize:12, color:d?.open === false ? T.red : T.inkSoft, fontWeight:d?.open === false ? 700 : 400 }}>
                      {!d || d.open === false ? "مغلق" : `${d.from} — ${d.to}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Services */}
        {/* عروض وباقات */}
        <SalonOffers salonId={salon.id} setScreen={setScreen} setSalon={setSalon} salon={salon} />

        <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:12, marginTop:6 }}>
          الخدمات ({services.length})
        </div>

        {loading && <div style={{ textAlign:"center", padding:20, color:T.inkSoft }}>...جاري التحميل</div>}

        {!loading && services.length === 0 && (
          <div style={{ textAlign:"center", padding:30, color:T.inkSoft, background:T.white, borderRadius:14 }}>
            لم يتم إضافة خدمات بعد
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {services.map((sv, i) => (
            <Card key={i} style={{ padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{getServiceEmoji(sv.n)} {sv.n}</div>
                <div style={{ fontSize:12, color:T.inkSoft, marginTop:3 }}>
                  ⏱ {sv.dur < 60 ? sv.dur+"د" : Math.floor(sv.dur/60)+"س"+(sv.dur%60>0?sv.dur%60+"د":"")}
                  {sv.timeFrom && ` · ${sv.timeFrom}—${sv.timeTo}`}
                </div>
                <div style={{ fontSize:11, color:T.green, marginTop:2 }}>🔒 عربون: {Math.round(sv.p*.3)} ر.س</div>
              </div>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:18, fontWeight:900, color:T.gold }}>{sv.p}</div>
                <div style={{ fontSize:10, color:T.inkSoft }}>ر.س</div>
              </div>
            </Card>
          ))}
        </div>

        <PBtn full onClick={() => { setSalon(salon); setScreen("booking") }}>
          احجزي الآن ←
        </PBtn>
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════
   📅 BOOKING
══════════════════════════════════════════ */
/* ══════════════════════════════════════════
   🔔 NOTIFY ME MODAL — إشعار توفر وقت عند موظفة معينة
══════════════════════════════════════════ */
function NotifyMeModal({ staff, salonId, defaultDate, defaultName, defaultPhone, toast, onClose }) {
  const [name, setName] = useState(defaultName || "")
  const [phone, setPhone] = useState(defaultPhone || "")
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!name || !phone) { toast("⚠ أدخلي اسمك وجوالك"); return }
    setSaving(true)
    const { error } = await supabase.from('availability_requests').insert([{
      staff_id: staff.id,
      salon_id: salonId,
      client_name: name,
      client_phone: phone,
      preferred_date: defaultDate || null,
    }])
    setSaving(false)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    setSent(true)
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:3500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.white, borderRadius:18, padding:"22px 18px", width:"100%", maxWidth:360 }}>
        {sent ? (
          <div style={{ textAlign:"center", padding:10 }}>
            <div style={{ fontSize:40, marginBottom:10 }}>🔔</div>
            <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:6 }}>تم تسجيل طلبك!</div>
            <p style={{ fontSize:12, color:T.inkSoft, marginBottom:16 }}>سيتواصل معك الصالون على واتساب فور توفر وقت عند {staff.name}</p>
            <PBtn full onClick={onClose}>تمام</PBtn>
          </div>
        ) : (
          <>
            <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:6 }}>🔔 إشعار توفر</div>
            <p style={{ fontSize:12, color:T.inkSoft, marginBottom:14 }}>سنخبرك فور توفر وقت عند <strong style={{ color:T.ink }}>{staff.name}</strong></p>
            <Field label="اسمك" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: نورة" />
            <Field label="رقم جوالك" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx" />
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <OBtn onClick={onClose}>إلغاء</OBtn>
              <div style={{ flex:1 }}><PBtn full disabled={saving} onClick={submit}>{saving ? "...جارٍ" : "تأكيد"}</PBtn></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

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
  const [bookedTimes, setBookedTimes] = useState([])
  const [showPayment, setShowPayment] = useState(false)
  const [userId, setUserId] = useState(null)
  const [wallet, setWallet] = useState({ total: 0, applied: 0 })
  const [staffList, setStaffList] = useState([])
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [staffBusyTimes, setStaffBusyTimes] = useState({}) // { staff_id: [times...] }
  const [showNotifyMe, setShowNotifyMe] = useState(false)
  const deposit = svc ? Math.round(svc.p * 0.3) : 0
  const platformFee = svc ? Math.round(svc.p * 0.10) : 0
  const salonAmount = deposit - platformFee  // العربون - عمولة المنصة
  const ALL_SVC_TIMES = ["00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30","05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"]
  const DAY_NAMES_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]

  // ساعات العمل المعتمدة: لو فيه موظفة محددة، نأخذ جدولها هي بالضبط — وإلا نرجع لجدول الخدمة العام
  const getActiveHours = () => {
    if (selectedStaff) {
      const dayName = date ? DAY_NAMES_AR[new Date(date + "T00:00:00").getDay()] : null
      if (dayName && selectedStaff.days && !selectedStaff.days.includes(dayName)) {
        return [] // الموظفة لا تعمل بهذا اليوم إطلاقاً
      }
      return { from: selectedStaff.time_from || "09:00", to: selectedStaff.time_to || "18:00" }
    }
    if (svc && svc.timeFrom && svc.timeTo) return { from: svc.timeFrom, to: svc.timeTo }
    return { from: "09:00", to: "18:00" }
  }

  const getSvcTimes = () => {
    const hours = getActiveHours()
    if (Array.isArray(hours)) return [] // يوم عطلة للموظفة
    const fi = ALL_SVC_TIMES.indexOf(hours.from)
    const ti = ALL_SVC_TIMES.indexOf(hours.to)
    if (fi < 0 || ti < 0) return ALL_SVC_TIMES
    return ALL_SVC_TIMES.slice(fi, ti + 1)
  }
  const TIMES = getSvcTimes().filter(t => !bookedTimes.includes(t))

  // جلب الأوقات المحجوزة فعلياً — لو فيه موظفة محددة، فقط حجوزاتها هي (يدوي + أونلاين)
  // لو ما فيه موظفة محددة بعد، نتحقق من كل حجوزات الصالون بهذا الوقت (احتياط)
  const refreshBookedTimes = () => {
    if (!date || !salon?.id) { setBookedTimes([]); return }
    let q = supabase.from('bookings').select('appointment_time')
      .eq('salon_id', salon.id)
      .eq('appointment_date', date)
      .in('status', ['pending', 'confirmed', 'completed'])
    if (selectedStaff) q = q.eq('staff_id', selectedStaff.id)
    q.then(({ data }) => setBookedTimes((data || []).map(b => b.appointment_time)))
  }
  useEffect(refreshBookedTimes, [date, salon?.id, selectedStaff?.id])

  // جلب فريق الصالون — فقط الموظفات المتخصصات بهذي الخدمة (أو "كل الخدمات")
  useEffect(() => {
    if (!salon?.id) return
    supabase.from('staff').select('*').eq('salon_id', salon.id).eq('active', true)
      .then(({ data }) => {
        const all = data || []
        if (!svc?.category) { setStaffList(all); return }
        setStaffList(all.filter(st => st.specialty === svc.category || st.specialty === "كل الخدمات"))
      })
  }, [salon?.id, svc?.category])

  // حساب أقرب وقت متاح لكل موظفة اليوم (لعرضه بجانب اسمها بقائمة الاختيار)
  useEffect(() => {
    if (!salon?.id || staffList.length === 0) return
    const today = new Date().toISOString().split("T")[0]
    supabase.from('bookings').select('staff_id, appointment_time')
      .eq('salon_id', salon.id)
      .eq('appointment_date', today)
      .in('status', ['pending', 'confirmed', 'completed'])
      .then(({ data }) => {
        const busyByStaff = {}
        ;(data || []).forEach(b => {
          if (!b.staff_id) return
          if (!busyByStaff[b.staff_id]) busyByStaff[b.staff_id] = []
          busyByStaff[b.staff_id].push(b.appointment_time)
        })
        setStaffBusyTimes(busyByStaff)
      })
  }, [salon?.id, staffList])

  // الوقت الحالي بتوقيت السعودية الثابت (UTC+3) — يعتمد على UTC الحقيقي فقط، بدون أي تأثير من توقيت جهاز العميلة
  const getSaudiNow = () => {
    const saudiMs = Date.now() + (3 * 60 * 60 * 1000)
    return new Date(saudiMs)
  }

  const getNearestSlot = (staffMember) => {
    const saudiNow = getSaudiNow()
    const todayName = DAY_NAMES_AR[saudiNow.getUTCDay()]
    if (staffMember.days && !staffMember.days.includes(todayName)) return null
    const fi = ALL_SVC_TIMES.indexOf(staffMember.time_from || "09:00")
    const ti = ALL_SVC_TIMES.indexOf(staffMember.time_to || "18:00")
    if (fi < 0 || ti < 0) return null
    const dayTimes = ALL_SVC_TIMES.slice(fi, ti + 1)
    const busy = staffBusyTimes[staffMember.id] || []
    const nowStr = String(saudiNow.getUTCHours()).padStart(2,"0") + ":" + (saudiNow.getUTCMinutes() < 30 ? "00" : "30")
    return dayTimes.find(t => !busy.includes(t) && t >= nowStr) || null
  }

  if (!salon) return null

  const [clientRecordId, setClientRecordId] = useState(null)

  // جلب رصيد محفظة العميلة (لو مسجّلة دخول)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      setUserId(session.user.id)
      supabase.from('clients').select('id').eq('email', session.user.email).then(({ data }) => {
        if (!data?.[0]) return
        setClientRecordId(data[0].id)
        supabase.from('wallet_credits').select('remaining, expires_at')
          .eq('client_id', data[0].id).gt('remaining', 0)
          .then(({ data: credits }) => {
            const valid = (credits || []).filter(c => !c.expires_at || new Date(c.expires_at) > new Date())
            setWallet(w => ({ ...w, total: valid.reduce((s, c) => s + Number(c.remaining), 0) }))
          })
      })
    })
  }, [])

  // فتح بوابة الدفع — العربون يُدفع فعلياً قبل إنشاء الحجز
  const openPayment = async () => {
    if (!agreed) { toast("⚠ يرجى الموافقة على الشروط"); return }
    if (!name || !phone || !date || !time) { toast("⚠ أكملي كل البيانات"); return }
    const { data: { session } } = await supabase.auth.getSession()
    setUserId(session?.user?.id || null)
    setShowPayment(true)
  }

  // يُستدعى بعد نجاح الدفع والتحقق منه فعلياً عبر Edge Function
  const handlePaymentSuccess = async () => {
    setShowPayment(false)

    // رسالة تأكيد جاهزة للعميلة نفسها — تفتح واتسابها مباشرة لحفظ الموعد
    const myWaNum = (phone || "").replace(/^0/, "").replace(/[^0-9]/g, "")
    if (myWaNum) {
      const myMsgText = "🌸 تأكيد حجزك في " + salon.name + "\n\n" +
        "الخدمة: " + (svc?.n || "") + "\n" +
        "التاريخ: " + date + "\n" +
        "الوقت: " + time + "\n" +
        "المبلغ الكامل: " + (svc?.p || 0) + " ر.س\n" +
        "العربون المدفوع: " + deposit + " ر.س\n\n" +
        "احفظي هذه الرسالة كتذكير لموعدك ✨"
      const myMsg = encodeURIComponent(myMsgText)
      window.open(`https://wa.me/${myWaNum.startsWith("966") ? myWaNum : "966"+myWaNum}?text=${myMsg}`, "_blank")
    }

    // إشعار واتساب للصالون
    if (salon?.wa) {
      const waNum = (salon.wa).replace(/^0/, "").replace(/[^0-9]/g,"")
      const msgText = "🌸 حجز جديد على بيوتي تيك!\n\n" +
        "العميلة: " + name + "\n" +
        "الجوال: " + phone + "\n" +
        "الخدمة: " + (svc?.n || "") + "\n" +
        "التاريخ: " + date + "\n" +
        "الوقت: " + time + "\n" +
        "المبلغ: " + (svc?.p || 0) + " ر.س\n" +
        "العربون: " + deposit + " ر.س"
      const msg = encodeURIComponent(msgText)
      setTimeout(() => window.open(`https://wa.me/966${waNum}?text=${msg}`, "_blank"), 1200)
    }
    toast("✅ تم الدفع والحجز بنجاح!")
    setTimeout(() => setScreen("client-home"), 1500)
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <ClientTermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
      {/* Header */}
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>{salon.name}</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>📍 {salon.city}, {salon.area}</div>
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
                <div key={sv.n} onClick={() => { setSvc(sv); setSelectedStaff(null); setTime("") }}
                  style={{ background:T.white, borderRadius:14, padding:"14px 16px", border:`2px solid ${svc && svc.n === sv.n ? T.roseDp : T.creamDk}`, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"all .2s" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{getServiceEmoji(sv.n)} {sv.n}</div>
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
            <Field label="التاريخ" type="date" value={date} onChange={e => { setDate(e.target.value); setTime("") }} required />

            {staffList.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>اختاري الموظفة (اختياري)</label>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <button onClick={() => { setSelectedStaff(null); setTime("") }}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${!selectedStaff ? T.roseDp : T.creamDk}`, background:!selectedStaff ? T.roseL : T.white, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>بدون تحديد (أي موظفة متاحة)</span>
                  </button>
                  {staffList.map(st => {
                    const nearest = getNearestSlot(st)
                    return (
                      <button key={st.id} onClick={() => { setSelectedStaff(st); setTime("") }}
                        style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${selectedStaff?.id===st.id ? T.roseDp : T.creamDk}`, background:selectedStaff?.id===st.id ? T.roseL : T.white, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{st.name}</div>
                          {st.specialty && <div style={{ fontSize:11, color:T.inkSoft }}>{st.specialty}</div>}
                          {st.rating > 0 && <div style={{ fontSize:10, color:T.gold }}>⭐ {st.rating.toFixed(1)} ({st.rating_count})</div>}
                        </div>
                        <div style={{ fontSize:10, color:nearest ? T.green : T.red, fontWeight:700 }}>
                          {nearest ? `⚡ أقرب وقت: ${nearest}` : "مشغولة اليوم"}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft }}>الوقت <span style={{ color:T.rose }}>*</span></label>
                {selectedStaff && (
                  <button onClick={() => setShowNotifyMe(true)}
                    style={{ fontSize:11, color:T.gold, background:"none", border:"none", cursor:"pointer", fontFamily:"Tajawal,sans-serif", fontWeight:700 }}>
                    🔔 أشعريني لو فضى وقت آخر
                  </button>
                )}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {TIMES.map(tm => (
                  <button key={tm} onClick={() => setTime(tm)}
                    style={{ padding:"10px 4px", borderRadius:10, border:`1.5px solid ${time === tm ? T.roseDp : T.creamDk}`, background:time === tm ? T.roseL : T.white, color:time === tm ? T.roseDp : T.ink, fontSize:12, fontWeight:time === tm ? 700 : 400, cursor:"pointer", fontFamily:"Tajawal,sans-serif", transition:"all .2s" }}>
                    {tm}
                  </button>
                ))}
                {date && TIMES.length === 0 && (
                  <div style={{ gridColumn:"span 4" }}>
                    <div style={{ textAlign:"center", padding:14, fontSize:12, color:T.red, background:T.redL, borderRadius:10, marginBottom:8 }}>
                      {selectedStaff ? `${selectedStaff.name} لا تتوفر بهذا اليوم أو الأوقات كلها محجوزة` : "لا توجد أوقات متاحة بهذا اليوم — جرّبي تاريخاً آخر"}
                    </div>
                    {selectedStaff && (
                      <button onClick={() => setShowNotifyMe(true)}
                        style={{ width:"100%", padding:"10px", borderRadius:10, border:`1px solid ${T.gold}`, background:T.goldPale, color:T.gold, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                        🔔 أشعريني فور توفر وقت عند {selectedStaff.name}
                      </button>
                    )}
                  </div>
                )}
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

            {wallet.total > 0 && (
              <div style={{ background:T.goldPale, borderRadius:12, padding:"12px 14px", marginBottom:16, border:`1px solid ${T.goldL}` }}>
                <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:T.ink }}>
                    💰 استخدام رصيد محفظتي ({wallet.total.toLocaleString()} ر.س)
                  </span>
                  <input type="checkbox" checked={wallet.applied > 0} onChange={e => {
                    const useAmount = e.target.checked ? Math.min(wallet.total, deposit) : 0
                    setWallet(w => ({ ...w, applied: useAmount }))
                  }} style={{ accentColor:T.gold }} />
                </label>
                {wallet.applied > 0 && (
                  <div style={{ fontSize:11, color:T.inkSoft, marginTop:6 }}>
                    سيُخصم {wallet.applied} ر.س من محفظتك — المتبقي للدفع: <strong style={{ color:T.gold }}>{deposit - wallet.applied} ر.س</strong>
                  </div>
                )}
              </div>
            )}

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
                <PBtn full onClick={openPayment}>💳 الدفع وتأكيد الحجز</PBtn>
              </div>
            </div>
          </div>
        )}
      </div>

      {showPayment && (
        <MoyasarPaymentModal
          amount={deposit}
          description={`عربون حجز — ${svc?.n || ""} — ${salon.name}`}
          toast={toast}
          clientId={clientRecordId}
          walletAmount={wallet.applied}
          onClose={() => setShowPayment(false)}
          bookingFields={{
            salon_id: salon.id || null,
            client_name: name,
            client_phone: phone,
            appointment_date: date,
            appointment_time: time,
            total_amount: svc ? svc.p : 0,
            deposit_amount: deposit,
            status: 'pending',
            user_id: userId,
            service_name: svc ? svc.n : "",
            staff_id: selectedStaff?.id || null,
            staff_name: selectedStaff?.name || null,
            booking_type: svc?.isOffer ? (svc.offerType || "offer") : "service",
            platform_fee: platformFee,
            salon_amount: salonAmount,
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showNotifyMe && selectedStaff && (
        <NotifyMeModal
          staff={selectedStaff}
          salonId={salon.id}
          defaultDate={date}
          defaultName={name}
          defaultPhone={phone}
          toast={toast}
          onClose={() => setShowNotifyMe(false)}
        />
      )}
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
    if (authError) {
      setLoading(false)
      if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
        toast("⚠ هذا البريد الإلكتروني مسجَّل مسبقاً — جرّبي تسجيل الدخول")
      } else {
        toast("⚠ " + authError.message)
      }
      return
    }
    const { error: clientErr } = await supabase.from('clients').insert([{ full_name: form.name, phone: form.phone, email: form.email }])
    setLoading(false)
    if (clientErr) console.error("clients directory insert failed:", clientErr.message)
    toast("✅ مرحباً بكِ! تم إنشاء حسابك 🌸")
    setScreen("client-home")
  }

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <ClientTermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
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

/* ══════════════════════════════════════════
   🔑 RESET PASSWORD PAGE — استرجاع كلمة المرور
══════════════════════════════════════════ */
function ResetPasswordPage({ setScreen }) {
  const toast = useToast()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!email) { toast("⚠ أدخلي بريدك الإلكتروني"); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    setSent(true)
  }

  if (sent) return (
    <div style={{ background:T.cream, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📩</div>
        <div style={{ fontSize:17, fontWeight:800, color:T.ink, marginBottom:8 }}>تم إرسال الرابط!</div>
        <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.7, marginBottom:24 }}>
          تحققي من بريدك <strong style={{ color:T.ink }}>{email}</strong> — أرسلنا رابط إعادة تعيين كلمة المرور
        </p>
        <PBtn full onClick={() => setScreen("client-home")}>← العودة للرئيسية</PBtn>
      </div>
    </div>
  )

  return (
    <div style={{ background:T.cream, minHeight:"100vh" }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>استرجاع كلمة المرور</div>
      </div>
      <div style={{ padding:"36px 18px" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:44, marginBottom:8 }}>🔑</div>
          <p style={{ fontSize:14, color:T.inkSoft, lineHeight:1.7 }}>أدخلي بريدك الإلكتروني المسجَّل وسنرسل لك رابط إعادة التعيين</p>
        </div>
        <Field label="البريد الإلكتروني" type="email" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <PBtn full disabled={loading} onClick={submit}>{loading ? "...جارٍ الإرسال" : "إرسال رابط الاسترجاع"}</PBtn>
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
          <span onClick={() => setScreen("reset-password")} style={{ fontSize:13, color:T.roseDp, fontWeight:600, cursor:"pointer" }}>نسيتِ كلمة المرور؟</span>
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
   📋 TERMS PAGE
══════════════════════════════════════════ */
function TermsPage({ setScreen }) {
  const [tab, setTab] = useState("salon-platform")
  
  const salonPlatformTerms = [
    { t:"١. رسوم التأسيس", b:"تُدفع رسوم تأسيس مرة واحدة عند الانضمام للمنصة وإعداد الحساب." },
    { t:"٢. رسوم الاشتراك", b:"تُدفع رسوم الاشتراك الشهرية أو السنوية حسب الباقة المختارة. الاشتراك السنوي يوفر شهراً مجانياً (11 شهراً فقط)." },
    { t:"٣. التجربة المجانية", b:"تُمنح تجربة مجانية لمدة 14 يوماً للصالون الجديد مرة واحدة فقط لكل صالون (يُتحقق بالإيميل ورقم الجوال)." },
    { t:"٤. عمولة المنصة", b:"تأخذ المنصة عمولة 10% من قيمة كل خدمة مُنجزة عبر الحجز الأونلاين. تُخصم من العربون المدفوع من العميلة. مثال: خدمة 200 ر.س → عربون 60 ر.س → عمولة المنصة 20 ر.س → يُحوَّل للصالون 40 ر.س." },
    { t:"٥. عمولة الحجز اليدوي/الحضوري", b:"للحجوزات التي تُسجَّل يدوياً من الاستقبال (عميلة حاضرة بالصالون تدفع كاش مباشرة)، تستحق المنصة عمولة 3% من قيمة الخدمة الكاملة، يُحوِّلها الصالون للمنصة ضمن التسوية اليومية." },
    { t:"٦. موعد التحويل", b:"تُحوَّل مستحقات الصالون يومياً في نهاية كل يوم. وبالمثل، يُحوِّل الصالون مستحقات المنصة من الحجوزات اليدوية ضمن نفس التسوية اليومية." },
    { t:"٧. سياسة ترقية الباقة", b:"يمكن الترقية لباقة أعلى في أي وقت بدفع الفرق بين الباقتين + رسوم ترقية 100 ر.س. يتم التفعيل فور إتمام الدفع." },
    { t:"٨. سياسة تخفيض الباقة", b:"لا يمكن تخفيض الباقة إلا بعد انتهاء فترة الاشتراك الحالية. يُطبَّق التخفيض تلقائياً عند التجديد." },
    { t:"٩. إدارة الحجوزات", b:"الصالون مسؤول عن تحديث حالة الحجوزات (مكتمل/ملغي) في الوقت المناسب. التأخر يؤثر على موعد التحويل." },
    { t:"١٠. انتهاء التجربة المجانية", b:"عند انتهاء فترة التجربة المجانية (14 يوماً) دون تفعيل باقة مدفوعة، يتم تعليق الوصول إلى لوحة التحكم تلقائياً حتى يتواصل الصالون مع المنصة لإكمال التفعيل." },
    { t:"١١. المحتوى والسلوك", b:"يلتزم الصالون بعدم نشر محتوى مضلل أو مخالف للأنظمة. المنصة تحتفظ بحق إيقاف الحساب المخالف." },
    { t:"١٢. إيقاف الخدمة", b:"للمنصة الحق في إيقاف حساب أي صالون يخالف الشروط أو يتلقى تقييمات سلبية متكررة بعد إشعار مسبق." },
    { t:"١٣. التعديلات", b:"تحتفظ المنصة بحق تعديل الأسعار والشروط مع إشعار مسبق بـ 30 يوماً." },
  ]

  const salonClientTerms = [
    { t:"١. توزيع العربون", b:"العربون المدفوع من العميلة (30% من قيمة الخدمة): 10% عمولة للمنصة، والباقي (20%) يُحوَّل للصالون خلال 24 ساعة." },
    { t:"٢. التزامات الصالون", b:"يلتزم الصالون بتقديم الخدمة في الوقت المحدد وبالجودة الموعودة وبالسعر المعلن على المنصة." },
    { t:"٣. الإلغاء من الصالون", b:"إذا ألغى الصالون الموعد، يُرد العربون كاملاً للعميلة فوراً بما فيه عمولة المنصة." },
    { t:"٤. الشفافية في التسعير", b:"يُحظر على الصالون تغيير الأسعار بعد الحجز أو إضافة رسوم غير معلنة." },
    { t:"٥. العروض والباقات", b:"العروض والباقات المعلنة ملزمة للصالون طوال فترة صلاحيتها." },
    { t:"٦. حل النزاعات", b:"في حال النزاع بين العميلة والصالون، تتدخل المنصة للوساطة. قرار المنصة ملزم للطرفين." },
  ]

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:`linear-gradient(135deg,#2C1810,#5A3020)`, padding:"40px 20px 24px", textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:8 }}>📋</div>
        <h1 style={{ fontSize:20, fontWeight:900, color:T.white, marginBottom:4 }}>الشروط والأحكام</h1>
        <p style={{ fontSize:12, color:"rgba(255,255,255,.6)" }}>آخر تحديث: يونيو 2025</p>
      </div>

      {/* تبويبات */}
      <div style={{ display:"flex", background:T.white, borderBottom:`1px solid ${T.creamDk}` }}>
        {[
          { id:"salon-platform", label:"المنصة والصالون" },
          { id:"salon-client",   label:"الصالون والعميلة" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"13px 8px", border:"none", borderBottom:`3px solid ${tab===t.id ? T.roseDp : "transparent"}`, background:"transparent", cursor:"pointer", fontSize:12, fontWeight:tab===t.id ? 700 : 400, color:tab===t.id ? T.roseDp : T.inkSoft, fontFamily:"Tajawal,sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:"20px 18px" }}>
        {/* بطاقة ملخص العمولة */}
        {tab === "salon-platform" && (
          <div style={{ background:`linear-gradient(135deg,${T.goldPale},#FFFBF0)`, borderRadius:14, padding:"16px", marginBottom:20, border:`1px solid ${T.goldL}` }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:10 }}>💰 مثال توضيحي — خدمة بـ 200 ر.س</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[
                ["العربون (30%)", "60 ر.س", T.ink],
                ["عمولة المنصة (10% من الخدمة)", "20 ر.س", T.red],
                ["يُحوَّل للصالون", "40 ر.س", T.green],
                ["الباقي يُدفع للصالون عند الخدمة", "140 ر.س", T.roseDp],
              ].map(r => (
                <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                  <span style={{ color:T.inkSoft }}>{r[0]}</span>
                  <span style={{ fontWeight:700, color:r[2] }}>{r[1]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(tab === "salon-platform" ? salonPlatformTerms : salonClientTerms).map(s => (
          <div key={s.t} style={{ marginBottom:16, background:T.white, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:6 }}>{s.t}</div>
            <div style={{ fontSize:13, color:T.inkSoft, lineHeight:1.8 }}>{s.b}</div>
          </div>
        ))}

        <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:T.inkSoft }}>
          للاستفسار: 0552401658 | beauty.techn5@gmail.com
        </div>

        <button onClick={() => setScreen("client-home")}
          style={{ marginTop:16, width:"100%", padding:"12px", borderRadius:12, border:`1px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:13, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
          ← العودة للرئيسية
        </button>
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
  const [termsType, setTermsType] = useState("platform-salon")
  const [focusCity, setFocusCity] = useState(false)
  const [salonId, setSalonId] = useState(null)
  const [services, setServices] = useState([{ name:"", price:"" }])
  const [savingServices, setSavingServices] = useState(false)
  const [billing, setBilling] = useState("monthly")
  const [skipTrial, setSkipTrial] = useState(false)
  const [showSubPayment, setShowSubPayment] = useState(false)
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

    // لو اختارت البدء بدون تجربة، تفتح بوابة الدفع الفعلية بدل الإنشاء المباشر
    if (skipTrial) {
      setShowSubPayment(true)
      return
    }

    setLoading(true)
    // إنشاء حساب Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.pass,
      options: { data: { role: "owner", name: form.owner } }
    })
    if (authError) {
      setLoading(false)
      if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
        toast("⚠ هذا البريد الإلكتروني مسجَّل مسبقاً — جرّبي تسجيل الدخول")
      } else {
        toast("⚠ " + authError.message)
      }
      return
    }
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
      skip_trial: false,
      trial_end: trialEnd.toISOString(),
      visible: false,   // مخفي عن العميلات حتى تتأكد المنصة من دفع رسوم التأسيس
      referred_by_code: sessionStorage.getItem("referral_code") || null,
    }]).select()
    setLoading(false)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    if (data && data[0]) setSalonId(data[0].id)
    setStep(3)
  }

  // المبلغ المطلوب: قيمة الباقة (شهري أو سنوي) + رسوم التأسيس 600 ر.س
  const selectedPkgPrice = PKGS.find(p => p.id === pkg)?.price || 0
  const subscriptionAmount = (billing === "yearly" ? selectedPkgPrice * 11 : selectedPkgPrice) + 600

  // يُستدعى بعد نجاح الدفع والتحقق منه فعلياً — الصالون أصبح مفعّلاً وظاهراً فوراً
  const handleSubPaymentSuccess = (salon) => {
    setShowSubPayment(false)
    setLoading(false)
    if (salon?.id) setSalonId(salon.id)
    toast("✅ تم الدفع وتفعيل حسابك فوراً!")
    setStep(3)
  }

  const addService = () => setServices(s => [...s, { name:"", price:"" }])
  const removeService = (i) => setServices(s => s.filter((_, j) => j !== i))
  const setServiceField = (i, k, v) => setServices(s => s.map((sv, j) => j === i ? { ...sv, [k]:v } : sv))

  const finishServices = async () => {
    const valid = services.filter(s => s.name && s.price)
    if (valid.length > 0 && salonId) {
      setSavingServices(true)
      const { error } = await supabase.from('services').insert(valid.map(s => ({
        salon_id: salonId,
        name: s.name,
        price: Number(s.price),
        active: true,
        days: ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"],
        time_from: "09:00",
        time_to: "18:00",
      })))
      setSavingServices(false)
      if (error) {
        toast("⚠ تعذّر حفظ الخدمات: " + error.message + " — يمكنك إضافتها لاحقاً من لوحة التحكم")
      }
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
        {skipTrial ? (
          <div style={{ background:T.greenL, borderRadius:14, padding:"12px 16px", marginBottom:16, textAlign:"right" }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.green, marginBottom:4 }}>✅ تم الدفع وتفعيل حسابك بالكامل</div>
            <div style={{ fontSize:11, color:T.inkSoft }}>صالونك ظاهر للعميلات الآن — يمكنك البدء باستقبال الحجوزات فوراً</div>
          </div>
        ) : (
          <div style={{ background:T.greenL, borderRadius:14, padding:"12px 16px", marginBottom:16, textAlign:"right" }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.green, marginBottom:4 }}>🎁 تجربة مجانية 14 يوم مفعّلة</div>
            <div style={{ fontSize:11, color:T.inkSoft }}>مرة واحدة فقط لكل صالون</div>
          </div>
        )}
        <p style={{ fontSize:14, color:T.inkSoft, lineHeight:1.8, marginBottom:26 }}>
          {skipTrial
            ? "يمكنك الدخول للوحة التحكم الآن وإضافة خدماتك وفريقك."
            : "سيتواصل فريقنا معكِ خلال 24 ساعة لإتمام إعداد الحساب ودفع رسوم التأسيس (600 ر.س)."}
        </p>
        <PBtn full onClick={() => setScreen("owner-login")}>الذهاب لتسجيل الدخول</PBtn>
      </div>
    </div>
  )

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <SalonTermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
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

              {/* تفاصيل الباقة المحددة — وش يشمل بالضبط */}
              {pkg && (
                <div style={{ background:T.cream, borderRadius:12, padding:"12px 14px", marginBottom:14, border:`1px solid ${T.creamDk}` }}>
                  <div style={{ fontSize:12, fontWeight:800, color:T.ink, marginBottom:8 }}>
                    📦 {PKGS.find(p=>p.id===pkg)?.name} — تشمل:
                  </div>
                  {PKGS.find(p=>p.id===pkg)?.features.map(f => (
                    <div key={f} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.ink, padding:"3px 0" }}>
                      <span style={{ color:T.green }}>✓</span> {f}
                    </div>
                  ))}
                  {PKGS.find(p=>p.id===pkg)?.missing.length > 0 && (
                    <>
                      <div style={{ height:1, background:T.creamDk, margin:"8px 0" }} />
                      {PKGS.find(p=>p.id===pkg)?.missing.map(f => (
                        <div key={f} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:T.inkMuted, padding:"3px 0" }}>
                          <span style={{ color:T.red }}>✕</span> {f}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
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
                <div style={{ fontSize:11, color:T.inkSoft }}>دفع فعلي فوري: {selectedPkgPrice * (billing === "yearly" ? 11 : 1)} ر.س ({billing === "yearly" ? "سنوي" : "شهري"}) + 600 ر.س رسوم تأسيس = {subscriptionAmount} ر.س</div>
              </div>
              <button onClick={() => setSkipTrial(!skipTrial)}
                style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${T.gold}`, background:skipTrial ? T.gold : T.white, color:skipTrial ? T.white : T.gold, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
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
              {loading ? "...جاري التسجيل" : skipTrial ? `💳 الدفع وتفعيل الحساب فوراً — ${subscriptionAmount} ر.س` : "🎁 ابدأي تجربتك المجانية — 14 يوم"}
            </PBtn>
          </div>
        )}
      </div>

      {showSubPayment && (
        <MoyasarPaymentModal
          amount={subscriptionAmount}
          description={`اشتراك ${PKGS.find(p=>p.id===pkg)?.name||""} (${billing==="yearly"?"سنوي":"شهري"}) + رسوم تأسيس — ${form.name}`}
          toast={toast}
          onClose={() => setShowSubPayment(false)}
          subscriptionFields={{
            email: form.email,
            password: form.pass,
            owner_name: form.owner,
            salon_fields: {
              name: form.name,
              owner_name: form.owner,
              phone: form.phone,
              email: form.email,
              city: form.city,
              package: pkg,
              billing: billing,
              referred_by_code: sessionStorage.getItem("referral_code") || null,
            },
          }}
          onSuccess={handleSubPaymentSuccess}
        />
      )}
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
          <span onClick={() => setScreen("reset-password")} style={{ fontSize:13, color:T.roseDp, fontWeight:600, cursor:"pointer" }}>نسيتِ كلمة المرور؟</span>
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
const ALL_OWN_TABS = [
  { id:"overview",   icon:"📊", label:"نظرة عامة" },
  { id:"hours",      icon:"🕐", label:"الأوقات" },
  { id:"bookings",   icon:"📅", label:"الحجوزات" },
  { id:"calendar",   icon:"🗓️", label:"التقويم" },
  { id:"love_gifts", icon:"💝", label:"إهداء محبة" },
  { id:"services",   icon:"✂️",  label:"الخدمات" },
  { id:"staff",      icon:"👩💼", label:"الفريق" },
  { id:"offers",     icon:"🏷️",  label:"عروض" },
  { id:"packages",   icon:"🎁",  label:"باقات" },
  { id:"coupons",    icon:"🎟️", label:"كوبونات" },
  { id:"inventory",  icon:"🧴", label:"المخزون" },
  { id:"whatsapp",   icon:"💬", label:"واتساب" },
  { id:"broadcast",  icon:"📢", label:"رسائل" },
  { id:"reports",    icon:"📈", label:"التقارير" },
  { id:"finance",    icon:"💰", label:"المالية" },
  { id:"package",    icon:"📦", label:"باقتي" },
  { id:"settings",   icon:"⚙️",  label:"الإعدادات" },
  { id:"terms",      icon:"📋", label:"الشروط" },
]

function OwnerDashboard({ setScreen }) {
  const toast = useToast()
  const [tab, setTab] = useState("overview")
  const [salonInfo, setSalonInfo] = useState({ name:"...", trial_end:null, package:"basic" })

  const refreshSalonInfo = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase.from('salons').select('name,trial_end,city,owner_name,phone,bio,email,package').eq('email', session.user.email)
    if (data && data[0]) setSalonInfo({ ...data[0] })
  }

  useEffect(() => { refreshSalonInfo() }, [])

  const OWN_TABS = ALL_OWN_TABS
  const daysLeft = salonInfo.trial_end
    ? Math.max(0, Math.ceil((new Date(salonInfo.trial_end) - new Date()) / (1000*60*60*24)))
    : 14
  const trialExpired = salonInfo.trial_end && new Date(salonInfo.trial_end) < new Date()

  // قفل لوحة التحكم عند انتهاء التجربة المجانية بدون تفعيل باقة مدفوعة
  if (trialExpired) return (
    <div style={{ background:T.cream, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380, textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>⏳</div>
        <div style={{ fontSize:19, fontWeight:900, color:T.ink, marginBottom:10 }}>انتهت التجربة المجانية</div>
        <p style={{ fontSize:14, color:T.inkSoft, lineHeight:1.8, marginBottom:24 }}>
          استمتعتِ بـ 14 يوم مجاناً على بيوتي تيك 🌸<br/>
          تواصلي معنا لتفعيل باقتك ومتابعة استقبال الحجوزات
        </p>
        <div style={{ background:T.white, borderRadius:16, padding:"18px", marginBottom:20, border:`1.5px solid ${T.roseL}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:8 }}>{salonInfo.name}</div>
          <div style={{ fontSize:12, color:T.inkSoft }}>الباقة المختارة: {salonInfo.package === "basic" ? "الأساسية" : salonInfo.package === "pro" ? "التوسع" : "النخبة"}</div>
        </div>
        <PBtn full onClick={() => window.open("https://wa.me/966552401658?text=" + encodeURIComponent("أرغب بتفعيل باقتي بعد انتهاء التجربة المجانية — صالون: " + salonInfo.name), "_blank")}>
          💬 تواصلي معنا للتفعيل
        </PBtn>
        <div style={{ marginTop:14 }}>
          <span onClick={async () => { await supabase.auth.signOut(); setScreen("client-home") }} style={{ fontSize:12, color:T.inkMuted, cursor:"pointer" }}>تسجيل الخروج</span>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ background:T.cream, minHeight:"100vh" }}>
      {/* Top bar */}
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>💅</div>
          <div>
            <div style={{ fontSize:14, fontWeight:900, color:T.ink }}>{salonInfo.name || "..."}</div>
            <div style={{ fontSize:11, color:T.roseDp, fontWeight:700 }}>🎁 تجربة مجانية — باقي {daysLeft} يوم</div>
          </div>
        </div>
        <button onClick={() => { toast("👋 تم تسجيل الخروج"); setScreen("owner-login") }}
          style={{ padding:"7px 14px", borderRadius:50, border:`1px solid ${T.roseL}`, background:T.white, color:T.inkSoft, fontSize:12, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
          خروج
        </button>
      </div>

      {/* Salon quick info */}
      {(salonInfo.name) && (
        <div style={{ background:T.cream, padding:"10px 18px", borderBottom:`1px solid ${T.creamDk}`, display:"flex", flexDirection:"column", gap:4 }}>
          {salonInfo.phone && <span style={{ fontSize:12, color:T.inkSoft }}>📞 {salonInfo.phone}</span>}
          {salonInfo.email && <span style={{ fontSize:12, color:T.inkSoft }}>📧 {salonInfo.email}</span>}
          {salonInfo.bio && <span style={{ fontSize:12, color:T.inkSoft }}>💬 {salonInfo.bio}</span>}
        </div>
      )}
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
        {tab === "hours"     && <OwnerHours toast={toast} />}
        {tab === "bookings"  && <OwnerBookings />}
        {tab === "love_gifts" && <OwnerLoveGifts toast={toast} />}
        {tab === "services"  && <OwnerServices toast={toast} />}
        {tab === "inventory" && <OwnerInventory toast={toast} />}
        {tab === "whatsapp"  && <OwnerWhatsapp toast={toast} />}
        {tab === "settings"  && <OwnerSettings toast={toast} />}
        {tab === "calendar"  && <OwnerCalendar toast={toast} />}
        {tab === "staff"     && <OwnerStaff toast={toast} />}
        {tab === "broadcast" && <OwnerBroadcast toast={toast} />}
        {tab === "coupons"   && <OwnerCoupons toast={toast} />}
        {tab === "reports"   && (
          (salonInfo.package === "pro" || salonInfo.package === "elite")
            ? <OwnerReport salonInfo={salonInfo} />
            : <div style={{ textAlign:"center", padding:40 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
                <div style={{ fontSize:15, fontWeight:700, color:T.ink, marginBottom:8 }}>متاح لباقة التوسع والنخبة</div>
                <div style={{ fontSize:13, color:T.inkSoft, marginBottom:16 }}>قومي بالترقية للوصول للتقارير الاحترافية</div>
                <PBtn onClick={() => {}}>ترقية الباقة</PBtn>
              </div>
        )}
        {tab === "finance"   && <OwnerFinance toast={toast} />}
        {tab === "terms"     && <OwnerTerms />}
        {tab === "package"   && <OwnerPackage toast={toast} onPkgChange={refreshSalonInfo} />}
        {tab === "offers"    && <OwnerOffers toast={toast} type="offer" />}
        {tab === "packages"  && <OwnerOffers toast={toast} type="package" />}
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════
   🖐️ MANUAL BOOKING MODAL — حجز يدوي بالاستقبال
   عمولة 3% من قيمة الخدمة، يُحفظ كحجز "قائم" فوراً
══════════════════════════════════════════ */
function ManualBookingModal({ salonId, onClose, onCreated, toast }) {
  const [services, setServices] = useState([])
  const [loadingSvcs, setLoadingSvcs] = useState(true)
  const [svc, setSvc] = useState(null)
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [time, setTime] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [bookedTimes, setBookedTimes] = useState([])
  const [saving, setSaving] = useState(false)
  const [staffList, setStaffList] = useState([])
  const [allStaff, setAllStaff] = useState([])
  const [staffId, setStaffId] = useState("")

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('services').select('*').eq('salon_id', salonId)
      setServices((data || []).map(s => ({
        id: s.id, name: s.name, price: s.price, category: s.category,
        timeFrom: s.time_from || "09:00", timeTo: s.time_to || "18:00",
      })))
      const { data: staffData } = await supabase.from('staff').select('*').eq('salon_id', salonId).eq('active', true)
      setAllStaff(staffData || [])
      setLoadingSvcs(false)
    }
    load()
  }, [salonId])

  // فلترة الموظفات حسب تخصصهم المطابق لتصنيف الخدمة المختارة
  useEffect(() => {
    if (!svc?.category) { setStaffList(allStaff); return }
    setStaffList(allStaff.filter(st => st.specialty === svc.category || st.specialty === "كل الخدمات"))
  }, [svc?.category, allStaff])

  // جلب الأوقات المحجوزة — لو فيه موظفة محددة، فقط حجوزاتها هي (يدوي + أونلاين مدمجين)
  const refreshBookedTimes = () => {
    if (!date || !salonId) return
    let q = supabase.from('bookings').select('appointment_time')
      .eq('salon_id', salonId)
      .eq('appointment_date', date)
      .in('status', ['pending', 'confirmed', 'completed'])
    if (staffId) q = q.eq('staff_id', staffId)
    q.then(({ data }) => setBookedTimes((data || []).map(b => b.appointment_time)))
  }
  useEffect(refreshBookedTimes, [date, salonId, staffId])

  const DAY_NAMES_AR_MANUAL = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]

  const getSvcTimes = () => {
    const selectedStaffMember = staffList.find(st => st.id === staffId)
    // لو فيه موظفة محددة، نستخدم جدولها هي بالضبط (أيام وساعات دوامها)
    if (selectedStaffMember) {
      const dayName = date ? DAY_NAMES_AR_MANUAL[new Date(date + "T00:00:00").getDay()] : null
      if (dayName && selectedStaffMember.days && !selectedStaffMember.days.includes(dayName)) {
        return [] // الموظفة لا تعمل بهذا اليوم
      }
      const fi = ALL_TIMES.indexOf(selectedStaffMember.time_from || "09:00")
      const ti = ALL_TIMES.indexOf(selectedStaffMember.time_to || "18:00")
      if (fi < 0 || ti < 0) return ALL_TIMES
      return ALL_TIMES.slice(fi, ti + 1)
    }
    if (!svc) return []
    const fi = ALL_TIMES.indexOf(svc.timeFrom)
    const ti = ALL_TIMES.indexOf(svc.timeTo)
    if (fi < 0 || ti < 0) return ALL_TIMES
    return ALL_TIMES.slice(fi, ti + 1)
  }
  const availableTimes = getSvcTimes().filter(t => !bookedTimes.includes(t))

  const fee = svc ? Math.round(svc.price * 0.03) : 0
  const salonNet = svc ? svc.price - fee : 0

  const submit = async () => {
    if (!svc || !date || !time || !clientName || !clientPhone) { toast("⚠ أكملي كل الحقول"); return }
    setSaving(true)
    const selectedStaff = staffList.find(st => st.id === staffId)
    const { error } = await supabase.from('bookings').insert([{
      salon_id: salonId,
      client_name: clientName,
      client_phone: clientPhone,
      appointment_date: date,
      appointment_time: time,
      service_name: svc.name,
      staff_id: staffId || null,
      staff_name: selectedStaff?.name || null,
      total_amount: svc.price,
      deposit_amount: 0,
      platform_fee: fee,
      salon_amount: salonNet,
      status: "confirmed",          // قائم فوراً — العميلة حاضرة
      booking_type: "manual",
      payment_status: "pending",    // مستحق على الصالون تحويله لاحقاً
    }])
    setSaving(false)
    if (error) {
      if (error.message?.includes("duplicate key") || error.code === "23505") {
        toast("⚠ هذا الوقت محجوز بالفعل — اختاري وقتاً آخر")
        setTime("")
        refreshBookedTimes()
      } else {
        toast("⚠ حدث خطأ: " + error.message)
      }
      return
    }
    // رسالة واتساب للعميلة
    const waNum = (clientPhone || "").replace(/^0/, "").replace(/[^0-9]/g, "")
    if (waNum) {
      const staffLine = selectedStaff ? `\nمع: ${selectedStaff.name}` : ""
      const msg = encodeURIComponent(
        `🌸 تم تأكيد حجزك عبر بيوتي تيك!\nالخدمة: ${svc.name}${staffLine}\nالوقت: ${time}\nالتاريخ: ${date}`
      )
      setTimeout(() => window.open(`https://wa.me/966${waNum}?text=${msg}`, "_blank"), 600)
    }
    toast("✅ تم تسجيل الحجز اليدوي بنجاح!")
    onCreated()
    onClose()
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:3000, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.cream, borderRadius:"24px 24px 0 0", padding:"20px 18px", width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>🖐️ حجز يدوي — عميلة حاضرة بالصالون</div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", border:"none", background:T.white, cursor:"pointer", fontSize:14 }}>✕</button>
        </div>

        {loadingSvcs && <div style={{ textAlign:"center", padding:20, color:T.inkSoft }}>...جاري التحميل</div>}

        {!loadingSvcs && (
          <>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:6 }}>الخدمة *</label>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
              {services.map(s => (
                <button key={s.id} onClick={() => { setSvc(s); setTime(""); setStaffId("") }}
                  style={{ display:"flex", justifyContent:"space-between", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${svc?.id===s.id ? T.roseDp : T.creamDk}`, background:svc?.id===s.id ? T.roseL : T.white, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{s.name}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:T.gold }}>{s.price} ر.س</span>
                </button>
              ))}
              {services.length === 0 && <div style={{ fontSize:12, color:T.inkSoft, textAlign:"center", padding:10 }}>أضيفي خدمات أولاً من تبويب الخدمات</div>}
            </div>

            {staffList.length > 0 && (
              <>
                <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:6 }}>مع الموظفة (اختياري)</label>
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                  <button onClick={() => { setStaffId(""); setTime("") }}
                    style={{ display:"flex", justifyContent:"space-between", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${!staffId ? T.roseDp : T.creamDk}`, background:!staffId ? T.roseL : T.white, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>بدون تحديد</span>
                  </button>
                  {staffList.map(st => (
                    <button key={st.id} onClick={() => { setStaffId(st.id); setTime("") }}
                      style={{ display:"flex", justifyContent:"space-between", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${staffId===st.id ? T.roseDp : T.creamDk}`, background:staffId===st.id ? T.roseL : T.white, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                      <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{st.name}</span>
                      {st.specialty && <span style={{ fontSize:11, color:T.inkSoft }}>{st.specialty}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:6 }}>التاريخ *</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setTime("") }}
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${T.creamDk}`, borderRadius:10, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.white, marginBottom:14 }} />

            {svc && (
              <>
                <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:6 }}>الوقت المتاح *</label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:14 }}>
                  {availableTimes.map(t => (
                    <button key={t} onClick={() => setTime(t)}
                      style={{ padding:"8px 4px", borderRadius:8, border:`1.5px solid ${time===t ? T.roseDp : T.creamDk}`, background:time===t ? T.roseL : T.white, color:time===t ? T.roseDp : T.ink, fontSize:11, fontWeight:time===t?700:400, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                      {t}
                    </button>
                  ))}
                  {availableTimes.length === 0 && <div style={{ gridColumn:"span 4", fontSize:12, color:T.red, textAlign:"center", padding:8 }}>لا توجد أوقات متاحة بهذا اليوم</div>}
                </div>
              </>
            )}

            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:6 }}>اسم العميلة *</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="مثال: سارة الأحمد"
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${T.creamDk}`, borderRadius:10, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.white, marginBottom:14 }} />

            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:6 }}>رقم جوالها *</label>
            <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="05xxxxxxxx"
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${T.creamDk}`, borderRadius:10, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.white, marginBottom:16 }} />

            {svc && (
              <div style={{ background:T.white, borderRadius:12, padding:"12px 14px", marginBottom:16, border:`1.5px solid ${T.goldL}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:8 }}>📋 ملخص الحجز</div>
                {[
                  ["✂️ الخدمة", svc.name, T.ink],
                  ...(staffId ? [["👩‍💼 الموظفة", staffList.find(s=>s.id===staffId)?.name || "", T.ink]] : []),
                  ["⏰ الوقت", time || "—", T.ink],
                  ["💰 المبلغ الكامل", svc.price + " ر.س", T.ink],
                  ["عمولة المنصة (3%)", fee + " ر.س", "#C62828"],
                  ["✅ صافي الصالون", salonNet + " ر.س", T.green],
                ].map(r => (
                  <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0" }}>
                    <span style={{ color:T.inkSoft }}>{r[0]}</span>
                    <span style={{ fontWeight:700, color:r[2] }}>{r[1]}</span>
                  </div>
                ))}
              </div>
            )}

            <PBtn full disabled={!svc || !date || !time || !clientName || !clientPhone || saving} onClick={submit}>
              {saving ? "...جارٍ الحجز" : "✅ تأكيد الحجز"}
            </PBtn>
          </>
        )}
      </div>
    </div>
  )
}


/* ══════════════════════════════════════════
   💝 OWNER LOVE GIFTS — حجوزات إهداء المحبة فقط
══════════════════════════════════════════ */
function OwnerLoveGifts({ toast }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data: salon } = await supabase.from('salons').select('id').eq('email', session.user.email)
      if (!salon?.[0]) { setLoading(false); return }
      const { data } = await supabase.from('bookings')
        .select('*')
        .eq('salon_id', salon[0].id)
        .eq('booking_type', 'love_gift')
        .order('appointment_date', { ascending: false })
      setBookings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
    if (error) { toast("⚠ تعذّر تحديث الحجز: " + error.message); return }
    setBookings(b => b.map(bk => bk.id === id ? { ...bk, status } : bk))
    toast(status === "completed" ? "✅ تم تحديد الحجز كمكتمل" : "تم إلغاء الحجز")
  }

  const STATUS = {
    pending:   { label:"قيد الانتظار", color:T.gold,    bg:T.goldPale },
    confirmed: { label:"مؤكد",         color:T.green,   bg:T.greenL },
    completed: { label:"مكتمل",        color:T.inkSoft, bg:T.creamDk },
    cancelled: { label:"ملغي",         color:T.red,     bg:T.redL },
  }

  const totalReceived = bookings.filter(b=>b.status==="completed").reduce((s,b) => s + calcCommission(b).salonGet, 0)

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:4 }}>💝 إهداء المحبة</div>
      <div style={{ fontSize:11, color:T.inkSoft, marginBottom:16 }}>حجوزات مدفوعة بالكامل من عميلات تُهدي صاحباتهن</div>

      <div style={{ background:"linear-gradient(135deg,#C2185B,#880E4F)", borderRadius:14, padding:"14px", textAlign:"center", marginBottom:16 }}>
        <div style={{ fontSize:22, fontWeight:900, color:T.white }}>{totalReceived.toLocaleString()} ر.س</div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,.85)", marginTop:3 }}>صافي مستحقاتك من إهداء المحبة (90%)</div>
      </div>

      {loading && <div style={{ textAlign:"center", padding:30, color:T.inkSoft }}>...جاري التحميل</div>}
      {!loading && bookings.length === 0 && <Empty icon="💝" title="لا توجد حجوزات إهداء محبة" desc="ستظهر هنا فور وصول إهداء جديد" />}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {bookings.map(bk => {
          const st = STATUS[bk.status] || STATUS.pending
          const { fee, salonGet } = calcCommission(bk)
          return (
            <Card key={bk.id} style={{ padding:14, border:"2px solid #F48FB1" }}>
              <div style={{ background:"linear-gradient(135deg,#F48FB1,#E91E63)", borderRadius:"10px 10px 0 0", margin:"-14px -14px 10px -14px", padding:"8px 14px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16 }}>💝</span>
                <span style={{ fontSize:12, fontWeight:800, color:"#fff" }}>إهداء محبة — المبلغ الكامل مدفوع مسبقاً</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{bk.client_name}</div>
                <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{st.label}</span>
              </div>
              <div style={{ fontSize:12, color:T.inkSoft, marginBottom:8 }}>
                {bk.service_name} · 📅 {bk.appointment_date} · ⏰ {bk.appointment_time}
              </div>
              {bk.gift_message && (
                <div style={{ background:"#FCE4EC", borderRadius:10, padding:"8px 12px", marginBottom:10, fontSize:12, color:"#880E4F", fontStyle:"italic" }}>
                  💬 "{bk.gift_message}"
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:10 }}>
                <span style={{ color:T.inkSoft }}>المبلغ الكامل: <span style={{ color:"#E91E63", fontWeight:700 }}>{bk.total_amount} ر.س</span></span>
                <span style={{ color:T.inkSoft }}>صافيك (90%): <span style={{ color:T.green, fontWeight:700 }}>{salonGet} ر.س</span></span>
              </div>
              {bk.status === "pending" && (
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => updateStatus(bk.id, "confirmed")}
                    style={{ flex:2, padding:"8px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.green},#2E7D32)`, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ✓ قبول الحجز
                  </button>
                </div>
              )}
              {bk.status === "confirmed" && (
                <button onClick={() => updateStatus(bk.id, "completed")}
                  style={{ width:"100%", padding:"8px", borderRadius:10, border:"none", background:T.greenL, color:T.green, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  ✅ تم الاستقبال
                </button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function OwnerBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("active")
  const [salonId, setSalonId] = useState(null)
  const [showManual, setShowManual] = useState(false)
  const toast = useToast()

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    // جلب بيانات الصالون أولاً
    const { data: salonData } = await supabase.from('salons').select('id').eq('email', session.user.email)
    if (!salonData || salonData.length === 0) { setLoading(false); return }
    setSalonId(salonData[0].id)
    const { data } = await supabase.from('bookings')
      .select('*')
      .eq('salon_id', salonData[0].id)
      .order('appointment_date', { ascending: true })
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id, status) => {
    const bk = bookings.find(b => b.id === id)
    const isRefundable = status === "cancelled" && bk && bk.booking_type !== "manual" && bk.booking_type !== "love_gift" && (bk.deposit_amount || 0) > 0
    const { error } = await supabase.from('bookings').update({
      status,
      ...(isRefundable ? { refund_status: "pending", payment_status: "refund_due" } : {})
    }).eq('id', id)
    if (error) { toast("⚠ تعذّر تحديث الحجز: " + error.message); return }
    setBookings(b => b.map(bk2 => bk2.id === id ? { ...bk2, status, ...(isRefundable ? { refund_status: "pending", payment_status: "refund_due" } : {}) } : bk2))
    if (isRefundable) {
      toast("تم إلغاء الحجز — سيتم استرجاع العربون (" + (bk.deposit_amount||0) + " ر.س) للعميلة")
    } else {
      toast(status === "completed" ? "✅ تم تحديد الحجز كمكتمل" : "تم إلغاء الحجز")
    }
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
      <div style={{ marginBottom:14 }}>
        <PBtn full onClick={() => setShowManual(true)}>
          🖐️ تسجيل حجز يدوي (عميلة حاضرة بالصالون)
        </PBtn>
      </div>
      {showManual && salonId && (
        <ManualBookingModal salonId={salonId} toast={toast}
          onClose={() => setShowManual(false)}
          onCreated={load} />
      )}

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
            <Card key={bk.id} style={{ padding:14, border: bk.booking_type==="love_gift" ? "2px solid #F48FB1" : bk.booking_type==="manual" ? "2px solid #64B5F6" : bk.booking_type==="voucher" ? `2px solid ${T.greenL}` : bk.booking_type==="offer" ? `2px solid ${T.roseL}` : bk.booking_type==="package" ? `2px solid ${T.goldL}` : "none" }}>
              {/* شريط مميز لإهداء المحبة */}
              {bk.booking_type === "love_gift" && (
                <div style={{ background:"linear-gradient(135deg,#F48FB1,#E91E63)", borderRadius:"10px 10px 0 0", margin:"-14px -14px 10px -14px", padding:"8px 14px", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>💝</span>
                  <span style={{ fontSize:12, fontWeight:800, color:"#fff" }}>إهداء محبة — المبلغ الكامل مدفوع مسبقاً</span>
                </div>
              )}
              {bk.booking_type === "manual" && (
                <div style={{ background:"linear-gradient(135deg,#64B5F6,#1976D2)", borderRadius:"10px 10px 0 0", margin:"-14px -14px 10px -14px", padding:"8px 14px", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>🖐️</span>
                  <span style={{ fontSize:12, fontWeight:800, color:"#fff" }}>حجز يدوي — عميلة حضرت بالصالون</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{bk.client_name}</div>
                <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{st.label}</span>
              </div>
              <div style={{ fontSize:12, color:T.inkSoft, marginBottom:4 }}>
                {bk.booking_type === "offer" ? "🏷️ عرض خاص" : bk.booking_type === "package" ? "🎁 باقة" : bk.booking_type === "love_gift" ? "💝 إهداء محبة" : bk.booking_type === "manual" ? "🖐️ حجز يدوي" : bk.booking_type === "voucher" ? "🎟️ قسيمة هدية" : "✂️ خدمة"} {bk.service_name && `· ${bk.service_name}`}
              </div>
              <div style={{ fontSize:11, color:T.inkMuted, marginBottom:2 }}>
                🕐 تاريخ الحجز: {bk.created_at ? new Date(bk.created_at).toLocaleDateString('ar-SA') : "—"}
              </div>
              <div style={{ fontSize:12, color:T.inkSoft, marginBottom:8 }}>
                📞 {bk.client_phone} · 📅 {bk.appointment_date} · ⏰ {bk.appointment_time}
                {bk.staff_name && <> · 👩‍💼 {bk.staff_name}</>}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:10 }}>
                {(() => {
                  const { fee, salonGet, depositPaid } = calcCommission(bk)
                  const isLove = bk.booking_type === "love_gift"
                  const isManual = bk.booking_type === "manual"
                  if (isLove) return (
                    <>
                      <span style={{ color:T.inkSoft }}>المبلغ الكامل: <span style={{ color:"#E91E63", fontWeight:700 }}>{bk.total_amount} ر.س</span></span>
                      <span style={{ color:T.inkSoft }}>صافيك (90%): <span style={{ color:T.green, fontWeight:700 }}>{salonGet} ر.س</span></span>
                    </>
                  )
                  if (isManual) return (
                    <>
                      <span style={{ color:T.inkSoft }}>المبلغ المستلم كاش: <span style={{ color:"#1976D2", fontWeight:700 }}>{bk.total_amount} ر.س</span></span>
                      <span style={{ color:T.inkSoft }}>عمولة المنصة (3%): <span style={{ color:"#C62828", fontWeight:700 }}>{fee} ر.س</span></span>
                    </>
                  )
                  return (
                    <>
                      <span style={{ color:T.inkSoft }}>العربون: <span style={{ color:T.gold, fontWeight:700 }}>{depositPaid} ر.س</span></span>
                      <span style={{ color:T.inkSoft }}>صافيك: <span style={{ color:T.green, fontWeight:700 }}>{salonGet} ر.س</span></span>
                    </>
                  )
                })()}
              </div>
              {bk.status === "pending" && (
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => updateStatus(bk.id, "confirmed")}
                    style={{ flex:2, padding:"8px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.green},#2E7D32)`, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ✓ قبول الحجز
                  </button>
                  <button onClick={() => updateStatus(bk.id, "cancelled")}
                    style={{ flex:1, padding:"8px", borderRadius:10, border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ❌ رفض
                  </button>
                </div>
              )}
              {bk.status === "confirmed" && (
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => updateStatus(bk.id, "completed")}
                    style={{ flex:2, padding:"8px", borderRadius:10, border:"none", background:T.greenL, color:T.green, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ✅ تم الاستقبال
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



function DetailModal({ type, bookings, today, onClose }) {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")

  const titles = { revenue:"💰 الإيرادات", today:"📅 حجوزات اليوم", all:"📊 كل الحجوزات", clients:"👤 العملاء" }

  // فلترة حسب التاريخ والبحث
  const filtered = bookings.filter(b => {
    if (dateFrom && b.appointment_date < dateFrom) return false
    if (dateTo && b.appointment_date > dateTo) return false
    if (search) {
      const s = search.toLowerCase()
      return (b.client_name||"").toLowerCase().includes(s) || (b.client_phone||"").includes(s)
    }
    return true
  })

  const getItems = () => {
    if (type === "revenue") {
      const completed = filtered.filter(b => b.status === "completed")
      const total = completed.reduce((s,b) => s+(b.total_amount||0), 0)
      return { list: completed.map(b => ({
        label: b.client_name || "عميلة",
        value: (b.total_amount||0) + " ر.س",
        sub: `📅 ${b.appointment_date} · ⏰ ${b.appointment_time||""} · حُجز: ${b.created_at ? new Date(b.created_at).toLocaleDateString("ar-SA") : ""}`,
        tag: b.service_name
      })), total: total + " ر.س إجمالي" }
    }
    if (type === "today") {
      const tod = filtered.filter(b => b.appointment_date === today)
      return { list: tod.map(b => ({
        label: b.client_name || "عميلة",
        value: b.appointment_time || "",
        sub: `${b.service_name || ""} · ${b.status === "completed" ? "✅ مكتمل" : b.status === "cancelled" ? "❌ ملغي" : "⏳ انتظار"}`,
        tag: null
      })), total: null }
    }
    if (type === "all") {
      return { list: filtered.map(b => ({
        label: b.client_name || "عميلة",
        value: (b.total_amount||0) + " ر.س",
        sub: `📅 ${b.appointment_date} · ⏰ ${b.appointment_time||""} · ${b.status==="completed"?"✅ مكتمل":b.status==="cancelled"?"❌ ملغي":"⏳ انتظار"} · حُجز: ${b.created_at ? new Date(b.created_at).toLocaleDateString("ar-SA") : ""}`,
        tag: b.service_name
      })), total: filtered.length + " حجز" }
    }
    if (type === "clients") {
      const unique = [...new Set(filtered.map(b => b.client_phone))]
      return { list: unique.map(phone => {
        const bks = filtered.filter(b => b.client_phone === phone)
        const lastBk = bks[0]
        return {
          label: lastBk?.client_name || "عميلة",
          value: bks.length + " حجز",
          sub: `📞 ${phone} · آخر زيارة: ${lastBk?.appointment_date || ""}`,
          tag: null
        }
      }), total: unique.length + " عميلة" }
    }
    return { list: [], total: null }
  }

  const { list, total } = getItems()

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(44,32,24,.5)", zIndex:3000, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:T.white, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:560, maxHeight:"88vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        
        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.creamDk}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>{titles[type]}</div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:14 }}>✕</button>
        </div>

        {/* فلاتر */}
        <div style={{ padding:"12px 20px", borderBottom:`1px solid ${T.creamDk}`, background:T.cream }}>
          {(type === "all" || type === "revenue") && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div>
                <label style={{ fontSize:10, color:T.inkSoft, display:"block", marginBottom:3 }}>من تاريخ</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ width:"100%", padding:"7px 10px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white }} />
              </div>
              <div>
                <label style={{ fontSize:10, color:T.inkSoft, display:"block", marginBottom:3 }}>إلى تاريخ</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ width:"100%", padding:"7px 10px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white }} />
              </div>
            </div>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={type === "clients" ? "ابحث بالاسم أو الجوال..." : "ابحث بالاسم..."}
            style={{ width:"100%", padding:"8px 12px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.white, outline:"none" }} />
        </div>

        {/* القائمة */}
        <div style={{ overflowY:"auto", flex:1 }}>
          {list.length === 0 && (
            <div style={{ textAlign:"center", padding:30, color:T.inkSoft }}>لا توجد نتائج</div>
          )}
          {list.map((it, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"12px 20px", borderBottom:`1px solid ${T.creamDk}` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{it.label}</div>
                {it.tag && <div style={{ fontSize:11, color:T.roseDp, marginTop:1 }}>{it.tag}</div>}
                {it.sub && <div style={{ fontSize:11, color:T.inkSoft, marginTop:2, lineHeight:1.6 }}>{it.sub}</div>}
              </div>
              {it.value && <div style={{ fontSize:14, fontWeight:800, color:T.roseDp, marginRight:8, flexShrink:0 }}>{it.value}</div>}
            </div>
          ))}
        </div>

        {/* الإجمالي */}
        {total && (
          <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.creamDk}`, background:T.cream, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>الإجمالي</span>
            <span style={{ fontSize:15, fontWeight:900, color:T.roseDp }}>{total}</span>
          </div>
        )}
      </div>
    </div>
  )
}



function SalesChart({ salonId }) {
  const [data, setData] = useState([])
  const [allBks, setAllBks] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!salonId) { setLoading(false); return }
    supabase.from('bookings').select('*')
      .eq('salon_id', salonId)
      .order('appointment_date', { ascending:false })
      .limit(60)
      .then(({ data: bks }) => {
        if (!bks) { setLoading(false); return }
        setAllBks(bks)
        const days = {}
        bks.forEach(b => {
          const d = b.appointment_date || ""
          if (!d) return
          if (!days[d]) days[d] = { date:d, revenue:0, count:0 }
          if (b.status === "completed") days[d].revenue += b.total_amount || 0
          days[d].count++
        })
        setData(Object.values(days).sort((a,b) => a.date.localeCompare(b.date)).slice(-14))
        setLoading(false)
      })
  }, [salonId])

  if (loading) return null
  if (data.length === 0 || data.every(d => d.count === 0)) return null

  const maxRev = Math.max(...data.map(d => d.revenue), 1)
  const selectedBks = selectedDay ? allBks.filter(b => b.appointment_date === selectedDay) : []
  const STATUS = { pending:"⏳ انتظار", confirmed:"✓ مؤكد", completed:"✅ مكتمل", cancelled:"❌ ملغي" }

  return (
    <div>
      <Card style={{ padding:16, marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:4 }}>📊 المبيعات اليومية — آخر 14 يوم</div>
        <div style={{ fontSize:11, color:T.inkSoft, marginBottom:14 }}>اضغط على اليوم لعرض تفاصيله</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:110 }}>
          {data.map((d, i) => (
            <div key={i} onClick={() => setSelectedDay(selectedDay === d.date ? null : d.date)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer" }}>
              <div style={{ fontSize:8, color:T.gold, fontWeight:700 }}>{d.revenue > 0 ? d.revenue : ""}</div>
              <div style={{
                width:"100%",
                height: Math.max((d.revenue/maxRev)*80, d.count > 0 ? 8 : 4),
                background: selectedDay === d.date ? T.gold : d.revenue > 0 ? `linear-gradient(180deg,${T.gold},${T.goldL})` : T.creamDk,
                borderRadius:"6px 6px 0 0", transition:"all .3s",
                border: selectedDay === d.date ? `2px solid ${T.gold}` : "none"
              }} />
              <div style={{ fontSize:8, color: selectedDay === d.date ? T.gold : T.inkSoft, fontWeight: selectedDay === d.date ? 700 : 400, whiteSpace:"nowrap" }}>
                {d.date.slice(5)}
              </div>
              {d.count > 0 && <div style={{ fontSize:7, color:T.inkSoft }}>{d.count}</div>}
            </div>
          ))}
        </div>
      </Card>

      {selectedDay && selectedBks.length > 0 && (
        <Card style={{ padding:16, marginBottom:14, border:`2px solid ${T.goldL}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:12 }}>
            📅 تفاصيل {selectedDay} ({selectedBks.length} حجز)
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {selectedBks.map(bk => (
              <div key={bk.id} style={{ background:T.cream, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{bk.client_name}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:T.gold }}>{bk.total_amount || 0} ر.س</div>
                </div>
                <div style={{ fontSize:11, color:T.inkSoft }}>
                  ⏰ {bk.appointment_time} · {bk.service_name || "خدمة"}
                </div>
                <div style={{ fontSize:11, color:T.inkSoft }}>
                  {STATUS[bk.status] || bk.status}
                  {bk.created_at && ` · حُجز: ${new Date(bk.created_at).toLocaleDateString("ar-SA")}`}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, padding:"10px 12px", background:T.white, borderRadius:10, display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, fontWeight:700, color:T.ink }}>إيرادات اليوم</span>
            <span style={{ fontSize:14, fontWeight:900, color:T.gold }}>
              {selectedBks.filter(b => b.status==="completed").reduce((s,b) => s+(b.total_amount||0), 0)} ر.س
            </span>
          </div>
        </Card>
      )}
    </div>
  )
}

function MonthlyChart({ salonId }) {
  const [data, setData] = useState([])
  const [allBks, setAllBks] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!salonId) { setLoading(false); return }
    supabase.from('bookings')
      .select('*')
      .eq('salon_id', salonId)
      .order('appointment_date', { ascending: false })
      .then(({ data: bks }) => {
        if (!bks) { setLoading(false); return }
        setAllBks(bks)
        const months = {}
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
          const label = d.toLocaleDateString('ar-SA', { month:'short', year:'2-digit' })
          months[key] = { key, label, revenue:0, count:0 }
        }
        bks.forEach(b => {
          const key = (b.appointment_date || "").slice(0,7)
          if (months[key]) {
            if (b.status === 'completed') months[key].revenue += b.total_amount || 0
            months[key].count++
          }
        })
        setData(Object.values(months))
        setLoading(false)
      })
  }, [salonId])

  if (loading) return <Card style={{ padding:16, marginBottom:14 }}><div style={{ textAlign:"center", color:T.inkSoft }}>...جاري التحميل</div></Card>
  if (data.length === 0 || data.every(d => d.count === 0)) return null

  const maxRev = Math.max(...data.map(d => d.revenue), 1)
  const selectedBks = selectedMonth ? allBks.filter(b => (b.appointment_date||"").startsWith(selectedMonth)) : []

  const STATUS = { pending:"انتظار", confirmed:"مؤكد", completed:"مكتمل", cancelled:"ملغي" }

  return (
    <div>
      <Card style={{ padding:16, marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:4 }}>📈 الإيرادات — آخر 6 أشهر</div>
        <div style={{ fontSize:11, color:T.inkSoft, marginBottom:14 }}>اضغط على الشهر لعرض تفاصيله</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:110 }}>
          {data.map((d, i) => (
            <div key={i} onClick={() => setSelectedMonth(selectedMonth === d.key ? null : d.key)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer" }}>
              <div style={{ fontSize:9, color:T.roseDp, fontWeight:700 }}>{d.revenue > 0 ? d.revenue+"ر" : ""}</div>
              <div style={{ width:"100%", height: Math.max((d.revenue/maxRev)*80, d.count > 0 ? 8 : 4),
                background: selectedMonth === d.key ? T.roseDp : d.revenue > 0 ? `linear-gradient(180deg,${T.rose},${T.roseL})` : T.creamDk,
                borderRadius:"6px 6px 0 0", transition:"all .3s",
                border: selectedMonth === d.key ? `2px solid ${T.roseDp}` : "none"
              }} />
              <div style={{ fontSize:9, color: selectedMonth === d.key ? T.roseDp : T.inkSoft, fontWeight: selectedMonth === d.key ? 700 : 400 }}>{d.label}</div>
              {d.count > 0 && <div style={{ fontSize:8, color:T.inkSoft }}>{d.count}</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* تفاصيل الشهر المختار */}
      {selectedMonth && selectedBks.length > 0 && (
        <Card style={{ padding:16, marginBottom:14, border:`2px solid ${T.roseL}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:12 }}>
            تفاصيل {data.find(d => d.key === selectedMonth)?.label} ({selectedBks.length} حجز)
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {selectedBks.map(bk => (
              <div key={bk.id} style={{ background:T.cream, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{bk.client_name}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:T.roseDp }}>{bk.total_amount || 0} ر.س</div>
                </div>
                <div style={{ fontSize:11, color:T.inkSoft }}>
                  📅 {bk.appointment_date} · ⏰ {bk.appointment_time}
                </div>
                <div style={{ fontSize:11, color:T.inkSoft }}>
                  {bk.service_name && `✂️ ${bk.service_name} · `}
                  {STATUS[bk.status] || bk.status}
                  {bk.created_at && ` · حُجز: ${new Date(bk.created_at).toLocaleDateString('ar-SA')}`}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, padding:"10px 12px", background:T.white, borderRadius:10, display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, fontWeight:700, color:T.ink }}>إجمالي الإيرادات</span>
            <span style={{ fontSize:14, fontWeight:900, color:T.roseDp }}>
              {selectedBks.filter(b => b.status==="completed").reduce((s,b) => s+(b.total_amount||0), 0)} ر.س
            </span>
          </div>
        </Card>
      )}
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
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>{st.label}</span>
                  {bk.booking_type === "offer" && <span style={{ background:T.roseL, color:T.roseDp, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>🏷️ عرض</span>}
                  {bk.booking_type === "love_gift" && <span style={{ background:"#FCE4EC", color:"#E91E63", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>💝 إهداء محبة</span>}
                  {bk.booking_type === "voucher" && <span style={{ background:T.greenL, color:T.green, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>🎟️ قسيمة</span>}
                  {bk.booking_type === "package" && <span style={{ background:T.goldPale, color:T.gold, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>🎁 باقة</span>}
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
  const [ownerStats, setOwnerStats] = useState({ revenue:0, todayBookings:0, totalBookings:0, clients:0, salonId:null })
  const [detailModal, setDetailModal] = useState(null)
  const [allBookings, setAllBookings] = useState([])
  const [statsLoaded, setStatsLoaded] = useState(false)

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
        setOwnerStats({ revenue, todayBookings: todayB, totalBookings: bookings.length, clients, salonId })
        setAllBookings(bookings)
        setStatsLoaded(true)
      }
    }
    load()
  }, [])

  const today = new Date().toISOString().split('T')[0]

  // Modal للتفاصيل
  return (
    <div>
      {detailModal && (
        <DetailModal
          type={detailModal}
          bookings={allBookings}
          today={today}
          onClose={() => setDetailModal(null)}
        />
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        {[
          { l:"إيرادات الشهر", v: ownerStats.revenue + " ر.س", s: ownerStats.revenue > 0 ? "من الحجوزات" : "لا توجد بيانات", gold:true, modal:"revenue" },
          { l:"حجوزات اليوم",  v: ownerStats.todayBookings, s: ownerStats.todayBookings > 0 ? "حجز اليوم" : "لا توجد حجوزات", modal:"today" },
          { l:"إجمالي الحجوزات", v: ownerStats.totalBookings, s:"كل الحجوزات", modal:"all" },
          { l:"عملاء",    v: ownerStats.clients, s:"مسجلين", modal:"clients" },
        ].map(st => (
          <div key={st.l}
            onClick={() => setDetailModal(st.modal)}
            style={{ padding:14, background:st.gold ? `linear-gradient(135deg,${T.gold},${T.gold2})` : T.white, cursor:"pointer", borderRadius:16, boxShadow:"0 2px 8px rgba(44,32,24,.08)" }}>
            <div style={{ fontSize:11, color:st.gold ? "rgba(255,255,255,.8)" : T.inkSoft, marginBottom:5, fontWeight:600 }}>{st.l}</div>
            <div style={{ fontSize:24, fontWeight:900, color:st.gold ? T.white : T.ink }}>{st.v}</div>
            <div style={{ fontSize:11, color:st.gold ? "rgba(255,255,255,.7)" : T.rose, marginTop:3 }}>{st.s}</div>
            <div style={{ fontSize:10, color:st.gold ? "rgba(255,255,255,.5)" : T.roseDp, marginTop:4, fontWeight:600 }}>← التفاصيل</div>
          </div>
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
      <MonthlyChart salonId={ownerStats.salonId} />
      <SalesChart salonId={ownerStats.salonId} />

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

/* ══════════════════════════════════════════
   🕐 OWNER HOURS — أوقات عمل الصالون الرئيسية
   جدول دوام عام يغطي كل أيام وساعات عمل الصالون
══════════════════════════════════════════ */
function OwnerHours({ toast }) {
  const [salonId, setSalonId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const HOUR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]
  const HOUR_TIMES = ["00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30","05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"]

  const defaultSchedule = () => {
    const sched = {}
    HOUR_DAYS.forEach(d => { sched[d] = { open: true, from: "09:00", to: "21:00" } })
    return sched
  }

  const [schedule, setSchedule] = useState(defaultSchedule())

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data } = await supabase.from('salons').select('id, working_hours').eq('email', session.user.email)
      if (data?.[0]) {
        setSalonId(data[0].id)
        if (data[0].working_hours) {
          setSchedule({ ...defaultSchedule(), ...data[0].working_hours })
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const toggleDayOpen = (day) => {
    setSchedule(s => ({ ...s, [day]: { ...s[day], open: !s[day].open } }))
  }
  const setDayTime = (day, key, value) => {
    setSchedule(s => ({ ...s, [day]: { ...s[day], [key]: value } }))
  }
  const applyToAll = (from, to) => {
    setSchedule(s => {
      const next = { ...s }
      HOUR_DAYS.forEach(d => { next[d] = { ...next[d], from, to } })
      return next
    })
  }

  const save = async () => {
    if (!salonId) return
    setSaving(true)
    const { error } = await supabase.from('salons').update({ working_hours: schedule }).eq('id', salonId)
    setSaving(false)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    toast("✅ تم حفظ أوقات العمل!")
  }

  if (loading) return <div style={{ textAlign:"center", padding:40, color:T.inkSoft }}>...جاري التحميل</div>

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:4 }}>🕐 أوقات عمل الصالون</div>
      <div style={{ fontSize:11, color:T.inkSoft, marginBottom:16 }}>حددي أيام وساعات دوام الصالون بشكل عام — هذا يساعد العميلات على معرفة متى تقدر تحجز</div>

      <div style={{ background:T.goldPale, borderRadius:12, padding:"12px 14px", marginBottom:16, border:`1px solid ${T.goldL}` }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:8 }}>⚡ تطبيق سريع على كل الأيام</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[["09:00","21:00","9ص - 9م"],["10:00","22:00","10ص - 10م"],["08:00","20:00","8ص - 8م"]].map(p => (
            <button key={p[2]} onClick={() => applyToAll(p[0], p[1])}
              style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${T.gold}`, background:T.white, color:T.gold, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              {p[2]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
        {HOUR_DAYS.map(day => {
          const d = schedule[day] || { open:true, from:"09:00", to:"21:00" }
          return (
            <div key={day} style={{ background:T.white, borderRadius:12, padding:"12px 14px", border:`1.5px solid ${d.open ? T.creamDk : T.redL}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:d.open ? 10 : 0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{day}</div>
                <button onClick={() => toggleDayOpen(day)}
                  style={{ padding:"5px 14px", borderRadius:20, border:"none", background:d.open ? T.greenL : T.redL, color:d.open ? T.green : T.red, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {d.open ? "✓ مفتوح" : "✕ مغلق"}
                </button>
              </div>
              {d.open && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <label style={{ fontSize:10, color:T.inkSoft, display:"block", marginBottom:3 }}>من</label>
                    <select value={d.from} onChange={e => setDayTime(day, "from", e.target.value)}
                      style={{ width:"100%", padding:"7px 8px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.cream }}>
                      {HOUR_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:T.inkSoft, display:"block", marginBottom:3 }}>إلى</label>
                    <select value={d.to} onChange={e => setDayTime(day, "to", e.target.value)}
                      style={{ width:"100%", padding:"7px 8px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.cream }}>
                      {HOUR_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <PBtn full disabled={saving} onClick={save}>{saving ? "...جارٍ الحفظ" : "💾 حفظ أوقات العمل"}</PBtn>
    </div>
  )
}

function OwnerInventory({ toast }) {
  const [items, setItems] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [editItemId, setEditItemId] = useState(null)
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
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={() => setEditItemId(item.id === editItemId ? null : item.id)}
                  style={{ width:24, height:24, borderRadius:"50%", border:`1px solid ${T.goldL}`, background:T.goldPale, color:T.gold, fontSize:12, cursor:"pointer" }}>✏</button>
                <button onClick={() => setItems(i => i.filter(x => x.id !== item.id))}
                  style={{ width:24, height:24, borderRadius:"50%", border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:12, cursor:"pointer" }}>✕</button>
              </div>
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
            {editItemId === item.id && (
              <div style={{ marginTop:10, background:T.goldPale, borderRadius:10, padding:"12px", border:`1px solid ${T.goldL}` }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:8 }}>✏ تعديل المنتج</div>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:8, marginBottom:8 }}>
                  <input value={item.n} onChange={e => setItems(i => i.map(x => x.id === item.id ? { ...x, n:e.target.value } : x))}
                    placeholder="اسم المنتج"
                    style={{ padding:"8px 10px", border:`1.5px solid ${T.gold}`, borderRadius:8, fontSize:13, color:T.ink, background:T.white, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
                  <input type="number" value={item.total} onChange={e => setItems(i => i.map(x => x.id === item.id ? { ...x, total:Number(e.target.value) } : x))}
                    placeholder="الكمية"
                    style={{ padding:"8px 10px", border:`1.5px solid ${T.gold}`, borderRadius:8, fontSize:13, color:T.ink, background:T.white, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
                </div>
                <button onClick={() => { setEditItemId(null); toast("✅ تم تعديل المنتج") }}
                  style={{ width:"100%", padding:"8px", borderRadius:8, border:"none", background:T.gold, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  ✓ حفظ التعديل
                </button>
              </div>
            )}
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
const SERVICE_CATEGORIES = ["قص شعر","صبغ","مكياج","عناية بشرة","أظافر","رموش","حناء","كيراتين"]
const ALL_TIMES = ["00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30","05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"]

function OwnerServices({ toast }) {
  const [services, setServices] = useState([])
  const [loadingSvcs, setLoadingSvcs] = useState(true)

  const [ownerSalonId, setOwnerSalonId] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingSvcs(false); return }
      const { data: salon } = await supabase.from('salons').select('id').eq('email', session.user.email)
      if (!salon || !salon[0]) { setLoadingSvcs(false); return }
      const sid = salon[0].id
      setOwnerSalonId(sid)
      const { data: svcs } = await supabase.from('services').select('*').eq('salon_id', sid)
      if (svcs) setServices(svcs.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price,
        category: s.category || "",
        duration: s.duration || 60,
        active: s.active !== false,
        days: s.days || [],
        timeFrom: s.time_from || "09:00",
        timeTo: s.time_to || "18:00",
      })))
      setLoadingSvcs(false)
    }
    load()
  }, [])
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editSvc, setEditSvc] = useState(null)
  const [newSvc, setNewSvc] = useState({ name:"", price:"", category:"", duration:60, days:["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"], timeFrom:"09:00", timeTo:"18:00" })
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
    if (!ownerSalonId) { toast("⚠ لم يتم التعرف على الصالون"); return }
    const { data, error } = await supabase.from('services').insert([{
      salon_id: ownerSalonId,
      name: newSvc.name,
      price: Number(newSvc.price),
      category: newSvc.category || null,
      duration: newSvc.duration,
      days: newSvc.days,
      time_from: newSvc.timeFrom,
      time_to: newSvc.timeTo,
      active: true,
    }]).select()
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    if (data && data[0]) {
      setServices(s => [...s, {
        id: data[0].id,
        name: data[0].name,
        price: data[0].price,
        category: data[0].category || "",
        duration: data[0].duration || 60,
        active: true,
        days: data[0].days || [],
        timeFrom: data[0].time_from || "09:00",
        timeTo: data[0].time_to || "18:00",
      }])
    }
    setNewSvc({ name:"", price:"", duration:60, days:["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"], timeFrom:"09:00", timeTo:"18:00" })
    setShowAdd(false)
    toast("✅ تمت إضافة الخدمة!")
  }

  const toggleActive = (id) => {
    setServices(s => s.map(sv => sv.id === id ? { ...sv, active:!sv.active } : sv))
  }

  const deleteService = async (id) => {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) { toast("⚠ تعذّر حذف الخدمة: " + error.message); return }
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

          {/* التصنيف — يربط الخدمة بالموظفات المتخصصات بها */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:8 }}>تصنيف الخدمة — يحدد أي موظفات يظهرن لهذي الخدمة</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {SERVICE_CATEGORIES.map(c => (
                <button key={c} onClick={() => setNewSvc(s => ({ ...s, category: c }))}
                  style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${newSvc.category===c ? T.roseDp : T.creamDk}`, background:newSvc.category===c ? T.roseL : T.white, color:newSvc.category===c ? T.roseDp : T.inkSoft, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:8 }}>مدة الخدمة</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[30,45,60,90,120,150,180,240,300,360,420,480,540,600].map(d => (
                <button key={d} onClick={() => setNewSvc(s => ({ ...s, duration:d }))}
                  style={{ padding:"7px 14px", borderRadius:20, border:`1.5px solid ${newSvc.duration===d ? T.roseDp : T.creamDk}`, background:newSvc.duration===d ? T.roseL : T.white, color:newSvc.duration===d ? T.roseDp : T.ink, fontSize:12, fontWeight:newSvc.duration===d ? 700 : 400, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {d < 60 ? d+"د" : d%60===0 ? (d/60)+"س" : Math.floor(d/60)+"س"+d%60+"د"}
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


function OwnerOffers({ toast, type = "offer" }) {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [salonId, setSalonId] = useState(null)
  const [form, setForm] = useState({ type, title:"", description:"", original_price:"", discounted_price:"", valid_until:"" })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: salon } = await supabase.from('salons').select('id').eq('email', session.user.email)
      if (!salon || !salon[0]) { setLoading(false); return }
      setSalonId(salon[0].id)
      const { data } = await supabase.from('offers').select('*').eq('salon_id', salon[0].id).eq('type', type).order('created_at', { ascending:false })
      setOffers(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const addOffer = async () => {
    if (!form.title || !form.discounted_price) { toast("⚠ أدخلي العنوان والسعر"); return }
    if (!salonId) { toast("⚠ لم يتم التعرف على الصالون"); return }
    setSaving(true)
    if (editId) {
      // تعديل
      const { error } = await supabase.from('offers').update({
        title: form.title, description: form.description,
        original_price: Number(form.original_price) || null,
        discounted_price: Number(form.discounted_price),
        valid_until: form.valid_until || null,
      }).eq('id', editId)
      setSaving(false)
      if (error) { toast("⚠ " + error.message); return }
      setOffers(o => o.map(x => x.id === editId ? { ...x, ...form, original_price:Number(form.original_price)||null, discounted_price:Number(form.discounted_price) } : x))
      setEditId(null)
      toast("✅ تم التعديل!")
    } else {
      const { data, error } = await supabase.from('offers').insert([{
        salon_id: salonId, type: form.type, title: form.title,
        description: form.description, original_price: Number(form.original_price) || null,
        discounted_price: Number(form.discounted_price), valid_until: form.valid_until || null, active: true,
      }]).select()
      setSaving(false)
      if (error) { toast("⚠ " + error.message); return }
      if (data) setOffers(o => [data[0], ...o])
      toast("✅ تمت الإضافة!")
    }
    setForm({ type, title:"", description:"", original_price:"", discounted_price:"", valid_until:"" })
    setShowAdd(false)
  }

  const deleteOffer = async (id) => {
    const { error } = await supabase.from('offers').delete().eq('id', id)
    if (error) { toast("⚠ تعذّر الحذف: " + error.message); return }
    setOffers(o => o.filter(x => x.id !== id))
    toast("🗑 تم الحذف")
  }

  const toggleOffer = async (id, active) => {
    const { error } = await supabase.from('offers').update({ active: !active }).eq('id', id)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    setOffers(o => o.map(x => x.id === id ? { ...x, active:!active } : x))
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>{type === "offer" ? "🏷️ العروض الخاصة" : "🎁 الباقات"}</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>تظهر للعملاء في صفحة الصالون</div>
        </div>
        <PBtn sm onClick={() => setShowAdd(!showAdd)}>+ إضافة</PBtn>
      </div>

      {showAdd && (
        <Card style={{ padding:16, marginBottom:14, border:`2px solid ${T.roseL}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:12 }}>إضافة عرض أو باقة</div>
          


          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>العنوان *</label>
            <input value={form.title} onChange={set("title")} placeholder={form.type==="offer" ? "مثال: خصم 30% على الصبغ" : "مثال: باقة العروس"}
              style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
          </div>

          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>الوصف</label>
            <textarea value={form.description} onChange={set("description")} placeholder="تفاصيل العرض أو الباقة..." rows={2}
              style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif", resize:"none" }} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>السعر الأصلي (ر.س)</label>
              <input type="number" value={form.original_price} onChange={set("original_price")} placeholder="500"
                style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
            </div>
            <div>
              <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>السعر بعد الخصم *</label>
              <input type="number" value={form.discounted_price} onChange={set("discounted_price")} placeholder="350"
                style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>صالح حتى (اختياري)</label>
            <input type="date" value={form.valid_until} onChange={set("valid_until")}
              style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }} />
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <OBtn onClick={() => setShowAdd(false)}>إلغاء</OBtn>
            <div style={{ flex:1 }}><PBtn full disabled={saving} onClick={addOffer}>{saving ? "...جاري الحفظ" : "✓ إضافة"}</PBtn></div>
          </div>
        </Card>
      )}

      {loading && <div style={{ textAlign:"center", padding:30, color:T.inkSoft }}>...جاري التحميل</div>}
      {!loading && offers.length === 0 && <Empty icon={type==="offer" ? "🏷️" : "🎁"} title={type==="offer" ? "لا توجد عروض بعد" : "لا توجد باقات بعد"} desc="أضيفي واحدة لجذب العملاء" />}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {offers.map(o => {
          const disc = o.original_price ? Math.round((1 - o.discounted_price/o.original_price)*100) : 0
          return (
            <Card key={o.id} style={{ padding:14, opacity:o.active ? 1 : .6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:13 }}>{o.type==="package" ? "📦" : "🏷️"}</span>
                    <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{o.title}</div>
                    {disc > 0 && <span style={{ background:T.redL, color:T.red, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>-{disc}%</span>}
                  </div>
                  {o.description && <div style={{ fontSize:12, color:T.inkSoft, marginBottom:6 }}>{o.description}</div>}
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    {o.original_price && <span style={{ fontSize:12, color:T.inkSoft, textDecoration:"line-through" }}>{o.original_price} ر.س</span>}
                    <span style={{ fontSize:16, fontWeight:900, color:T.roseDp }}>{o.discounted_price} ر.س</span>
                  </div>
                  {o.valid_until && <div style={{ fontSize:11, color:T.inkSoft, marginTop:4 }}>📅 صالح حتى: {o.valid_until}</div>}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => toggleOffer(o.id, o.active)}
                    style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${o.active ? T.green : T.creamDk}`, background:o.active ? T.greenL : T.cream, color:o.active ? T.green : T.inkSoft, fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    {o.active ? "✓ فعّال" : "متوقف"}
                  </button>
                  <button onClick={() => { setForm({ type:o.type, title:o.title, description:o.description||"", original_price:o.original_price||"", discounted_price:o.discounted_price, valid_until:o.valid_until||"" }); setEditId(o.id); setShowAdd(true) }}
                    style={{ width:26, height:26, borderRadius:"50%", border:`1px solid ${T.goldL}`, background:T.goldPale, color:T.gold, fontSize:12, cursor:"pointer" }}>✏</button>
                  <button onClick={() => deleteOffer(o.id)}
                    style={{ width:26, height:26, borderRadius:"50%", border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function OwnerPackage({ toast, onPkgChange }) {
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
    if (newPkg === currentPkg) return
    const pkgOrder = { basic:1, pro:2, elite:3 }
    const isUpgrade = pkgOrder[newPkg] > pkgOrder[currentPkg]
    
    if (!isUpgrade) {
      toast("⚠ لتخفيض الباقة انتظري انتهاء اشتراكك الحالي — سيتم التخفيض تلقائياً عند التجديد")
      return
    }
    
    // ترقية — يدفع الفرق + 200 رسوم ترقية
    const diff = (PKGS.find(p => p.id === newPkg)?.price || 0) - (PKGS.find(p => p.id === currentPkg)?.price || 0)
    const upgradeFee = diff + 100
    
    const confirmMsg = "ترقية من " + (PKGS.find(p=>p.id===currentPkg)?.name||"") + " إلى " + (PKGS.find(p=>p.id===newPkg)?.name||"") + "\n\nرسوم الترقية: " + upgradeFee + " ر.س\n\nللدفع تواصلي: 0552401658"
    const confirm = window.confirm(confirmMsg)
    if (!confirm) return
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { error } = await supabase.from('salons').update({ package: newPkg }).eq('email', session.user.email)
    if (error) { toast("⚠ حدث خطأ أثناء التحديث"); return }
    setCurrentPkg(newPkg)
    // تحديث فوري — الصالون يشوف التغيير مباشرة بدون إعادة تسجيل دخول
    window.location.reload()
    toast("✅ تم تغيير الباقة! ستظهر التغييرات فوراً")
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

      {/* خانة الدفع */}
      <div style={{ marginTop:16, background:T.white, borderRadius:14, padding:"16px", border:`2px solid ${T.roseL}` }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:12 }}>💳 الدفع والترقية</div>
        
        {/* معلومات الدفع */}
        <div style={{ background:T.cream, borderRadius:10, padding:"12px", marginBottom:12 }}>
          <div style={{ fontSize:12, color:T.inkSoft, lineHeight:2 }}>
            <div>📦 باقتك الحالية: <strong style={{ color:T.roseDp }}>{PKGS.find(p=>p.id===currentPkg)?.name}</strong></div>
            <div>💰 رسوم الاشتراك: <strong style={{ color:T.ink }}>{PKGS.find(p=>p.id===currentPkg)?.price?.toLocaleString()} ر.س/{billing==="yearly"?"سنة":"شهر"}</strong></div>
            <div>📅 طريقة التجديد: <strong style={{ color:T.ink }}>{billing==="yearly"?"سنوي (شهر مجاني)":"شهري"}</strong></div>
          </div>
        </div>

        {/* رقم الحساب للتحويل */}
        <div style={{ background:`linear-gradient(135deg,${T.goldPale},#FFFBF0)`, borderRadius:10, padding:"12px 14px", marginBottom:12, border:`1px solid ${T.goldL}` }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:6 }}>🏦 بيانات التحويل</div>
          <div style={{ fontSize:12, color:T.inkSoft, lineHeight:2 }}>
            <div>البنك: <strong style={{ color:T.ink }}>بنك الراجحي</strong></div>
            <div>رقم الآيبان: <strong style={{ color:T.ink, fontSize:13 }}>SA7080000584608016227161</strong></div>
            <div>اسم المستفيد: <strong style={{ color:T.ink }}>بيوتي تيك</strong></div>
          </div>
        </div>

        {/* إرسال إثبات الدفع */}
        <div style={{ fontSize:12, color:T.inkSoft, marginBottom:10 }}>
          بعد التحويل أرسلي إثبات الدفع على واتساب وسيتم تفعيل الباقة خلال ساعة:
        </div>
        <a href="https://wa.me/966552401658?text=السلام عليكم, أرغب في تفعيل/ترقية باقتي في بيوتي تيك. إرفق إثبات الدفع."
          target="_blank" rel="noreferrer"
          style={{ display:"block", width:"100%", padding:"12px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.green},#1B5E20)`, color:T.white, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif", textAlign:"center", textDecoration:"none" }}>
          📲 إرسال إثبات الدفع على واتساب
        </a>
        <div style={{ textAlign:"center", marginTop:8, fontSize:11, color:T.inkSoft }}>
          أو اتصلي: 0552401658
        </div>
      </div>
    </div>
  )
}







function OwnerCalendar({ toast }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  // تنسيق محلي للتاريخ (يتجنب مشاكل تحويل UTC التي تُزحزح اليوم)
  const toLocalDateStr = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 6) // السبت
    return d
  })

  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() - 6 + i)
    return d
  })

  useEffect(() => { loadBookings() }, [weekStart])

  const loadBookings = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const { data: salon } = await supabase.from("salons").select("id").eq("email", session.user.email)
    if (!salon?.[0]) { setLoading(false); return }
    const from = toLocalDateStr(days[0])
    const to = toLocalDateStr(days[6])
    const { data } = await supabase.from("bookings").select("*")
      .eq("salon_id", salon[0].id)
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .order("appointment_time")
    setBookings(data || [])
    setLoading(false)
  }

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d) }

  const DAY_NAMES_BY_JS_INDEX = ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"] // getDay(): 0=أحد ... 6=سبت
  const STATUS_COLORS = { pending:T.gold, confirmed:T.green, completed:T.inkSoft, cancelled:T.red }

  const today = toLocalDateStr(new Date())

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:4 }}>📅 جدول المواعيد</div>
      <div style={{ fontSize:11, color:T.inkSoft, marginBottom:14 }}>عرض أسبوعي لكل حجوزاتك</div>

      {/* تنقل الأسبوع */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <button onClick={prevWeek} style={{ width:36, height:36, borderRadius:"50%", border:`1px solid ${T.creamDk}`, background:T.white, cursor:"pointer", fontSize:16 }}>‹</button>
        <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>
          {days[0].toLocaleDateString("ar-SA", { month:"short", day:"numeric" })} — {days[6].toLocaleDateString("ar-SA", { month:"short", day:"numeric", year:"numeric" })}
        </div>
        <button onClick={nextWeek} style={{ width:36, height:36, borderRadius:"50%", border:`1px solid ${T.creamDk}`, background:T.white, cursor:"pointer", fontSize:16 }}>›</button>
      </div>

      {loading && <div style={{ textAlign:"center", padding:30, color:T.inkSoft }}>...جاري التحميل</div>}

      {/* أيام الأسبوع */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {days.map((day, i) => {
          const dateStr = toLocalDateStr(day)
          const dayBks = bookings.filter(b => b.appointment_date === dateStr)
          const isToday = dateStr === today
          return (
            <div key={i} style={{ background:T.white, borderRadius:14, overflow:"hidden", border:`2px solid ${isToday ? T.roseDp : T.creamDk}` }}>
              {/* هيدر اليوم */}
              <div style={{ padding:"10px 14px", background:isToday ? T.roseL : T.cream, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:isToday ? T.roseDp : T.ink }}>{DAY_NAMES_BY_JS_INDEX[day.getDay()]}</div>
                  <div style={{ fontSize:11, color:T.inkSoft }}>{day.toLocaleDateString("ar-SA", { month:"short", day:"numeric" })}</div>
                  {isToday && <span style={{ background:T.roseDp, color:T.white, fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>اليوم</span>}
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:dayBks.length > 0 ? T.roseDp : T.inkSoft }}>
                  {dayBks.length > 0 ? dayBks.length + " حجز" : "لا حجوزات"}
                </div>
              </div>
              {/* حجوزات اليوم */}
              {dayBks.length > 0 && (
                <div style={{ padding:"8px 14px", display:"flex", flexDirection:"column", gap:6 }}>
                  {dayBks.map(bk => (
                    <div key={bk.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:T.cream, borderRadius:10, borderRight:`3px solid ${STATUS_COLORS[bk.status]||T.gold}` }}>
                      <div style={{ fontSize:12, fontWeight:700, color:T.roseDp, minWidth:44 }}>{bk.appointment_time}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{bk.client_name}</div>
                        {bk.service_name && <div style={{ fontSize:11, color:T.inkSoft }}>{bk.service_name}</div>}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color:T.gold }}>{bk.total_amount||0} ر.س</div>
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


function OwnerStaff({ toast }) {
  const [staff, setStaff] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [salonId, setSalonId] = useState(null)
  const [form, setForm] = useState({ name:"", specialty:"", days:[], time_from:"09:00", time_to:"18:00" })
  const [saving, setSaving] = useState(false)
  const [availRequests, setAvailRequests] = useState([])
  const [staffBusyToday, setStaffBusyToday] = useState({})
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const ALL_TIMES_STAFF = ["00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30","05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"]
  const DAY_NAMES_AR_STAFF = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]

  const getSaudiNow = () => new Date(Date.now() + (3 * 60 * 60 * 1000))

  // أقرب وقت متاح فعلي لموظفة معينة اليوم — نفس منطق صفحة الحجز بالضبط
  const getNearestSlotForStaff = (staffMember) => {
    const saudiNow = getSaudiNow()
    const todayName = DAY_NAMES_AR_STAFF[saudiNow.getUTCDay()]
    if (staffMember.days && !staffMember.days.includes(todayName)) return null
    const fi = ALL_TIMES_STAFF.indexOf(staffMember.time_from || "09:00")
    const ti = ALL_TIMES_STAFF.indexOf(staffMember.time_to || "18:00")
    if (fi < 0 || ti < 0) return null
    const dayTimes = ALL_TIMES_STAFF.slice(fi, ti + 1)
    const busy = staffBusyToday[staffMember.id] || []
    const nowStr = String(saudiNow.getUTCHours()).padStart(2,"0") + ":" + (saudiNow.getUTCMinutes() < 30 ? "00" : "30")
    return dayTimes.find(t => !busy.includes(t) && t >= nowStr) || null
  }

  const loadAvailRequests = async (sId) => {
    const { data } = await supabase.from('availability_requests')
      .select('*, staff(name)')
      .eq('salon_id', sId)
      .eq('notified', false)
      .order('created_at', { ascending: false })
    setAvailRequests(data || [])
  }

  const loadBusyToday = async (sId) => {
    const today = getSaudiNow().toISOString().split("T")[0]
    const { data } = await supabase.from('bookings').select('staff_id, appointment_time')
      .eq('salon_id', sId)
      .eq('appointment_date', today)
      .in('status', ['pending', 'confirmed', 'completed'])
    const busyByStaff = {}
    ;(data || []).forEach(b => {
      if (!b.staff_id) return
      if (!busyByStaff[b.staff_id]) busyByStaff[b.staff_id] = []
      busyByStaff[b.staff_id].push(b.appointment_time)
    })
    setStaffBusyToday(busyByStaff)
  }

  const markNotified = async (id) => {
    await supabase.from('availability_requests').update({ notified: true }).eq('id', id)
    setAvailRequests(r => r.filter(x => x.id !== id))
  }

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: salon } = await supabase.from("salons").select("id").eq("email", session.user.email)
      if (!salon?.[0]) return
      setSalonId(salon[0].id)
      const { data } = await supabase.from("staff").select("*").eq("salon_id", salon[0].id)
      setStaff(data || [])
      await loadBusyToday(salon[0].id)
      await loadAvailRequests(salon[0].id)
    }
    load()
  }, [])

  const resetForm = () => setForm({ name:"", specialty:"", days:[], time_from:"09:00", time_to:"18:00" })

  const startEdit = (s) => {
    setForm({
      name: s.name || "",
      specialty: s.specialty || "",
      days: s.days || [],
      time_from: s.time_from || "09:00",
      time_to: s.time_to || "18:00",
    })
    setEditingId(s.id)
    setShowAdd(true)
  }

  const cancelForm = () => {
    setShowAdd(false)
    setEditingId(null)
    resetForm()
  }

  const saveStaff = async () => {
    if (!form.name) { toast("⚠ أدخلي اسم الموظفة"); return }
    setSaving(true)

    if (editingId) {
      // تعديل موظفة موجودة — يحافظ على تاريخها وتقييمها وكل حجوزاتها المرتبطة بها
      const { error } = await supabase.from("staff").update({ ...form }).eq("id", editingId)
      setSaving(false)
      if (error) { toast("⚠ تعذّر حفظ التعديل: " + error.message); return }
      setStaff(s => s.map(x => x.id === editingId ? { ...x, ...form } : x))
      toast("✅ تم حفظ تعديل الموظفة!")
    } else {
      const { data, error } = await supabase.from("staff").insert([{ salon_id: salonId, ...form, active:true }]).select()
      setSaving(false)
      if (error) { toast("⚠ تعذّر إضافة الموظفة: " + error.message); return }
      if (data?.[0]) setStaff(s => [...s, data[0]])
      toast("✅ تمت إضافة الموظفة!")
    }
    cancelForm()
  }

  const deleteStaff = async (id) => {
    const { error } = await supabase.from("staff").delete().eq("id", id)
    if (error) { toast("⚠ تعذّر الحذف: " + error.message); return }
    setStaff(s => s.filter(x => x.id !== id))
    toast("🗑 تم الحذف")
  }

  const SPECIALTIES = [...SERVICE_CATEGORIES, "كل الخدمات"]

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>👩💼 فريق العمل</div>
          <div style={{ fontSize:11, color:T.inkSoft, marginTop:2 }}>أضيفي موظفاتك وتخصصاتهن</div>
        </div>
        <PBtn sm onClick={() => { if (showAdd) { cancelForm() } else { resetForm(); setShowAdd(true) } }}>{showAdd ? "إلغاء" : "+ إضافة"}</PBtn>
      </div>

      {/* تنبيهات توفر الأوقات — العميلات اللي طلبن إشعار وفضى وقت لهن فعلياً */}
      {availRequests.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:8 }}>🔔 طلبات إشعار توفر ({availRequests.length})</div>
          {availRequests.map(req => {
            const staffMember = staff.find(s => s.id === req.staff_id)
            const nearest = staffMember ? getNearestSlotForStaff(staffMember) : null
            const isAvailableNow = !!nearest
            return (
              <Card key={req.id} style={{ padding:"12px 14px", marginBottom:8, border:`1.5px solid ${isAvailableNow ? T.green : T.creamDk}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{req.client_name}</div>
                    <div style={{ fontSize:11, color:T.inkSoft }}>تطلب وقت عند {req.staff?.name || staffMember?.name || "موظفة محذوفة"}</div>
                  </div>
                  {isAvailableNow ? (
                    <span style={{ background:T.greenL, color:T.green, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>⚡ متاح الآن: {nearest}</span>
                  ) : (
                    <span style={{ background:T.creamDk, color:T.inkSoft, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>لا يوجد وقت بعد</span>
                  )}
                </div>
                {isAvailableNow && (
                  <button onClick={() => {
                      const waNum = (req.client_phone || "").replace(/^0/, "").replace(/[^0-9]/g, "")
                      const msg = encodeURIComponent(
                        `🌸 توفر لك وقت عند ${req.staff?.name || staffMember?.name}!\nالوقت المتاح اليوم: ${nearest}\nيسعدنا حجزك — ردي علينا لتأكيد الموعد 💝`
                      )
                      window.open(`https://wa.me/966${waNum}?text=${msg}`, "_blank")
                      markNotified(req.id)
                    }}
                    style={{ width:"100%", padding:"9px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.green},#1B5E20)`, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    💬 إرسال واتساب جاهز الآن
                  </button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {showAdd && (
        <Card style={{ padding:16, marginBottom:14, border:`2px solid ${T.roseL}` }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:12 }}>{editingId ? "تعديل بيانات الموظفة" : "موظفة جديدة"}</div>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>الاسم *</label>
            <input value={form.name} onChange={set("name")} placeholder="اسم الموظفة"
              style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.cream, color:T.ink, outline:"none" }} />
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>التخصص</label>
            <select value={form.specialty} onChange={set("specialty")}
              style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.cream, color:T.ink, outline:"none" }}>
              <option value="">اختاري التخصص</option>
              {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:6 }}>أيام العمل</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"].map(d => (
                <button key={d} onClick={() => setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x=>x!==d) : [...f.days, d] }))}
                  style={{ padding:"5px 10px", borderRadius:20, border:`1.5px solid ${form.days.includes(d) ? T.roseDp : T.creamDk}`, background:form.days.includes(d) ? T.roseL : T.white, color:form.days.includes(d) ? T.roseDp : T.inkSoft, fontSize:11, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>من</label>
              <select value={form.time_from} onChange={set("time_from")}
                style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.cream, outline:"none" }}>
                {ALL_TIMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>إلى</label>
              <select value={form.time_to} onChange={set("time_to")}
                style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.cream, outline:"none" }}>
                {ALL_TIMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={cancelForm} style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:12, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>إلغاء</button>
            <button onClick={saveStaff} disabled={saving} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:T.roseDp, color:T.white, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              {saving ? "...جاري" : editingId ? "✓ حفظ التعديل" : "✓ إضافة"}
            </button>
          </div>
        </Card>
      )}

      {staff.length === 0 && !showAdd && <Empty icon="👩💼" title="لا توجد موظفات بعد" desc="أضيفي فريق عملك لتنظيم الحجوزات" />}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {staff.map(s => (
          <Card key={s.id} style={{ padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>👩</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{s.name}</div>
                  {s.specialty && <div style={{ fontSize:12, color:T.roseDp, marginTop:2 }}>✂️ {s.specialty}</div>}
                  {s.days?.length > 0 && <div style={{ fontSize:11, color:T.inkSoft }}>{s.days.join(" · ")}</div>}
                  {s.time_from && <div style={{ fontSize:11, color:T.inkSoft }}>⏰ {s.time_from} — {s.time_to}</div>}
                  {s.rating > 0 && <div style={{ fontSize:11, color:T.gold, marginTop:2 }}>⭐ {Number(s.rating).toFixed(1)} ({s.rating_count} تقييم)</div>}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => startEdit(s)} style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:12, cursor:"pointer" }}>✎</button>
                <button onClick={() => deleteStaff(s.id)} style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:12, cursor:"pointer" }}>✕</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}


function OwnerBroadcast({ toast }) {
  const [clients, setClients] = useState([])
  const [message, setMessage] = useState("")
  const [msgType, setMsgType] = useState("offer")
  const [loading, setLoading] = useState(true)
  const [salonInfo, setSalonInfo] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: salon } = await supabase.from("salons").select("*").eq("email", session.user.email)
      if (!salon?.[0]) { setLoading(false); return }
      setSalonInfo(salon[0])
      const { data: bks } = await supabase.from("bookings").select("client_name,client_phone").eq("salon_id", salon[0].id)
      if (bks) {
        const unique = {}
        bks.forEach(b => { if (b.client_phone) unique[b.client_phone] = b.client_name })
        setClients(Object.entries(unique).map(([phone, name]) => ({ phone, name })))
      }
      setLoading(false)
    }
    load()
  }, [])

  const MSG_TEMPLATES = {
    offer: `🌸 عرض خاص من ${salonInfo?.name||"صالونك"}!

[اكتبي تفاصيل العرض هنا]

احجزي الآن: beauty-tech-henna.vercel.app`,
    reminder: `تذكير: موعدك في ${salonInfo?.name||"صالونك"} غداً!

نتطلع لاستقبالكِ 🌸`,
    holiday: `🌸 ${salonInfo?.name||"صالونك"} يُهنئكِ بالمناسبة السعيدة!

استمتعي بخصم خاص بهذه المناسبة — احجزي الآن`,
    new_service: `✨ خدمة جديدة في ${salonInfo?.name||"صالونك"}!

[اكتبي اسم الخدمة والسعر]

احجزي الآن: beauty-tech-henna.vercel.app`,
  }

  const sendAll = () => {
    if (!message) { toast("⚠ اكتبي الرسالة أولاً"); return }
    if (clients.length === 0) { toast("⚠ لا توجد عملاء للإرسال"); return }
    setSending(true)
    let count = 0
    clients.forEach((c, i) => {
      setTimeout(() => {
        const personalMsg = message.replace("{اسم_العميلة}", c.name || "عزيزتي")
        const waNum = c.phone.replace(/^0/, "")
        window.open("https://wa.me/966" + waNum + "?text=" + encodeURIComponent(personalMsg), "_blank")
        count++
        setSent(count)
        if (count === clients.length) { setSending(false); toast("✅ تم فتح واتساب لـ " + count + " عميلة!") }
      }, i * 1500)
    })
  }

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:4 }}>📢 رسائل جماعية</div>
      <div style={{ fontSize:11, color:T.inkSoft, marginBottom:16 }}>أرسلي رسالة لكل عملائك دفعة وحدة عبر واتساب</div>

      {/* إحصائية */}
      <div style={{ background:`linear-gradient(135deg,${T.goldPale},#FFFBF0)`, borderRadius:12, padding:"12px 16px", marginBottom:16, border:`1px solid ${T.goldL}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900, color:T.gold }}>{clients.length}</div>
          <div style={{ fontSize:11, color:T.inkSoft }}>عميلة في قاعدة بياناتك</div>
        </div>
        {sending && <div style={{ fontSize:13, color:T.green, fontWeight:700 }}>جاري الإرسال {sent}/{clients.length}</div>}
      </div>

      {/* قوالب جاهزة */}
      <Card style={{ padding:14, marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:10 }}>📝 قوالب جاهزة</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { id:"offer", label:"🏷️ عرض خاص" },
            { id:"reminder", label:"⏰ تذكير بموعد" },
            { id:"holiday", label:"🎉 مناسبة" },
            { id:"new_service", label:"✨ خدمة جديدة" },
          ].map(t => (
            <button key={t.id} onClick={() => { setMsgType(t.id); setMessage(MSG_TEMPLATES[t.id]) }}
              style={{ padding:"9px", borderRadius:10, border:`1.5px solid ${msgType===t.id ? T.roseDp : T.creamDk}`, background:msgType===t.id ? T.roseL : T.white, color:msgType===t.id ? T.roseDp : T.inkSoft, fontSize:12, fontWeight:msgType===t.id ? 700 : 400, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {/* كتابة الرسالة */}
      <Card style={{ padding:14, marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:8 }}>✏ نص الرسالة</div>
        <div style={{ fontSize:11, color:T.inkSoft, marginBottom:8 }}>يمكنك استخدام {"{اسم_العميلة}"} لإضافة اسم كل عميلة تلقائياً</div>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="اكتبي رسالتك هنا..."
          rows={6}
          style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${T.creamDk}`, borderRadius:12, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif", resize:"none", lineHeight:1.8 }} />
        <div style={{ fontSize:11, color:T.inkSoft, marginTop:6 }}>{message.length} حرف</div>
      </Card>

      {/* تحذير */}
      <div style={{ background:T.roseL, borderRadius:12, padding:"10px 14px", marginBottom:14, border:`1px solid ${T.rose}` }}>
        <div style={{ fontSize:11, color:T.roseDp, lineHeight:1.8 }}>
          ⚠ ستُفتح نافذة واتساب لكل عميلة منفصلة — تأكدي من إرسال كل رسالة<br/>
          💡 انتظري ثانية بين كل رسالة لتجنب الحظر
        </div>
      </div>

      <button onClick={sendAll} disabled={sending || !message || clients.length === 0}
        style={{ width:"100%", padding:"14px", borderRadius:14, border:"none", background:sending ? T.creamDk : `linear-gradient(135deg,#1B5E20,#2E7D32)`, color:T.white, fontSize:14, fontWeight:800, cursor:sending ? "not-allowed" : "pointer", fontFamily:"Tajawal,sans-serif" }}>
        {sending ? `جاري الإرسال ${sent}/${clients.length}...` : `📲 إرسال لـ ${clients.length} عميلة عبر واتساب`}
      </button>
    </div>
  )
}


function OwnerCoupons({ toast }) {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [salonId, setSalonId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ code:"", discount_type:"percent", discount_value:"", min_amount:"", max_uses:"", valid_until:"", active:true })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: salon } = await supabase.from("salons").select("id").eq("email", session.user.email)
      if (!salon?.[0]) { setLoading(false); return }
      setSalonId(salon[0].id)
      const { data } = await supabase.from("coupons").select("*").eq("salon_id", salon[0].id).order("created_at", { ascending:false })
      setCoupons(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const generateCode = () => {
    const code = "BT" + Math.random().toString(36).substr(2,6).toUpperCase()
    setForm(f => ({ ...f, code }))
  }

  const saveCoupon = async () => {
    if (!form.code || !form.discount_value) { toast("⚠ أدخلي الكود والخصم"); return }
    setSaving(true)
    if (editId) {
      const { error } = await supabase.from("coupons").update({ ...form, discount_value: Number(form.discount_value), min_amount: Number(form.min_amount)||0, max_uses: Number(form.max_uses)||null }).eq("id", editId)
      setSaving(false)
      if (error) { toast("⚠ تعذّر التعديل: " + error.message); return }
      setCoupons(c => c.map(x => x.id === editId ? { ...x, ...form } : x))
      toast("✅ تم تعديل الكوبون!")
      setEditId(null)
    } else {
      const { data, error } = await supabase.from("coupons").insert([{ salon_id: salonId, ...form, discount_value: Number(form.discount_value), min_amount: Number(form.min_amount)||0, max_uses: Number(form.max_uses)||null, used_count: 0 }]).select()
      setSaving(false)
      if (error) { toast("⚠ تعذّر إنشاء الكوبون: " + error.message); return }
      if (data?.[0]) setCoupons(c => [data[0], ...c])
      toast("✅ تم إنشاء الكوبون!")
    }
    setShowAdd(false)
    setForm({ code:"", discount_type:"percent", discount_value:"", min_amount:"", max_uses:"", valid_until:"", active:true })
  }

  const deleteCoupon = async (id) => {
    const { error } = await supabase.from("coupons").delete().eq("id", id)
    if (error) { toast("⚠ تعذّر الحذف: " + error.message); return }
    setCoupons(c => c.filter(x => x.id !== id))
    toast("🗑 تم حذف الكوبون")
  }

  const toggleCoupon = async (id, active) => {
    const { error } = await supabase.from("coupons").update({ active: !active }).eq("id", id)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    setCoupons(c => c.map(x => x.id === id ? { ...x, active: !active } : x))
  }

  const startEdit = (c) => {
    setEditId(c.id)
    setForm({ code:c.code, discount_type:c.discount_type, discount_value:c.discount_value, min_amount:c.min_amount||"", max_uses:c.max_uses||"", valid_until:c.valid_until||"", active:c.active })
    setShowAdd(true)
  }

  const inp = { width:"100%", padding:"10px 12px", border:`1.5px solid ${T.creamDk}`, borderRadius:10, fontSize:13, color:T.ink, background:T.cream, outline:"none", fontFamily:"Tajawal,sans-serif" }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>🎟️ كوبونات الخصم</div>
          <div style={{ fontSize:11, color:T.inkSoft, marginTop:2 }}>شاركيها مع عملائك لجذب حجوزات أكثر</div>
        </div>
        <PBtn sm onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ code:"", discount_type:"percent", discount_value:"", min_amount:"", max_uses:"", valid_until:"", active:true }) }}>
          + إنشاء كوبون
        </PBtn>
      </div>

      {/* نموذج إضافة/تعديل */}
      {showAdd && (
        <Card style={{ padding:16, marginBottom:14, border:`2px solid ${T.roseL}` }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:14 }}>{editId ? "✏ تعديل الكوبون" : "🎟️ كوبون جديد"}</div>

          {/* كود الكوبون */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>كود الكوبون *</label>
            <div style={{ display:"flex", gap:8 }}>
              <input value={form.code} onChange={set("code")} placeholder="مثال: BEAUTY20" style={{ ...inp, flex:1, textTransform:"uppercase", fontWeight:700, letterSpacing:2 }} />
              <button onClick={generateCode} style={{ padding:"0 14px", borderRadius:10, border:`1px solid ${T.creamDk}`, background:T.cream, color:T.inkSoft, fontSize:12, cursor:"pointer", fontFamily:"Tajawal,sans-serif", whiteSpace:"nowrap" }}>
                🎲 عشوائي
              </button>
            </div>
          </div>

          {/* نوع الخصم */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>نوع الخصم</label>
            <div style={{ display:"flex", gap:8 }}>
              {[{ id:"percent", label:"نسبة مئوية %" }, { id:"fixed", label:"مبلغ ثابت ر.س" }].map(t => (
                <button key={t.id} onClick={() => setForm(f => ({ ...f, discount_type:t.id }))}
                  style={{ flex:1, padding:"9px", borderRadius:10, border:`2px solid ${form.discount_type===t.id ? T.roseDp : T.creamDk}`, background:form.discount_type===t.id ? T.roseL : T.white, color:form.discount_type===t.id ? T.roseDp : T.inkSoft, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>قيمة الخصم * {form.discount_type==="percent" ? "(٪)" : "(ر.س)"}</label>
              <input type="number" value={form.discount_value} onChange={set("discount_value")} placeholder={form.discount_type==="percent" ? "20" : "50"} style={inp} />
            </div>
            <div>
              <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>الحد الأدنى للطلب (ر.س)</label>
              <input type="number" value={form.min_amount} onChange={set("min_amount")} placeholder="0" style={inp} />
            </div>
            <div>
              <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>عدد مرات الاستخدام</label>
              <input type="number" value={form.max_uses} onChange={set("max_uses")} placeholder="بلا حد" style={inp} />
            </div>
            <div>
              <label style={{ fontSize:12, color:T.inkSoft, display:"block", marginBottom:5 }}>صالح حتى</label>
              <input type="date" value={form.valid_until} onChange={set("valid_until")} style={inp} />
            </div>
          </div>

          {/* معاينة */}
          {form.discount_value && (
            <div style={{ background:T.goldPale, borderRadius:10, padding:"10px 12px", marginBottom:12, border:`1px solid ${T.goldL}`, textAlign:"center" }}>
              <div style={{ fontSize:11, color:T.inkSoft, marginBottom:4 }}>معاينة الكوبون</div>
              <div style={{ fontSize:18, fontWeight:900, color:T.roseDp, letterSpacing:3 }}>{form.code || "BEAUTY"}</div>
              <div style={{ fontSize:13, color:T.gold, fontWeight:700, marginTop:4 }}>
                خصم {form.discount_value}{form.discount_type==="percent" ? "%" : " ر.س"}
                {form.min_amount > 0 ? ` · عند الطلب فوق ${form.min_amount} ر.س` : ""}
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => { setShowAdd(false); setEditId(null) }} style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:12, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>إلغاء</button>
            <button onClick={saveCoupon} disabled={saving} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:T.roseDp, color:T.white, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              {saving ? "...جاري" : editId ? "✓ حفظ التعديل" : "✓ إنشاء الكوبون"}
            </button>
          </div>
        </Card>
      )}

      {loading && <div style={{ textAlign:"center", padding:30, color:T.inkSoft }}>...جاري التحميل</div>}
      {!loading && coupons.length === 0 && <Empty icon="🎟️" title="لا توجد كوبونات بعد" desc="أنشئي كوبون خصم لجذب عملاء جدد!" />}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {coupons.map(c => {
          const isExpired = c.valid_until && new Date(c.valid_until) < new Date()
          const isMaxed = c.max_uses && c.used_count >= c.max_uses
          const status = isExpired ? "منتهي" : isMaxed ? "استُنفد" : c.active ? "فعّال" : "متوقف"
          const statusColor = isExpired||isMaxed ? T.inkSoft : c.active ? T.green : T.inkSoft
          const statusBg = isExpired||isMaxed ? T.creamDk : c.active ? T.greenL : T.creamDk
          return (
            <Card key={c.id} style={{ padding:14, opacity: isExpired||isMaxed ? .7 : 1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:900, color:T.roseDp, letterSpacing:2 }}>{c.code}</div>
                  <div style={{ fontSize:13, color:T.gold, fontWeight:700, marginTop:2 }}>
                    خصم {c.discount_value}{c.discount_type==="percent" ? "%" : " ر.س"}
                    {c.min_amount > 0 ? ` · فوق ${c.min_amount} ر.س` : ""}
                  </div>
                </div>
                <span style={{ background:statusBg, color:statusColor, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{status}</span>
              </div>
              <div style={{ display:"flex", gap:16, fontSize:11, color:T.inkSoft, marginBottom:10 }}>
                <span>🔢 استُخدم: {c.used_count||0}{c.max_uses ? `/${c.max_uses}` : ""} مرة</span>
                {c.valid_until && <span>📅 حتى: {c.valid_until}</span>}
              </div>
              {!isExpired && !isMaxed && (
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => toggleCoupon(c.id, c.active)}
                    style={{ flex:1, padding:"7px", borderRadius:8, border:`1px solid ${c.active ? T.creamDk : T.green}`, background:c.active ? T.cream : T.greenL, color:c.active ? T.inkSoft : T.green, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    {c.active ? "⏸ إيقاف" : "▶ تفعيل"}
                  </button>
                  <button onClick={() => startEdit(c)}
                    style={{ flex:1, padding:"7px", borderRadius:8, border:`1px solid ${T.goldL}`, background:T.goldPale, color:T.gold, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ✏ تعديل
                  </button>
                  <button onClick={() => deleteCoupon(c.id)}
                    style={{ width:32, padding:"7px", borderRadius:8, border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:12, cursor:"pointer" }}>
                    ✕
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

function OwnerReport({ salonInfo }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().split("T")[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0])
  const [statusFilter, setStatusFilter] = useState("all")
  const toast = useToast()

  useEffect(() => { loadReport() }, [dateFrom, dateTo, statusFilter])

  const loadReport = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const { data: salon } = await supabase.from("salons").select("id").eq("email", session.user.email)
    if (!salon || !salon[0]) { setLoading(false); return }
    let q = supabase.from("bookings").select("*")
      .eq("salon_id", salon[0].id)
      .gte("appointment_date", dateFrom)
      .lte("appointment_date", dateTo)
      .order("appointment_date", { ascending: false })
    if (statusFilter !== "all") q = q.eq("status", statusFilter)
    const { data } = await q
    setBookings(data || [])
    setLoading(false)
  }

  // حسابات — مفصولة بدقة حسب نوع الحجز (الحجز اليدوي عكس الاتجاه)
  const completed = bookings.filter(b => b.status === "completed")
  const onlineCompleted = completed.filter(b => b.booking_type !== "manual")
  const manualCompleted = completed.filter(b => b.booking_type === "manual")

  const totalRevenue = onlineCompleted.reduce((s,b) => s + (b.total_amount||0), 0)
  const totalDeposits = onlineCompleted.reduce((s,b) => s + (calcCommission(b).depositPaid || 0), 0)
  const totalFees = onlineCompleted.reduce((s,b) => s + calcCommission(b).fee, 0)
  const totalNet = onlineCompleted.reduce((s,b) => s + calcCommission(b).salonGet, 0)
  const manualCashTotal = manualCompleted.reduce((s,b) => s + (b.total_amount||0), 0)
  const manualOwedTotal = manualCompleted.reduce((s,b) => s + calcCommission(b).fee, 0)
  const pending = bookings.filter(b => b.status === "pending" || b.status === "confirmed").length
  const cancelled = bookings.filter(b => b.status === "cancelled").length

  // تصدير CSV
  const exportCSV = () => {
    const rows = [
      ["التاريخ","الوقت","العميلة","الجوال","الخدمة","النوع","قيمة الخدمة","العربون/المدفوع","نسبة العمولة","قيمة العمولة","الصافي/المستحق","الاتجاه","الحالة","حالة التحويل"],
      ...bookings.map(b => {
        const isManualType = b.booking_type === "manual"
        const { fee, salonGet, depositPaid } = calcCommission(b)
        return [
          b.appointment_date || "",
          b.appointment_time || "",
          b.client_name || "",
          b.client_phone || "",
          b.service_name || "",
          b.booking_type === "love_gift" ? "إهداء محبة" : b.booking_type === "manual" ? "حجز يدوي" : b.booking_type === "offer" ? "عرض" : b.booking_type === "package" ? "باقة" : "خدمة",
          b.total_amount || 0,
          depositPaid || 0,
          isManualType ? "3%" : "10%",
          fee,
          salonGet,
          isManualType ? "مستحق عليك للمنصة" : "مستحق لك",
          b.status === "completed" ? "مكتمل" : b.status === "cancelled" ? "ملغي" : b.status === "confirmed" ? "مؤكد" : "انتظار",
          b.payment_status === "settled" ? (isManualType ? "محصّلة" : "محوَّل") : "معلق",
        ]
      })
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "تقرير_" + (salonInfo?.name||"الصالون") + "_" + dateFrom + "_" + dateTo + ".csv"
    a.click()
    toast("✅ تم تصدير التقرير!")
  }

  // تصدير HTML للطباعة
  const printReport = () => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير ${salonInfo?.name||"الصالون"}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #A8705A; border-bottom: 2px solid #A8705A; padding-bottom: 10px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .summary { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 20px; }
          .summary-card { background: #FAF7F2; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #F0D9D1; }
          .summary-card .value { font-size: 20px; font-weight: bold; color: #A8705A; }
          .summary-card .label { font-size: 11px; color: #888; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #A8705A; color: white; padding: 8px; text-align: right; }
          td { padding: 7px 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #FAF7F2; }
          .completed { color: green; font-weight: bold; }
          .cancelled { color: red; }
          .pending { color: #B8A060; }
          .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #aaa; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <h1>🌸 تقرير ${salonInfo?.name||"الصالون"}</h1>
        <div class="header">
          <div>الفترة: ${dateFrom} — ${dateTo}</div>
          <div>تاريخ الإصدار: ${new Date().toLocaleDateString("ar-SA")}</div>
        </div>
        <div class="summary">
          <div class="summary-card"><div class="value">${bookings.length}</div><div class="label">إجمالي الحجوزات</div></div>
          <div class="summary-card"><div class="value">${totalRevenue.toLocaleString()} ر.س</div><div class="label">مبيعات أونلاين/إهداء</div></div>
          <div class="summary-card"><div class="value">${totalFees.toLocaleString()} ر.س</div><div class="label">عمولة المنصة منها (10%)</div></div>
          <div class="summary-card"><div class="value" style="color:green">${totalNet.toLocaleString()} ر.س</div><div class="label">صافي مستحقاتك</div></div>
        </div>
        ${manualCompleted.length > 0 ? `
        <div class="summary" style="grid-template-columns: repeat(3,1fr);">
          <div class="summary-card" style="border-color:#90CAF9;"><div class="value" style="color:#1976D2">${manualCompleted.length}</div><div class="label">حجوزات يدوية</div></div>
          <div class="summary-card" style="border-color:#90CAF9;"><div class="value" style="color:#1976D2">${manualCashTotal.toLocaleString()} ر.س</div><div class="label">استلمتها كاش</div></div>
          <div class="summary-card" style="border-color:#90CAF9;"><div class="value" style="color:red">${manualOwedTotal.toLocaleString()} ر.س</div><div class="label">مستحق عليك للمنصة (3%)</div></div>
        </div>` : ""}
        <table>
          <thead>
            <tr><th>التاريخ</th><th>الوقت</th><th>العميلة</th><th>النوع</th><th>الخدمة</th><th>قيمة الخدمة</th><th>العربون/المدفوع</th><th>العمولة</th><th>الصافي/المستحق</th><th>الحالة</th></tr>
          </thead>
          <tbody>
            ${bookings.map(b => {
              const isManualType = b.booking_type === "manual"
              const { fee, salonGet, depositPaid } = calcCommission(b)
              const typeLabel = b.booking_type === "love_gift" ? "💝 إهداء" : isManualType ? "🖐️ يدوي" : "✂️ خدمة"
              const statusClass = b.status==="completed"?"completed":b.status==="cancelled"?"cancelled":"pending"
              const statusLabel = b.status==="completed"?"✅ مكتمل":b.status==="cancelled"?"❌ ملغي":b.status==="confirmed"?"✓ مؤكد":"⏳ انتظار"
              return `<tr>
                <td>${b.appointment_date||""}</td>
                <td>${b.appointment_time||""}</td>
                <td>${b.client_name||""}</td>
                <td>${typeLabel}</td>
                <td>${b.service_name||""}</td>
                <td>${b.total_amount||0} ر.س</td>
                <td>${depositPaid||0} ر.س</td>
                <td style="color:${isManualType ? '#1976D2' : 'red'}">${fee} ر.س ${isManualType ? '(عليك)' : ''}</td>
                <td style="color:green;font-weight:bold">${salonGet} ر.س</td>
                <td class="${statusClass}">${statusLabel}</td>
              </tr>`
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="background:#A8705A;color:white;font-weight:bold">
              <td colspan="5">الإجمالي (أونلاين/إهداء فقط)</td>
              <td>${totalRevenue.toLocaleString()} ر.س</td>
              <td>${totalDeposits.toLocaleString()} ر.س</td>
              <td>${totalFees.toLocaleString()} ر.س</td>
              <td>${totalNet.toLocaleString()} ر.س</td>
              <td>${completed.length} مكتمل</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">بيوتي تيك — منصة صالونات التجميل الأولى في المملكة | beauty-tech-henna.vercel.app</div>
      </body>
      </html>
    `
    const win = window.open("", "_blank")
    win.document.write(html)
    win.document.close()
    win.print()
  }

  const STATUS_LABELS = {
    completed: { label:"✅ مكتمل", color:T.green, bg:T.greenL },
    confirmed: { label:"✓ مؤكد",  color:"#1565C0", bg:"#E3F2FD" },
    pending:   { label:"⏳ انتظار", color:T.gold,   bg:T.goldPale },
    cancelled: { label:"❌ ملغي",  color:T.red,    bg:T.redL },
  }

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:4 }}>📈 التقارير المالية</div>
      <div style={{ fontSize:11, color:T.inkSoft, marginBottom:16 }}>تقارير احترافية قابلة للتصدير والطباعة</div>

      {/* فلاتر */}
      <Card style={{ padding:14, marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:10 }}>🔍 فلترة التقرير</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div>
            <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>من تاريخ</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ width:"100%", padding:"9px 10px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white }} />
          </div>
          <div>
            <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ width:"100%", padding:"9px 10px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {[
            { id:"all", label:"الكل" },
            { id:"completed", label:"مكتملة" },
            { id:"pending", label:"انتظار" },
            { id:"cancelled", label:"ملغية" },
          ].map(s => (
            <button key={s.id} onClick={() => setStatusFilter(s.id)}
              style={{ flex:1, padding:"7px 4px", borderRadius:8, border:`1.5px solid ${statusFilter===s.id ? T.roseDp : T.creamDk}`, background:statusFilter===s.id ? T.roseL : T.white, color:statusFilter===s.id ? T.roseDp : T.inkSoft, fontSize:11, fontWeight:statusFilter===s.id ? 700 : 400, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      {/* ملخص إحصائي */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div style={{ background:`linear-gradient(135deg,${T.roseDp},#7A3020)`, borderRadius:14, padding:"14px", textAlign:"center" }}>
          <div style={{ fontSize:24, fontWeight:900, color:T.white }}>{bookings.length}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.8)", marginTop:3 }}>إجمالي الحجوزات</div>
        </div>
        <div style={{ background:`linear-gradient(135deg,${T.gold},${T.gold2})`, borderRadius:14, padding:"14px", textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:900, color:T.white }}>{totalRevenue.toLocaleString()}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.8)", marginTop:3 }}>إجمالي المبيعات (ر.س)</div>
        </div>
        <div style={{ background:T.white, borderRadius:14, padding:"14px", textAlign:"center", border:`1px solid ${T.creamDk}` }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#C62828" }}>{totalFees.toLocaleString()}</div>
          <div style={{ fontSize:10, color:T.inkSoft, marginTop:3 }}>عمولة المنصة منها (10%)</div>
        </div>
        <div style={{ background:`linear-gradient(135deg,#2E7D32,#1B5E20)`, borderRadius:14, padding:"14px", textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:900, color:T.white }}>{totalNet.toLocaleString()}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.8)", marginTop:3 }}>صافي مستحقاتك (أونلاين/إهداء)</div>
        </div>
        {manualCompleted.length > 0 && (
          <div style={{ background:"linear-gradient(135deg,#1976D2,#0D47A1)", borderRadius:14, padding:"14px", textAlign:"center", gridColumn:"span 2" }}>
            <div style={{ fontSize:20, fontWeight:900, color:T.white }}>{manualOwedTotal.toLocaleString()} ر.س</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.85)", marginTop:3 }}>🖐️ مستحق عليك للمنصة من {manualCompleted.length} حجز يدوي (3% من {manualCashTotal.toLocaleString()} ر.س استلمتها كاش)</div>
          </div>
        )}
      </div>

      {/* أزرار التصدير */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        <button onClick={exportCSV}
          style={{ flex:1, padding:"12px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.green},#1B5E20)`, color:T.white, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
          📊 تصدير Excel/CSV
        </button>
        <button onClick={printReport}
          style={{ flex:1, padding:"12px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.roseDp},#7A3020)`, color:T.white, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
          🖨️ طباعة / PDF
        </button>
      </div>

      {/* قائمة الحجوزات */}
      {loading && <div style={{ textAlign:"center", padding:30, color:T.inkSoft }}>...جاري التحميل</div>}
      {!loading && bookings.length === 0 && <Empty icon="📋" title="لا توجد حجوزات" desc="جرّب تغيير الفترة أو الفلتر" />}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {bookings.map(bk => {
          const isManualType = bk.booking_type === "manual"
          const { fee, salonGet, depositPaid } = calcCommission(bk)
          const st = STATUS_LABELS[bk.status] || STATUS_LABELS.pending
          return (
            <div key={bk.id} style={{ background:T.white, borderRadius:12, padding:"12px 14px", border:`1px solid ${isManualType ? "#90CAF9" : T.creamDk}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div>
                  <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{bk.client_name}</span>
                  <span style={{ fontSize:11, color:T.inkSoft, marginRight:8 }}>{bk.appointment_date} · {bk.appointment_time}</span>
                  {isManualType && <span style={{ fontSize:10, color:"#1976D2", fontWeight:700, marginRight:6 }}>🖐️ يدوي</span>}
                  {bk.booking_type === "love_gift" && <span style={{ fontSize:10, color:"#C2185B", fontWeight:700, marginRight:6 }}>💝 إهداء</span>}
                </div>
                <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>{st.label}</span>
              </div>
              {bk.service_name && <div style={{ fontSize:11, color:T.roseDp, marginBottom:6 }}>✂️ {bk.service_name}</div>}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                {[
                  ["الخدمة", (bk.total_amount||0)+" ر.س", T.ink],
                  [isManualType ? "استلمت كاش" : "العربون", (isManualType ? bk.total_amount||0 : depositPaid||0)+" ر.س", T.ink],
                  [isManualType ? "عمولة عليك (3%)" : "العمولة (10%)", fee+" ر.س", "#C62828"],
                  [isManualType ? "صافٍ بعد العمولة" : "صافيك", salonGet+" ر.س", "#2E7D32"],
                ].map(r => (
                  <div key={r[0]} style={{ background:T.cream, borderRadius:8, padding:"6px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:r[2] }}>{r[1]}</div>
                    <div style={{ fontSize:9, color:T.inkSoft }}>{r[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DailyStatement({ salonId }) {
  const [todayBks, setTodayBks] = useState([])
  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    if (!salonId) return
    supabase.from("bookings")
      .select("*")
      .eq("salon_id", salonId)
      .eq("appointment_date", today)
      .eq("status", "completed")
      .then(({ data }) => setTodayBks(data || []))
  }, [salonId])

  if (todayBks.length === 0) return null

  const onlineBks = todayBks.filter(b => b.booking_type !== "manual")
  const manualBksToday = todayBks.filter(b => b.booking_type === "manual")

  const todayDeposit = onlineBks.reduce((s,b) => s + (calcCommission(b).depositPaid || 0), 0)
  const todayFee     = onlineBks.reduce((s,b) => s + calcCommission(b).fee, 0)
  const todayNet     = onlineBks.reduce((s,b) => s + calcCommission(b).salonGet, 0)
  const todayManualCash = manualBksToday.reduce((s,b) => s + (b.total_amount || 0), 0)
  const todayManualOwed = manualBksToday.reduce((s,b) => s + calcCommission(b).fee, 0)

  return (
    <div style={{ background:`linear-gradient(135deg,#1B5E20,#2E7D32)`, borderRadius:14, padding:"14px 16px", marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:800, color:T.white, marginBottom:10 }}>
        📊 كشف حساب اليوم — {today}
      </div>
      {[
        ["إجمالي المدفوعات (أونلاين/إهداء)", todayDeposit + " ر.س"],
        ["عمولة المنصة منها", todayFee + " ر.س"],
        ["صافي مستحقاتك منها", todayNet + " ر.س"],
        ["عدد الحجوزات أونلاين/إهداء", onlineBks.length + ""],
      ].map(r => (
        <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,.15)" }}>
          <span style={{ color:"rgba(255,255,255,.8)" }}>{r[0]}</span>
          <span style={{ fontWeight:700, color:T.white }}>{r[1]}</span>
        </div>
      ))}
      {manualBksToday.length > 0 && (
        <>
          <div style={{ height:1, background:"rgba(255,255,255,.25)", margin:"8px 0" }} />
          {[
            ["🖐️ حجوزات يدوية اليوم", manualBksToday.length + ""],
            ["مبلغ استلمته كاش", todayManualCash + " ر.س"],
            ["مستحق عليك للمنصة (3%)", todayManualOwed + " ر.س"],
          ].map(r => (
            <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,.15)" }}>
              <span style={{ color:"rgba(255,255,255,.8)" }}>{r[0]}</span>
              <span style={{ fontWeight:700, color:"#FFD54F" }}>{r[1]}</span>
            </div>
          ))}
        </>
      )}
      <div style={{ fontSize:10, color:"rgba(255,255,255,.6)", marginTop:8, textAlign:"center" }}>
        سيُحوَّل {todayNet} ر.س لحسابك{manualBksToday.length > 0 ? ` · وعليك تحويل ${todayManualOwed} ر.س للمنصة` : ""} في نهاية اليوم
      </div>
    </div>
  )
}

function OwnerFinance({ toast }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("pending")
  const [salonId, setSalonId] = useState(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: salon } = await supabase.from("salons").select("id").eq("email", session.user.email)
      if (!salon || !salon[0]) { setLoading(false); return }
      setSalonId(salon[0].id)
      const { data } = await supabase.from("bookings")
        .select("*")
        .eq("salon_id", salon[0].id)
        .eq("status", "completed")
        .order("appointment_date", { ascending: false })
      setBookings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // فلترة
  const filtered = bookings.filter(b => {
    if (dateFrom && b.appointment_date < dateFrom) return false
    if (dateTo && b.appointment_date > dateTo) return false
    if (search) {
      const s = search.toLowerCase()
      return (b.client_name||"").toLowerCase().includes(s) || (b.appointment_date||"").includes(s)
    }
    return true
  })

  const pending  = filtered.filter(b => b.payment_status !== "settled" && b.booking_type !== "manual")
  const settled  = filtered.filter(b => b.payment_status === "settled" && b.booking_type !== "manual")
  const loveGifts = filtered.filter(b => b.booking_type === "love_gift")
  const manualBks = filtered.filter(b => b.booking_type === "manual")
  const manualPending = manualBks.filter(b => b.payment_status !== "settled")
  const manualSettled = manualBks.filter(b => b.payment_status === "settled")

  // حسابات دقيقة
  // العربون الحجوزات العادية = deposit_amount - platform_fee
  const calcNet = (b) => {
    const { salonGet } = calcCommission(b)
    return salonGet
  }

  const totalPending  = pending.reduce((s,b)  => s + calcNet(b), 0)
  const totalSettled  = settled.reduce((s,b)  => s + calcNet(b), 0)
  const totalFees     = filtered.filter(b => b.booking_type !== "manual").reduce((s,b) => s + calcCommission(b).fee, 0)
  const totalLoveGift = loveGifts.reduce((s,b) => s + calcNet(b), 0)
  // مستحق على الصالون من الحجوزات اليدوية (عكس الاتجاه — هو يدفع لك)
  const manualOwedPending = manualPending.reduce((s,b) => s + calcCommission(b).fee, 0)
  const manualOwedSettled = manualSettled.reduce((s,b) => s + calcCommission(b).fee, 0)

  const list = tab === "pending" ? pending : tab === "settled" ? settled : tab === "manual" ? manualBks : loveGifts

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:4 }}>💰 بياناتي المالية</div>
      <div style={{ fontSize:11, color:T.inkSoft, marginBottom:16 }}>أونلاين/إهداء: مستحقاتك بعد خصم 10% · يدوي: عليك تحويل 3% للمنصة</div>

      {/* ملخص مالي */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div style={{ background:`linear-gradient(135deg,${T.gold},${T.gold2})`, borderRadius:14, padding:"14px", textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:900, color:T.white }}>{totalPending.toLocaleString()}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.85)", marginTop:3 }}>⏳ معلق — لم يُحوَّل بعد</div>
        </div>
        <div style={{ background:`linear-gradient(135deg,#2E7D32,#1B5E20)`, borderRadius:14, padding:"14px", textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:900, color:T.white }}>{totalSettled.toLocaleString()}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.85)", marginTop:3 }}>✅ محوَّل لحسابك</div>
        </div>
        <div style={{ background:"linear-gradient(135deg,#880E4F,#C2185B)", borderRadius:14, padding:"14px", textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:900, color:T.white }}>{totalLoveGift.toLocaleString()}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.85)", marginTop:3 }}>💝 إهداء المحبة</div>
        </div>
        <div style={{ background:T.white, borderRadius:14, padding:"14px", textAlign:"center", border:`1px solid ${T.creamDk}` }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#C62828" }}>{totalFees.toLocaleString()}</div>
          <div style={{ fontSize:10, color:T.inkSoft, marginTop:3 }}>🏦 عمولة المنصة (10%)</div>
        </div>
        <div style={{ background:"linear-gradient(135deg,#1976D2,#0D47A1)", borderRadius:14, padding:"14px", textAlign:"center", gridColumn:"span 2" }}>
          <div style={{ fontSize:20, fontWeight:900, color:T.white }}>{manualOwedPending.toLocaleString()} ر.س</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.85)", marginTop:3 }}>🖐️ مستحق عليك للمنصة من الحجوزات اليدوية (3%)</div>
        </div>
      </div>

      {/* شرح آلية الحساب */}
      <div style={{ background:T.goldPale, borderRadius:12, padding:"12px 14px", marginBottom:14, border:`1px solid ${T.goldL}` }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:6 }}>📌 كيف تُحسب مستحقاتك؟</div>
        <div style={{ fontSize:11, color:T.inkSoft, lineHeight:2 }}>
          • <strong>خدمة عادية:</strong> العربون (30%) − عمولة المنصة (10% من الخدمة)<br/>
          • <strong>إهداء المحبة:</strong> المبلغ الكامل − عمولة المنصة (10%)<br/>
          • مثال خدمة 200 ر.س: عربون 60 ر.س − عمولتي 20 ر.س = <strong style={{ color:T.green }}>40 ر.س تُحوَّل لك · والـ 140 ر.س تستلمها من العميلة مباشرة</strong><br/>
          • <strong>حجز يدوي (عميلة حاضرة بالصالون):</strong> تستلم المبلغ كامل كاش، وعليك تحويل 3% منه للمنصة — <strong style={{ color:"#1976D2" }}>عكس الاتجاه</strong>
        </div>
      </div>

      {/* DailyStatement */}
      <DailyStatement salonId={salonId} />

      {/* فلاتر البحث */}
      <div style={{ background:T.white, borderRadius:12, padding:"12px 14px", marginBottom:14, border:`1px solid ${T.creamDk}` }}>
        <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:10 }}>🔍 البحث والفلترة</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
          <div>
            <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>من تاريخ</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ width:"100%", padding:"8px 10px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white }} />
          </div>
          <div>
            <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>إلى تاريخ</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ width:"100%", padding:"8px 10px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white }} />
          </div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ابحثي باسم العميلة أو التاريخ..."
          style={{ width:"100%", padding:"9px 12px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.cream, outline:"none" }} />
        {(dateFrom || dateTo || search) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); setSearch("") }}
            style={{ marginTop:8, fontSize:11, color:T.roseDp, background:"none", border:"none", cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
            ✕ إلغاء الفلاتر
          </button>
        )}
      </div>

      {/* تبويبات */}
      <div style={{ display:"flex", background:T.white, borderRadius:12, overflow:"hidden", marginBottom:14, border:`1px solid ${T.creamDk}` }}>
        {[
          { id:"pending",   label:`⏳ معلق (${pending.length})` },
          { id:"settled",   label:`✅ محوَّل (${settled.length})` },
          { id:"love_gift", label:`💝 إهداء (${loveGifts.length})` },
          { id:"manual",    label:`🖐️ يدوي (${manualBks.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"10px 4px", border:"none", borderBottom:`3px solid ${tab===t.id ? T.roseDp : "transparent"}`, background:"transparent", cursor:"pointer", fontSize:11, fontWeight:tab===t.id ? 700 : 400, color:tab===t.id ? T.roseDp : T.inkSoft, fontFamily:"Tajawal,sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:"center", padding:30, color:T.inkSoft }}>...جاري التحميل</div>}
      {!loading && list.length === 0 && <Empty icon="💰" title="لا توجد معاملات" desc={tab==="pending" ? "كل مستحقاتك محوَّلة ✅" : "لا توجد بيانات"} />}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {list.map(bk => {
          const isLove = bk.booking_type === "love_gift"
          const isManual = bk.booking_type === "manual"
          const { fee } = calcCommission(bk)
          const netAmount = calcNet(bk)
          return (
            <div key={bk.id} style={{ background:T.white, borderRadius:14, padding:"14px 16px", border:`1.5px solid ${isLove ? "#F8BBD0" : isManual ? "#90CAF9" : bk.payment_status==="settled" ? "#E8F5E9" : T.roseL}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:14 }}>{isLove ? "💝" : isManual ? "🖐️" : "✂️"}</span>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{bk.client_name}</div>
                  </div>
                  <div style={{ fontSize:11, color:T.inkSoft, marginTop:2 }}>
                    📅 {bk.appointment_date} · ⏰ {bk.appointment_time}
                  </div>
                  {bk.service_name && <div style={{ fontSize:11, color:T.roseDp, marginTop:2 }}>{bk.service_name}</div>}
                </div>
                <span style={{ background:bk.payment_status==="settled" ? "#E8F5E9" : isManual ? "#E3F2FD" : T.roseL, color:bk.payment_status==="settled" ? T.green : isManual ? "#1976D2" : T.roseDp, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>
                  {bk.payment_status === "settled" ? "✅ محوَّل" : isManual ? "⏳ مستحق عليك" : "⏳ معلق"}
                </span>
              </div>

              <div style={{ background:T.cream, borderRadius:10, padding:"10px 12px" }}>
                {isManual ? (
                  // حجز يدوي — المنصة تستحق 3% فقط
                  <>
                    {[
                      ["🖐️ المبلغ المستلم كاش", (bk.total_amount||0).toLocaleString() + " ر.س", T.ink],
                      ["مستحق للمنصة (3%)", fee.toLocaleString() + " ر.س", "#1976D2"],
                    ].map(r => (
                      <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:`1px solid ${T.creamDk}` }}>
                        <span style={{ color:T.inkSoft }}>{r[0]}</span>
                        <span style={{ fontWeight:700, color:r[2] }}>{r[1]}</span>
                      </div>
                    ))}
                  </>
                ) : isLove ? (
                  // إهداء المحبة — المبلغ الكامل
                  <>
                    {[
                      ["💝 مبلغ الإهداء الكامل", (bk.total_amount||0).toLocaleString() + " ر.س", T.ink],
                      ["عمولة المنصة (10%)", fee.toLocaleString() + " ر.س", "#C62828"],
                      ["✅ صافي مستحقاتك", netAmount.toLocaleString() + " ر.س", T.green],
                    ].map(r => (
                      <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:`1px solid ${T.creamDk}` }}>
                        <span style={{ color:T.inkSoft }}>{r[0]}</span>
                        <span style={{ fontWeight:700, color:r[2] }}>{r[1]}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  // خدمة عادية — العربون
                  <>
                    {[
                      ["قيمة الخدمة الكاملة", (bk.total_amount||0).toLocaleString() + " ر.س", T.inkSoft],
                      ["العربون المدفوع (30%)", (bk.deposit_amount||0).toLocaleString() + " ر.س", T.ink],
                      ["عمولة المنصة (10%)", fee.toLocaleString() + " ر.س", "#C62828"],
                      ["✅ صافي مستحقاتك", netAmount.toLocaleString() + " ر.س", T.green],
                    ].map(r => (
                      <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:`1px solid ${T.creamDk}` }}>
                        <span style={{ color:T.inkSoft }}>{r[0]}</span>
                        <span style={{ fontWeight:700, color:r[2] }}>{r[1]}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {bk.payment_status === "settled" && bk.settled_at && (
                <div style={{ fontSize:10, color:T.green, marginTop:6 }}>
                  ✅ {isManual ? "تم تحويل العمولة للمنصة" : "تم التحويل"}: {new Date(bk.settled_at).toLocaleDateString("ar-SA")}
                </div>
              )}
              {bk.payment_status !== "settled" && (
                <div style={{ fontSize:10, color:T.inkSoft, marginTop:6 }}>
                  {isManual ? "⏳ مستحق عليك تحويله للمنصة" : "⏳ في انتظار التحويل اليومي"}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OwnerTerms() {
  const [tab, setTab] = useState("platform")

  const platformTerms = [
    { t:"١. رسوم التأسيس", b:"تُدفع مرة واحدة عند الانضمام للمنصة." },
    { t:"٢. رسوم الاشتراك", b:"تُدفع شهرياً أو سنوياً حسب الباقة. السنوي = 11 شهراً فقط (شهر مجاني)." },
    { t:"٣. التجربة المجانية", b:"14 يوماً مجاناً — مرة واحدة فقط لكل صالون بالإيميل ورقم الجوال." },
    { t:"٤. عمولة المنصة", b:"10% من قيمة الخدمة تُخصم من العربون. مثال: خدمة 200 ر.س → عربون 60 ر.س → عمولة المنصة 20 ر.س → يُحوَّل للصالون 40 ر.س يومياً." },
    { t:"٥. عمولة الحجز اليدوي", b:"للحجوزات اليدوية (عميلة حاضرة تدفع كاش مباشرة)، تستحق المنصة 3% من قيمة الخدمة الكاملة، يحوّلها الصالون للمنصة ضمن التسوية اليومية." },
    { t:"٦. ترقية الباقة", b:"يمكن الترقية في أي وقت بدفع الفرق + 100 ر.س رسوم ترقية. يُفعَّل فور الدفع." },
    { t:"٧. تخفيض الباقة", b:"لا يمكن تخفيض الباقة إلا بعد انتهاء الاشتراك الحالي." },
    { t:"٨. إيقاف الحساب", b:"للمنصة حق إيقاف الحساب المخالف للشروط بعد إشعار مسبق." },
  ]

  const clientTerms = [
    { t:"١. توزيع العربون", b:"العربون (30%): 10% للمنصة، والباقي (20%) يُحوَّل للصالون يومياً." },
    { t:"٢. التزامات الصالون", b:"تقديم الخدمة بالوقت والجودة والسعر المعلن." },
    { t:"٣. الإلغاء من الصالون", b:"لو الصالون ألغى، يُرد العربون كاملاً للعميلة." },
    { t:"٤. التسعير", b:"يُحظر تغيير السعر بعد الحجز أو إضافة رسوم غير معلنة." },
    { t:"٥. حل النزاعات", b:"المنصة تتدخل للوساطة وقرارها ملزم للطرفين." },
  ]

  return (
    <div>
      {/* بطاقة التسوية المالية */}
      <div style={{ background:`linear-gradient(135deg,#1B5E20,#2E7D32)`, borderRadius:14, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.white, marginBottom:8 }}>📅 التسوية المالية اليومية</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,.85)", lineHeight:1.9 }}>
          • يوم التسوية: <strong style={{ color:T.white }}>كل يوم — نهاية اليوم</strong><br/>
          • عمولة الحجز الأونلاين: <strong style={{ color:T.white }}>10% من قيمة الخدمة</strong> تُخصم من العربون<br/>
          • التحويل لك: لرقم الآيبان المسجّل في الإعدادات<br/>
          • تابع مستحقاتك من تبويب <strong style={{ color:T.white }}>💰 المالية</strong>
        </div>
      </div>

      {/* عمولة الحجز اليدوي — يحوّلها الصالون للمنصة */}
      <div style={{ background:`linear-gradient(135deg,#1976D2,#0D47A1)`, borderRadius:14, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.white, marginBottom:8 }}>🖐️ عمولة الحجز اليدوي — تحوّلينها للمنصة</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,.85)", lineHeight:1.9 }}>
          • عند تسجيل حجز يدوي (عميلة حاضرة تدفع كاش)، تستحق المنصة <strong style={{ color:T.white }}>3% من قيمة الخدمة الكاملة</strong><br/>
          • تابعي مستحقاتك المتراكمة من تبويب <strong style={{ color:T.white }}>💰 المالية → يدوي</strong><br/>
          • حوّلي المبلغ يومياً على رقم الآيبان:
        </div>
        <div style={{ background:"rgba(255,255,255,.15)", borderRadius:10, padding:"8px 12px", marginTop:8, textAlign:"center" }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.white, letterSpacing:1 }}>SA7080000584608016227161</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.7)", marginTop:2 }}>بيوتي تيك — الحساب الرسمي للمنصة</div>
        </div>
      </div>

      {/* ملخص العمولة */}
      <div style={{ background:`linear-gradient(135deg,${T.goldPale},#FFFBF0)`, borderRadius:14, padding:"14px 16px", marginBottom:16, border:`1px solid ${T.goldL}` }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:10 }}>💰 مثال — خدمة 200 ر.س</div>
        {[
          ["العربون (30%)", "60 ر.س", T.ink],
          ["عمولة المنصة (10%)", "10 ر.س", "#C62828"],
          ["يُحوَّل للصالون", "40 ر.س", "#2E7D32"],
          ["الباقي يُدفع عند الخدمة", "140 ر.س", T.roseDp],
        ].map(r => (
          <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:`1px solid ${T.creamDk}` }}>
            <span style={{ color:T.inkSoft }}>{r[0]}</span>
            <span style={{ fontWeight:700, color:r[2] }}>{r[1]}</span>
          </div>
        ))}
      </div>

      {/* تبويبات */}
      <div style={{ display:"flex", background:T.white, borderRadius:12, overflow:"hidden", marginBottom:14, border:`1px solid ${T.creamDk}` }}>
        {[
          { id:"platform", label:"المنصة والصالون" },
          { id:"client",   label:"الصالون والعميلة" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"10px", border:"none", borderBottom:`3px solid ${tab===t.id ? T.roseDp : "transparent"}`, background:"transparent", cursor:"pointer", fontSize:12, fontWeight:tab===t.id ? 700 : 400, color:tab===t.id ? T.roseDp : T.inkSoft, fontFamily:"Tajawal,sans-serif" }}>
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "platform" ? platformTerms : clientTerms).map(s => (
        <div key={s.t} style={{ marginBottom:12, background:T.white, borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:6 }}>{s.t}</div>
          <div style={{ fontSize:12, color:T.inkSoft, lineHeight:1.9, whiteSpace:"pre-line" }}>{s.b}</div>
        </div>
      ))}

      <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:T.inkSoft }}>
        للاستفسار: 0552401658
      </div>
    </div>
  )
}

function OwnerSettings({ toast }) {
  const [form, setForm] = useState({ salonName:"", ownerName:"", phone:"", email:"", city:"", bio:"", wa:"", insta:"", mapUrl:"", imageUrl:"", iban:"", bank_name:"" })
  const [photos, setPhotos] = useState([])
  const [focusF, setFocusF] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [salonId, setSalonId] = useState(null)
  const [salonImages, setSalonImages] = useState([])
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
            imageUrl: s.image_url || "",
            iban: s.iban || "",
            bank_name: s.bank_name || "",
          })
          setSalonImages(s.gallery || (s.image_url ? [s.image_url] : []))
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
      iban: form.iban,
      bank_name: form.bank_name,
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
          {form.imageUrl && (
            <div style={{ aspectRatio:"1", borderRadius:10, overflow:"hidden", position:"relative" }}>
              <img src={form.imageUrl} alt="صورة الصالون" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              <button onClick={async () => {
                const { error } = await supabase.from('salons').update({ image_url: null }).eq('id', salonId)
                if (error) { toast("⚠ تعذّر حذف الصورة: " + error.message); return }
                setForm(f => ({ ...f, imageUrl:"" }))
                toast("🗑 تم حذف الصورة")
              }} style={{ position:"absolute", top:4, left:4, width:22, height:22, borderRadius:"50%", background:T.red, border:"none", color:"#fff", fontSize:11, cursor:"pointer" }}>✕</button>
            </div>
          )}
          <label style={{ aspectRatio:"1", background:T.cream, borderRadius:10, border:`2px dashed ${T.roseL}`, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
            <span style={{ fontSize:22 }}>+</span>
            <span style={{ fontSize:10, color:T.inkSoft }}>إضافة صورة</span>
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
              const file = e.target.files[0]
              if (!file || !salonId) return
              setUploading(true)
              const ext = file.name.split('.').pop()
              const path = `salons/${salonId}_${Date.now()}.${ext}`
              const { error } = await supabase.storage.from('salon-images').upload(path, file, { upsert:true })
              if (error) { toast("⚠ فشل الرفع"); setUploading(false); return }
              const { data: urlData } = supabase.storage.from('salon-images').getPublicUrl(path)
              const url = urlData.publicUrl
              setForm(f => ({ ...f, imageUrl: url }))
              const { error: updateErr } = await supabase.from('salons').update({ image_url: url }).eq('id', salonId)
              setUploading(false)
              if (updateErr) { toast("⚠ رُفعت الصورة لكن تعذّر حفظها: " + updateErr.message); return }
              toast("✅ تم رفع الصورة!")
            }} />
          </label>
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
              { n:"١٠٪", l:"عمولة فقط" },
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
/* ══════════════════════════════════════════
   📱 SOCIAL ICON — أيقونات SVG حقيقية للتواصل
══════════════════════════════════════════ */
function SocialIcon({ type }) {
  if (type === "💬") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
  if (type === "📧") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={T.gold}>
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>
  )
  if (type === "📷") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="url(#igGrad)">
      <defs>
        <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDC80"/>
          <stop offset="50%" stopColor="#E1306C"/>
          <stop offset="100%" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
  if (type === "🎵") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#7B1FA2">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.78a4.85 4.85 0 01-1.01-.09z"/>
    </svg>
  )
  return <span style={{ fontSize:20 }}>{type}</span>
}

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
            { icon:"💬", title:"واتساب", desc:"تواصل مباشر مع الدعم", action:"https://wa.me/966552401658", color:T.waL, tcolor:"#25A050" },
            { icon:"📧", title:"البريد الإلكتروني", desc:"beauty.techn5@gmail.com", action:"mailto:beauty.techn5@gmail.com", color:T.roseL, tcolor:T.roseDp },
            { icon:"📷", title:"إنستغرام", desc:"@beauty.Techn", action:"https://instagram.com/beauty.Techn", color:T.goldPale, tcolor:T.gold },
            { icon:"🎵", title:"تيك توك", desc:"", action:"", color:"#E8F0FF", tcolor:"#4A4AFF" },
          ].map(it => (
            <a key={it.title} href={it.action || undefined} target={it.action ? "_blank" : undefined} rel="noreferrer"
              onClick={e => { if (!it.action) e.preventDefault() }}
              style={{ background:T.white, borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, textDecoration:"none", border:`1px solid ${T.creamDk}`, transition:"all .2s", opacity:it.action ? 1 : .5, cursor:it.action ? "pointer" : "default" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:it.color, display:"flex", alignItems:"center", justifyContent:"center" }}><SocialIcon type={it.icon} /></div>
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
      { q:"كيف أستلم مبالغ العربون؟", a:"تحصلين على 90% من قيمة الخدمة. نأخذ 10% عمولة من قيمة الخدمة الكاملة، تُخصم من العربون (30%). تُحوَّل مستحقاتك يومياً." },
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
function GiftPage({ setScreen, salon, setSalon }) {
  const toast = useToast()
  const salons = useSalons()
  const [step, setStep] = useState(1) // 1=اختيار الصالون, 2=اختيار الخدمات, 3=بيانات العميلة, 4=تم
  const [q, setQ] = useState("")
  const [selectedServices, setSelectedServices] = useState([])

  // نبدأ دايماً من اختيار الصالون — حتى لو كان فيه صالون محفوظ من شاشة حجز سابقة
  useEffect(() => { setSalon(null); setSelectedServices([]) }, [])
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [giftMessage, setGiftMessage] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [focusF, setFocusF] = useState(null)
  const [saving, setSaving] = useState(false)
  const [bookedTimes, setBookedTimes] = useState([])
  const [showPayment, setShowPayment] = useState(false)
  const [userId, setUserId] = useState(null)

  const filteredSalons = salons.filter(s =>
    !q || s.name.includes(q) || (s.city || "").includes(q)
  )

  const toggleService = (sv) => {
    setSelectedServices(prev =>
      prev.some(s => s.n === sv.n)
        ? prev.filter(s => s.n !== sv.n)
        : [...prev, sv]
    )
  }

  const totalAmount = selectedServices.reduce((s, sv) => s + (sv.p || 0), 0)
  const platformFee = Math.round(totalAmount * 0.10)   // 10% من المبلغ الكامل
  const salonNet = totalAmount - platformFee            // 90% للصالون

  const ALL_TIMES_GIFT = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"]

  // جلب الأوقات المحجوزة فعلياً لهذا الصالون والتاريخ — مشتركة مع الأونلاين واليدوي
  const refreshBookedTimes = () => {
    if (!date || !salon?.id) { setBookedTimes([]); return }
    supabase.from('bookings').select('appointment_time')
      .eq('salon_id', salon.id)
      .eq('appointment_date', date)
      .in('status', ['pending', 'confirmed', 'completed'])
      .then(({ data }) => setBookedTimes((data || []).map(b => b.appointment_time)))
  }
  useEffect(refreshBookedTimes, [date, salon?.id])
  const availableTimesGift = ALL_TIMES_GIFT.filter(t => !bookedTimes.includes(t))

  const inp = (k) => ({
    width:"100%", padding:"12px 14px",
    border:`1.5px solid ${focusF===k ? T.rose : T.creamDk}`,
    borderRadius:12, fontSize:14, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif", transition:"border-color .2s",
  })

  const serviceNames = selectedServices.map(s => s.n).join("، ")

  // فتح بوابة الدفع — المبلغ الكامل يُدفع فعلياً قبل إنشاء حجز الإهداء
  const openPayment = async () => {
    if (!agreed) { toast("⚠ يرجى الموافقة على الشروط"); return }
    if (!recipientName || !recipientPhone || !date || !time) { toast("⚠ أكملي كل البيانات"); return }
    const { data: { session } } = await supabase.auth.getSession()
    setUserId(session?.user?.id || null)
    setShowPayment(true)
  }

  // يُستدعى بعد نجاح الدفع والتحقق منه فعلياً عبر Edge Function
  const handlePaymentSuccess = () => {
    setShowPayment(false)

    // رسالة واتساب للمستلِمة نفسها — تبشّرها بالهدية وتفاصيل موعدها
    const recipientWaNum = (recipientPhone || "").replace(/^0/, "").replace(/[^0-9]/g, "")
    if (recipientWaNum) {
      const giftMsgText = "💝 وصلتك هدية!\n\n" +
        (giftMessage ? giftMessage + "\n\n" : "") +
        "تم حجز موعدك في " + salon.name + "\n" +
        "الخدمة: " + serviceNames + "\n" +
        "التاريخ: " + date + "\n" +
        "الوقت: " + time + "\n\n" +
        "المبلغ مدفوع بالكامل ✨ استمتعي بوقتك!"
      const giftMsg = encodeURIComponent(giftMsgText)
      setTimeout(() => window.open(`https://wa.me/966${recipientWaNum}?text=${giftMsg}`, "_blank"), 600)
    }

    // رسالة واتساب للصالون
    if (salon?.wa) {
      const waNum = (salon.wa).replace(/^0/, "").replace(/[^0-9]/g, "")
      const msg = encodeURIComponent(
        "💝 إهداء محبة جديد على بيوتي تيك!\n\n" +
        "العميلة: " + recipientName + "\n" +
        "الجوال: " + recipientPhone + "\n" +
        "الخدمات: " + serviceNames + "\n" +
        "التاريخ: " + date + "\n" +
        "الوقت: " + time + "\n" +
        "المبلغ الكامل مدفوع: " + totalAmount + " ر.س"
      )
      setTimeout(() => window.open(`https://wa.me/966${waNum}?text=${msg}`, "_blank"), 1400)
    }
    setStep(4)
  }

  // الخطوة 4 — تأكيد نهائي
  if (step === 4) return (
    <div style={{ background:T.cream, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ background:"linear-gradient(135deg,#C2185B,#880E4F)", borderRadius:24, padding:"32px 24px", textAlign:"center", marginBottom:20, boxShadow:"0 12px 40px rgba(194,24,91,.35)" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>💝</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.8)", marginBottom:4 }}>إهداء محبة إلى</div>
          <div style={{ fontSize:20, fontWeight:800, color:T.white, marginBottom:16 }}>{recipientName}</div>
          <div style={{ fontSize:36, fontWeight:900, color:T.white, marginBottom:4 }}>{totalAmount} ر.س</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,.8)" }}>{salon?.name}</div>
        </div>
        <div style={{ background:T.greenL, borderRadius:14, padding:"14px 16px", marginBottom:16, textAlign:"center" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.green, marginBottom:4 }}>✅ تم تأكيد الحجز والدفع الكامل!</div>
          <div style={{ fontSize:12, color:T.inkSoft }}>سيصل تأكيد الحجز على واتساب لـ {recipientPhone}</div>
        </div>
        <PBtn full onClick={() => { setSalon(null); setScreen("client-home") }}>← العودة للرئيسية</PBtn>
      </div>
    </div>
  )

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => step===1 ? setScreen("client-home") : setStep(step - 1)} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>إهداء محبة 💝</div>
      </div>

      <div style={{ padding:"20px 18px" }}>
        {/* شريط الخطوات */}
        <div style={{ display:"flex", gap:6, marginBottom:22 }}>
          {["اختاري الصالون","اختاري الخدمة","بيانات المُستلِمة"].map((lbl, i) => (
            <div key={lbl} style={{ flex:1 }}>
              <div style={{ height:4, borderRadius:4, background:step>i+1 ? T.roseDp : step===i+1 ? T.rose : T.creamDk, marginBottom:5, transition:"background .3s" }} />
              <div style={{ fontSize:9, color:step===i+1 ? T.roseDp : T.inkMuted, fontWeight:step===i+1 ? 700 : 400 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* خطوة 1: اختيار الصالون */}
        {step === 1 && (
          <div>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:44, marginBottom:8 }}>🌸</div>
              <div style={{ fontSize:17, fontWeight:800, color:T.ink, marginBottom:6 }}>أهدي جلسة جمال حقيقية</div>
              <p style={{ fontSize:13, color:T.inkSoft, lineHeight:1.7 }}>اختاري الصالون، ثم الخدمات، وادفعي المبلغ كاملاً — تستلم صاحبتها الموعد جاهزاً</p>
            </div>

            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحثي عن صالون أو مدينة..."
              style={{ ...inp("q"), marginBottom:14 }} onFocus={() => setFocusF("q")} onBlur={() => setFocusF(null)} />

            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filteredSalons.map(s => (
                <button key={s.id} onClick={() => { setSalon(s); setStep(2) }}
                  style={{ display:"flex", alignItems:"center", gap:12, background:T.white, borderRadius:14, padding:"12px 14px", border:`1.5px solid ${T.creamDk}`, cursor:"pointer", fontFamily:"Tajawal,sans-serif", textAlign:"right" }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:T.roseL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{s.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:T.ink }}>{s.name}</div>
                    <div style={{ fontSize:11, color:T.inkSoft }}>📍 {s.city} · {s.services?.length || 0} خدمة</div>
                  </div>
                  <span style={{ color:T.inkMuted }}>←</span>
                </button>
              ))}
              {filteredSalons.length === 0 && <Empty icon="🔍" title="لا توجد نتائج" desc="جرّبي اسماً آخر" />}
            </div>
          </div>
        )}

        {/* خطوة 2: اختيار الخدمات */}
        {step === 2 && salon && (
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:T.ink, marginBottom:4 }}>{salon.name}</div>
            <div style={{ fontSize:12, color:T.inkSoft, marginBottom:16 }}>اختاري خدمة أو أكثر — يمكنك إهداء أكثر من خدمة معاً</div>

            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:18 }}>
              {(salon.services || []).map(sv => {
                const isSelected = selectedServices.some(s => s.n === sv.n)
                return (
                  <button key={sv.n} onClick={() => toggleService(sv)}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:isSelected ? T.roseL : T.white, borderRadius:14, padding:"12px 14px", border:`2px solid ${isSelected ? T.roseDp : T.creamDk}`, cursor:"pointer", fontFamily:"Tajawal,sans-serif", textAlign:"right" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{sv.n}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:15, fontWeight:800, color:isSelected ? T.roseDp : T.gold }}>{sv.p} ر.س</span>
                      <span style={{ width:20, height:20, borderRadius:"50%", border:`2px solid ${isSelected ? T.roseDp : T.creamDk}`, background:isSelected ? T.roseDp : "transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:T.white }}>{isSelected ? "✓" : ""}</span>
                    </div>
                  </button>
                )
              })}
              {(!salon.services || salon.services.length === 0) && <Empty icon="✂️" title="لا توجد خدمات متاحة" desc="جرّبي صالوناً آخر" />}
            </div>

            {selectedServices.length > 0 && (
              <div style={{ background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, borderRadius:14, padding:"14px 16px", marginBottom:16, textAlign:"center" }}>
                <div style={{ fontSize:11, color:T.inkSoft, marginBottom:4 }}>المبلغ الإجمالي ({selectedServices.length} خدمة)</div>
                <div style={{ fontSize:26, fontWeight:900, color:T.roseDp }}>{totalAmount} ر.س</div>
              </div>
            )}

            <PBtn full disabled={selectedServices.length === 0} onClick={() => setStep(3)}>التالي ←</PBtn>
          </div>
        )}

        {/* خطوة 3: بيانات المُستلِمة + الموعد + الدفع */}
        {step === 3 && (
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
              <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:7 }}>رسالة الإهداء (اختياري)</label>
              <textarea placeholder="مثال: هديتك جلسة دلع تستحقينها 💝" value={giftMessage} onChange={e => setGiftMessage(e.target.value)} onFocus={() => setFocusF("gm")} onBlur={() => setFocusF(null)}
                style={{ ...inp("gm"), minHeight:70, resize:"vertical", fontFamily:"Tajawal,sans-serif" }} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:7 }}>التاريخ <span style={{ color:T.rose }}>*</span></label>
                <input type="date" value={date} onChange={e => { setDate(e.target.value); setTime("") }} style={inp("dt")} onFocus={() => setFocusF("dt")} onBlur={() => setFocusF(null)} />
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:700, color:T.inkSoft, display:"block", marginBottom:7 }}>الوقت <span style={{ color:T.rose }}>*</span></label>
                <select value={time} onChange={e => setTime(e.target.value)} style={inp("tm")} onFocus={() => setFocusF("tm")} onBlur={() => setFocusF(null)}>
                  <option value="">اختاري</option>
                  {availableTimesGift.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {date && availableTimesGift.length === 0 && (
                  <div style={{ fontSize:11, color:T.red, marginTop:6 }}>لا توجد أوقات متاحة بهذا اليوم — جرّبي تاريخاً آخر</div>
                )}
              </div>
            </div>

            {/* ملخص مالي واضح */}
            <div style={{ background:T.white, borderRadius:14, padding:"14px 16px", marginBottom:16, border:`1.5px solid ${T.roseL}` }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:10 }}>💝 ملخص الإهداء</div>
              {selectedServices.map(sv => (
                <div key={sv.n} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", color:T.inkSoft }}>
                  <span>{sv.n}</span><span>{sv.p} ر.س</span>
                </div>
              ))}
              <div style={{ height:1, background:T.creamDk, margin:"8px 0" }} />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:800, color:T.roseDp }}>
                <span>المبلغ الكامل (يُدفع الآن)</span><span>{totalAmount} ر.س</span>
              </div>
            </div>

            <label style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:18, cursor:"pointer" }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop:3 }} />
              <span style={{ fontSize:12, color:T.inkSoft, lineHeight:1.6 }}>أوافق أن المبلغ يُدفع كاملاً الآن ولا يُسترجع إلا حسب سياسة الإلغاء</span>
            </label>

            <PBtn full onClick={openPayment}>
              💝 الدفع وتأكيد الإهداء {totalAmount} ر.س
            </PBtn>
          </div>
        )}
      </div>

      {showPayment && (
        <MoyasarPaymentModal
          amount={totalAmount}
          description={`إهداء محبة — ${serviceNames} — ${salon.name}`}
          toast={toast}
          onClose={() => setShowPayment(false)}
          bookingFields={{
            salon_id: salon.id,
            client_name: recipientName,
            client_phone: recipientPhone,
            appointment_date: date,
            appointment_time: time,
            total_amount: totalAmount,
            deposit_amount: totalAmount,
            platform_fee: platformFee,
            salon_amount: salonNet,
            status: 'confirmed',
            user_id: userId,
            service_name: serviceNames,
            booking_type: 'love_gift',
            gift_message: giftMessage || null,
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
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
    const { error } = await supabase.from('bookings').update({ rating: selected }).eq('id', bookingId)
    if (error) { toast("⚠ تعذّر حفظ التقييم: " + error.message); return }
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
   👤 CLIENT PROFILE PAGE
══════════════════════════════════════════ */
function ClientProfile({ setScreen }) {
  const toast = useToast()
  const [form, setForm] = useState({ name:"", phone:"", email:"", city:"" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clientId, setClientId] = useState(null)
  const [focusF, setFocusF] = useState(null)
  const [referralCode, setReferralCode] = useState("")
  const [wallet, setWallet] = useState({ total: 0, credits: [] })
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))

  const generateRefCode = () => "BT" + Math.random().toString(36).slice(2, 8).toUpperCase()

  const loadWallet = async (cId) => {
    const { data } = await supabase.from('wallet_credits')
      .select('*').eq('client_id', cId)
      .gt('remaining', 0)
      .order('expires_at', { ascending: true })
    const valid = (data || []).filter(c => !c.expires_at || new Date(c.expires_at) > new Date())
    setWallet({ total: valid.reduce((s, c) => s + Number(c.remaining), 0), credits: valid })
  }

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setScreen("client-login"); return }
      const { data } = await supabase.from('clients').select('*').eq('email', session.user.email)
      if (data && data[0]) {
        setClientId(data[0].id)
        setForm({
          name: data[0].full_name || "",
          phone: data[0].phone || "",
          email: data[0].email || "",
          city: data[0].city || "",
        })
        if (data[0].referral_code) {
          setReferralCode(data[0].referral_code)
        } else {
          // أول زيارة — ننشئ كود إحالة فريد
          const newCode = generateRefCode()
          await supabase.from('clients').update({ referral_code: newCode }).eq('id', data[0].id)
          setReferralCode(newCode)
        }
        loadWallet(data[0].id)
      } else {
        setForm(f => ({ ...f, email: session.user.email || "", name: session.user.user_metadata?.name || "" }))
      }
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }
    let saveError = null
    if (clientId) {
      const { error } = await supabase.from('clients').update({ full_name:form.name, phone:form.phone, city:form.city }).eq('id', clientId)
      saveError = error
    } else {
      const { error } = await supabase.from('clients').insert([{ full_name:form.name, phone:form.phone, email:form.email, city:form.city }])
      saveError = error
    }
    setSaving(false)
    if (saveError) { toast("⚠ تعذّر حفظ بياناتك: " + saveError.message); return }
    toast("✅ تم حفظ بياناتك!")
  }

  const inp = (k) => ({
    width:"100%", padding:"13px 16px",
    border:`1.5px solid ${focusF===k ? T.rose : T.creamDk}`,
    borderRadius:12, fontSize:14, color:T.ink, background:T.cream,
    outline:"none", fontFamily:"Tajawal,sans-serif", transition:"border-color .2s",
  })

  if (loading) return <div style={{ padding:40, textAlign:"center", color:T.inkSoft }}>...جاري التحميل</div>

  return (
    <div style={{ background:T.cream, minHeight:"100vh", paddingBottom:40 }}>
      <div style={{ background:T.white, borderBottom:`1px solid ${T.roseL}`, padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setScreen("client-home")} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer", fontSize:16 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:T.ink }}>ملفي الشخصي 👤</div>
      </div>

      <div style={{ padding:"24px 18px" }}>
        {/* Avatar */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ width:80, height:80, borderRadius:"50%", background:`linear-gradient(135deg,${T.roseL},${T.goldPale})`, margin:"0 auto 12px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>
            💅
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:T.ink }}>{form.name || "اسمك هنا"}</div>
          <div style={{ fontSize:13, color:T.inkSoft }}>{form.email}</div>
        </div>

        {/* محفظتي */}
        <div style={{ background:`linear-gradient(135deg,${T.gold},${T.gold2})`, borderRadius:16, padding:"16px 18px", marginBottom:16, textAlign:"center" }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,.85)", marginBottom:4 }}>💰 رصيد محفظتي</div>
          <div style={{ fontSize:26, fontWeight:900, color:T.white }}>{wallet.total.toLocaleString()} ر.س</div>
          {wallet.credits.length > 0 && (
            <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:4 }}>
              {wallet.credits.map(c => (
                <div key={c.id} style={{ fontSize:10, color:"rgba(255,255,255,.85)", display:"flex", justifyContent:"space-between" }}>
                  <span>{Number(c.remaining).toLocaleString()} ر.س</span>
                  <span>ينتهي: {c.expires_at ? new Date(c.expires_at).toLocaleDateString("ar-SA") : "لا ينتهي"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* رابط الإحالة */}
        <div style={{ background:T.white, borderRadius:16, padding:"16px 18px", marginBottom:16, border:`1.5px solid ${T.roseL}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:6 }}>🎁 رشّحي صالوناً واكسبي 200 ر.س</div>
          <p style={{ fontSize:11, color:T.inkSoft, lineHeight:1.7, marginBottom:12 }}>
            شاركي رابطك مع أي صالون تعرفينه — لما يسجّل وتُفعَّل المنصة حسابه، تنزل لك 200 ر.س بمحفظتك تلقائياً.
          </p>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1, background:T.cream, borderRadius:10, padding:"10px 12px", fontSize:12, color:T.inkSoft, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {window.location.origin}?ref={referralCode}
            </div>
            <button onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}?ref=${referralCode}`)
                toast("✅ تم نسخ رابط الإحالة!")
              }}
              style={{ padding:"10px 16px", borderRadius:10, border:"none", background:T.roseDp, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              📋 نسخ
            </button>
          </div>
        </div>

        <Card style={{ padding:18, marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:16 }}>بياناتي</div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>الاسم الكامل</label>
            <input value={form.name} onChange={set("name")} placeholder="اسمك الكامل"
              onFocus={() => setFocusF("n")} onBlur={() => setFocusF(null)} style={inp("n")} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>رقم الجوال</label>
            <input type="tel" value={form.phone} onChange={set("phone")} placeholder="05xxxxxxxx"
              onFocus={() => setFocusF("p")} onBlur={() => setFocusF(null)} style={inp("p")} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>البريد الإلكتروني</label>
            <input value={form.email} disabled
              style={{ ...inp("e"), opacity:.6, cursor:"not-allowed" }} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:700, color:T.inkSoft, marginBottom:7 }}>المدينة</label>
            <select value={form.city} onChange={set("city")}
              onFocus={() => setFocusF("c")} onBlur={() => setFocusF(null)}
              style={{ ...inp("c"), cursor:"pointer" }}>
              <option value="">اختاري مدينتك</option>
              {["الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام","الخبر","أبها","تبوك","القصيم"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <PBtn full disabled={saving} onClick={save}>{saving ? "...جاري الحفظ" : "✓ حفظ البيانات"}</PBtn>
        </Card>

        {/* Quick links */}
        <Card style={{ padding:18 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:14 }}>الوصول السريع</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={() => setScreen("my-bookings")}
              style={{ padding:"12px 16px", borderRadius:12, border:`1px solid ${T.creamDk}`, background:T.cream, color:T.ink, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Tajawal,sans-serif", textAlign:"right", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>←</span>
              <span>📅 حجوزاتي</span>
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); setScreen("client-home") }}
              style={{ padding:"12px 16px", borderRadius:12, border:`1px solid ${T.redL}`, background:T.white, color:T.red, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Tajawal,sans-serif", textAlign:"right", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>←</span>
              <span>🚪 تسجيل الخروج</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   📅 MY BOOKINGS PAGE — للعميلة
══════════════════════════════════════════ */
function MyBookingsPage({ setScreen, setSalon }) {
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
    const { error } = await supabase.from('bookings').update({ status:'cancelled' }).eq('id', id)
    if (error) { toast("⚠ تعذّر إلغاء الحجز: " + error.message); return }
    setBookings(b => b.map(bk => bk.id === id ? { ...bk, status:'cancelled' } : bk))
    toast("تم إلغاء الحجز")
  }

  // إعادة حجز نفس الموعد بسهولة — تجلب بيانات الصالون وخدماته الفعلية وتفتح صفحة الحجز
  const rebook = async (bk) => {
    const { data: salonRows } = await supabase.from('salons').select('*').eq('id', bk.salon_id)
    if (!salonRows?.[0]) { toast("⚠ تعذّر الوصول لبيانات الصالون"); return }
    const s = salonRows[0]
    const { data: svcRows } = await supabase.from('services').select('*').eq('salon_id', bk.salon_id).eq('active', true)
    const services = (svcRows || []).map(sv => ({ n: sv.name, p: sv.price, dur: sv.duration, timeFrom: sv.time_from, timeTo: sv.time_to, days: sv.days }))
    setSalon({
      id: s.id,
      name: s.name,
      wa: s.phone || "0500000000",
      services: services.length ? services : [{ n: bk.service_name, p: bk.total_amount, dur:60 }],
    })
    setScreen("booking")
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
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                  <span style={{ background:st.bg, color:st.color, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{st.label}</span>
                  {bk.booking_type === "offer" && <span style={{ background:T.roseL, color:T.roseDp, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>🏷️ عرض</span>}
                  {bk.booking_type === "love_gift" && <span style={{ background:"#FCE4EC", color:"#E91E63", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>💝 إهداء محبة</span>}
                  {bk.booking_type === "voucher" && <span style={{ background:T.greenL, color:T.green, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>🎟️ قسيمة</span>}
                  {bk.booking_type === "package" && <span style={{ background:T.goldPale, color:T.gold, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>🎁 باقة</span>}
                </div>
                </div>

                <div style={{ background:T.cream, borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
                  {[
                    ["📋 الخدمة", bk.service_name || bk.service_id || "—"],
                    ["🏷️ النوع", bk.booking_type === "offer" ? "عرض خاص" : bk.booking_type === "package" ? "باقة" : "خدمة عادية"],
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
                {bk.status === "completed" && (
                  <button onClick={() => rebook(bk)}
                    style={{ width:"100%", padding:"9px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${T.roseDp},${T.rose})`, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif", marginBottom:8 }}>
                    🔄 احجزي نفس الموعد تاني
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


function ManualDepositEntry({ bookings, onUpdate, toast }) {
  const [selected, setSelected] = useState("")
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)

  // الحجوزات المكتملة بدون عربون مُدخل
  const incomplete = bookings.filter(b => !b.deposit_amount || b.deposit_amount === 0)
  const allBookings = bookings

  const save = async () => {
    if (!selected || !amount) { toast("⚠ اختر حجزاً وأدخل المبلغ"); return }
    const bk = allBookings.find(b => b.id === selected)
    if (!bk) { return }
    const deposit = Number(amount)
    const platformFee = Math.round((bk.total_amount||0) * 0.10)
    const salonNet = deposit - platformFee
    if (salonNet < 0) {
      toast("⚠ العربون المُدخل (" + deposit + " ر.س) أقل من عمولة المنصة (" + platformFee + " ر.س) — تحقق من المبلغ")
      return
    }
    setSaving(true)

    const { error } = await supabase.from("bookings").update({
      deposit_amount: deposit,
      platform_fee: platformFee,
      salon_net_amount: salonNet,
      salon_amount: salonNet,
    }).eq("id", selected)

    setSaving(false)
    if (error) { toast("⚠ فشل حفظ العربون: " + error.message); return }
    setSelected("")
    setAmount("")
    toast("✅ تم تسجيل العربون!")
    onUpdate()
  }

  const selectedBk = allBookings.find(b => b.id === selected)
  const previewDeposit = Number(amount) || 0
  const previewFee = selectedBk ? Math.round((selectedBk.total_amount||0) * 0.10) : 0
  const previewNet = previewDeposit - previewFee

  return (
    <div>
      <div style={{ marginBottom:10 }}>
        <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:5 }}>اختر الحجز</label>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.rose}`, borderRadius:10, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white, color:T.ink, outline:"none" }}>
          <option value="">— اختر حجزاً —</option>
          {allBookings.map(b => (
            <option key={b.id} value={b.id}>
              {b.client_name} · {b.appointment_date} · {b.total_amount||0} ر.س
              {b.deposit_amount > 0 ? " ✅" : " ⏳"}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom:10 }}>
        <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:5 }}>مبلغ العربون المستلم (ر.س)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder={selectedBk ? "المقترح: " + Math.round((selectedBk.total_amount||0)*0.3) : "0"}
          style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${T.rose}`, borderRadius:10, fontSize:14, fontFamily:"Tajawal,sans-serif", background:T.white, color:T.ink, outline:"none" }} />
      </div>

      {/* معاينة التوزيع */}
      {amount > 0 && selectedBk && (
        <div style={{ background:T.white, borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.ink, marginBottom:6 }}>معاينة التوزيع:</div>
          {[
            ["قيمة الخدمة", (selectedBk.total_amount||0) + " ر.س", T.ink],
            ["العربون المستلم", previewDeposit + " ر.س", T.ink],
            ["عمولة المنصة (10%)", previewFee + " ر.س", "#C62828"],
            ["صافي الصالون", previewNet + " ر.س", "#2E7D32"],
          ].map(r => (
            <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"3px 0", borderBottom:`1px solid ${T.creamDk}` }}>
              <span style={{ color:T.inkSoft }}>{r[0]}</span>
              <span style={{ fontWeight:700, color:r[2] }}>{r[1]}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={save} disabled={saving}
        style={{ width:"100%", padding:"10px", borderRadius:10, border:"none", background:T.roseDp, color:T.white, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
        {saving ? "...جاري الحفظ" : "✓ تسجيل العربون"}
      </button>
    </div>
  )
}


function AdminCommissions() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0])
  const toast = useToast()

  useEffect(() => { load() }, [dateFrom, dateTo])

  const load = async () => {
    setLoading(true)
    // جلب كل الحجوزات (مكتملة ومعلقة) لحساب العمولات الكاملة
    const { data } = await supabase.from("bookings")
      .select("*, salons(name)")
      .gte("appointment_date", dateFrom)
      .lte("appointment_date", dateTo)
      .order("appointment_date", { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }

  const completedBks = bookings.filter(b => b.status === "completed")
  const getFee = (b) => calcCommission(b).fee
  const totalCommission    = completedBks.filter(b=>b.booking_type!=="manual").reduce((s,b) => s + getFee(b), 0)
  const settledCommission  = completedBks.filter(b => b.payment_status==="settled" && b.booking_type!=="manual").reduce((s,b) => s + getFee(b), 0)
  const pendingCommission  = completedBks.filter(b => b.payment_status!=="settled" && b.booking_type!=="manual").reduce((s,b) => s + getFee(b), 0)
  const loveGiftCommission = completedBks.filter(b => b.booking_type==="love_gift").reduce((s,b) => s + getFee(b), 0)
  const serviceCommission  = completedBks.filter(b => b.booking_type!=="love_gift" && b.booking_type!=="manual").reduce((s,b) => s + getFee(b), 0)
  // عمولة الحجز اليدوي — مستحقة من الصالون للمنصة (عكس الاتجاه)
  const manualBks = completedBks.filter(b => b.booking_type === "manual")
  const manualCommission        = manualBks.reduce((s,b) => s + getFee(b), 0)
  const manualCommissionSettled = manualBks.filter(b=>b.payment_status==="settled").reduce((s,b) => s + getFee(b), 0)
  const manualCommissionPending = manualBks.filter(b=>b.payment_status!=="settled").reduce((s,b) => s + getFee(b), 0)

  const exportCSV = () => {
    const rows = [
      ["التاريخ","الصالون","العميلة","الخدمة","النوع","قيمة الخدمة","نسبة العمولة","قيمة العمولة","الاتجاه","حالة التحويل"],
      ...bookings.map(b => {
        const isManualType = b.booking_type === "manual"
        const { fee } = calcCommission(b)
        return [
          b.appointment_date||"",
          b.salons?.name||"",
          b.client_name||"",
          b.service_name||"",
          b.booking_type==="love_gift"?"💝 إهداء محبة":b.booking_type==="manual"?"🖐️ حجز يدوي":b.booking_type==="voucher"?"🎟️ قسيمة":"✂️ خدمة",
          b.total_amount||0,
          isManualType ? "3%" : "10%",
          fee,
          isManualType ? "مستحقة عليك من الصالون" : "مستحقة لك",
          b.payment_status==="settled" ? (isManualType ? "محصّلة" : "محوَّلة") : "معلقة",
        ]
      })
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "عمولات_بيوتي_تيك_" + dateFrom + ".csv"
    a.click()
    toast("✅ تم تصدير تقرير العمولات!")
  }

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:4 }}>💸 تفاصيل عمولات المنصة</div>
      <div style={{ fontSize:11, color:T.inkSoft, marginBottom:16 }}>أونلاين/إهداء: 10% مستحقة لك · يدوي: 3% مستحقة عليك من الصالون</div>

      {/* ملخص */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <div style={{ background:`linear-gradient(135deg,#1B5E20,#2E7D32)`, borderRadius:14, padding:"14px", textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:900, color:T.white }}>{totalCommission.toLocaleString()}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.8)" }}>إجمالي العمولات</div>
        </div>
        <div style={{ background:`linear-gradient(135deg,${T.gold},${T.gold2})`, borderRadius:14, padding:"14px", textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:900, color:T.white }}>{pendingCommission.toLocaleString()}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.8)" }}>⏳ عمولات معلقة</div>
        </div>
        <div style={{ background:T.white, borderRadius:14, padding:"14px", textAlign:"center", border:`1px solid ${T.creamDk}` }}>
          <div style={{ fontSize:18, fontWeight:900, color:"#C2185B" }}>{loveGiftCommission.toLocaleString()}</div>
          <div style={{ fontSize:10, color:T.inkSoft }}>💝 إهداء المحبة</div>
        </div>
        <div style={{ background:T.white, borderRadius:14, padding:"14px", textAlign:"center", border:`1px solid ${T.creamDk}` }}>
          <div style={{ fontSize:18, fontWeight:900, color:T.roseDp }}>{serviceCommission.toLocaleString()}</div>
          <div style={{ fontSize:10, color:T.inkSoft }}>✂️ خدمات عادية</div>
        </div>
        <div style={{ background:"linear-gradient(135deg,#1976D2,#0D47A1)", borderRadius:14, padding:"14px", textAlign:"center", gridColumn:"span 2" }}>
          <div style={{ fontSize:20, fontWeight:900, color:T.white }}>{manualCommission.toLocaleString()} ر.س</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,.85)", marginTop:3 }}>🖐️ عمولة الحجز اليدوي (3%) — مستحقة من الصالونات</div>
          <div style={{ display:"flex", justifyContent:"center", gap:14, marginTop:8, fontSize:10, color:"rgba(255,255,255,.85)" }}>
            <span>✅ محصّلة: {manualCommissionSettled.toLocaleString()} ر.س</span>
            <span>⏳ معلقة: {manualCommissionPending.toLocaleString()} ر.س</span>
          </div>
        </div>
      </div>

      {/* فلاتر */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
        <div>
          <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>من تاريخ</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ width:"100%", padding:"9px 10px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white }} />
        </div>
        <div>
          <label style={{ fontSize:11, color:T.inkSoft, display:"block", marginBottom:4 }}>إلى تاريخ</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ width:"100%", padding:"9px 10px", border:`1px solid ${T.creamDk}`, borderRadius:8, fontSize:12, fontFamily:"Tajawal,sans-serif", background:T.white }} />
        </div>
      </div>

      <button onClick={exportCSV}
        style={{ width:"100%", padding:"10px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.green},#1B5E20)`, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif", marginBottom:14 }}>
        📊 تصدير تقرير العمولات CSV
      </button>

      {loading && <div style={{ textAlign:"center", padding:20, color:T.inkSoft }}>...جاري التحميل</div>}
      {!loading && bookings.length === 0 && <Empty icon="💸" title="لا توجد عمولات" desc="جرّب تغيير الفترة" />}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {bookings.map(bk => {
          const isLoveGift = bk.booking_type === "love_gift"
          const isManual = bk.booking_type === "manual"
          const { fee, salonGet } = calcCommission(bk)
          return (
            <div key={bk.id} style={{ background:T.white, borderRadius:12, padding:"12px 14px", border:`1.5px solid ${isLoveGift ? "#F8BBD0" : isManual ? "#90CAF9" : T.creamDk}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div>
                  <span style={{ fontSize:13, fontWeight:700, color:T.ink }}>{bk.salons?.name || "صالون"}</span>
                  <span style={{ fontSize:11, color:T.inkSoft, marginRight:8 }}> · {bk.client_name}</span>
                </div>
                <span style={{ background:bk.payment_status==="settled" ? T.greenL : isManual ? "#E3F2FD" : T.roseL, color:bk.payment_status==="settled" ? T.green : isManual ? "#1976D2" : T.roseDp, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>
                  {bk.payment_status === "settled" ? (isManual ? "✅ حُصِّلت" : "✅ محوَّل") : (isManual ? "⏳ مستحقة على الصالون" : "⏳ معلق")}
                </span>
              </div>
              <div style={{ fontSize:11, color:T.inkSoft, marginBottom:6 }}>
                {isLoveGift ? "💝 إهداء محبة" : isManual ? "🖐️ حجز يدوي" : "✂️ خدمة"} · {bk.appointment_date} · {bk.service_name||""}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                <div style={{ background:T.cream, borderRadius:8, padding:"6px", textAlign:"center" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{(bk.total_amount||0).toLocaleString()} ر.س</div>
                  <div style={{ fontSize:9, color:T.inkSoft }}>{isManual ? "المبلغ المستلم كاش" : "قيمة الخدمة"}</div>
                </div>
                <div style={{ background:"#FFEBEE", borderRadius:8, padding:"6px", textAlign:"center" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#C62828" }}>{fee.toLocaleString()} ر.س</div>
                  <div style={{ fontSize:9, color:T.inkSoft }}>عمولتك ({isManual ? "3%" : "10%"})</div>
                </div>
                <div style={{ background:T.greenL, borderRadius:8, padding:"6px", textAlign:"center" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.green }}>{salonGet.toLocaleString()} ر.س</div>
                  <div style={{ fontSize:9, color:T.inkSoft }}>{isManual ? "صافي الصالون" : "للصالون"}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AdminSettlement() {
  const [bookings, setBookings] = useState([])
  const [salons, setSalons] = useState([])
  const [loading, setLoading] = useState(true)
  const [dayFilter, setDayFilter] = useState("today")
  const [selectedSalon, setSelectedSalon] = useState("all")
  const [settling, setSettling] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const toast = useToast()

  useEffect(() => { loadData() }, [dayFilter])

  const loadHistory = async () => {
    try {
      const { data } = await supabase.from("settlement_history")
        .select("*").order("date", { ascending: false }).limit(30)
      setHistory(data || [])
    } catch(e) { setHistory([]) }
  }

  useEffect(() => { loadHistory() }, [])

  const getDayRange = () => {
    const now = new Date()
    const today = now.toISOString().split("T")[0]
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0]
    const week = new Date(now)
    week.setDate(now.getDate() - 7)
    const weekStr = week.toISOString().split("T")[0]

    if (dayFilter === "today")     return { from: today,        to: today,     label: "اليوم" }
    if (dayFilter === "yesterday") return { from: yesterdayStr, to: yesterdayStr, label: "أمس" }
    if (dayFilter === "week")      return { from: weekStr,      to: today,     label: "آخر 7 أيام" }
    return { from: today, to: today, label: "اليوم" }
  }

  const loadData = async () => {
    setLoading(true)
    const { from, to } = getDayRange()
    // جلب الحجوزات المكتملة في الفترة + كل المعلقة (بغض النظر عن التاريخ)
    const { data: bks } = await supabase.from("bookings")
      .select("*, salons(name, phone, iban, bank_name)")
      .eq("status", "completed")
    const { data: sls } = await supabase.from("salons").select("id,name,phone,iban,bank_name")
    // فلترة حسب الفترة للعرض فقط
    const filtered = (bks || []).filter(b => {
      if (dayFilter === "today" || dayFilter === "yesterday") {
        return b.appointment_date >= from && b.appointment_date <= to
      }
      // "week" + الافتراضي: اعرض كل المعلقة + الفترة
      return b.payment_status !== "settled" || (b.appointment_date >= from && b.appointment_date <= to)
    })
    setBookings(filtered)
    setSalons(sls || [])
    setLoading(false)
  }

  // تجميع مستحقات كل صالون
  const getSalonSummary = () => {
    const summary = {}
    const filtered = selectedSalon === "all" ? bookings : bookings.filter(b => b.salon_id === selectedSalon)
    filtered.forEach(b => {
      const sid = b.salon_id
      if (!summary[sid]) {
        summary[sid] = {
          salonId: sid,
          name: b.salons?.name || "صالون",
          phone: b.salons?.phone || "",
          iban: b.salons?.iban || "—",
          bank: b.salons?.bank_name || "—",
          totalSales: 0,
          platformFee: 0,
          netAmount: 0,
          bookingsCount: 0,
          pendingCount: 0,
          loveGiftAmount: 0,
          loveGiftFee: 0,
          loveGiftNet: 0,
          // مديونية الحجز اليدوي — مستحقة من الصالون للمنصة (عكس الاتجاه)
          manualOwedTotal: 0,
          manualOwedPending: 0,
          manualBookingsCount: 0,
        }
      }
      const { fee, salonGet } = calcCommission(b)
      if (b.booking_type === "manual") {
        summary[sid].manualOwedTotal += fee
        summary[sid].manualBookingsCount++
        if (b.payment_status !== "settled") summary[sid].manualOwedPending += fee
        return // لا تُحسب ضمن netAmount العادي — اتجاه معكوس
      }
      summary[sid].totalSales += b.total_amount || 0
      summary[sid].platformFee += fee
      summary[sid].netAmount += salonGet
      if (b.booking_type === "love_gift") {
        summary[sid].loveGiftAmount += b.total_amount || 0
        summary[sid].loveGiftFee += fee
        summary[sid].loveGiftNet += salonGet
      }
      summary[sid].bookingsCount++
      if (b.payment_status !== "settled") summary[sid].pendingCount++
    })
    return Object.values(summary)
  }

  const summary = getSalonSummary()
  const totalPlatformFee = summary.reduce((s, x) => s + x.platformFee, 0)
  const totalNet = summary.reduce((s, x) => s + x.netAmount, 0)
  const pendingSalons = summary.filter(s => s.pendingCount > 0)
  // الصالونات المديونة للمنصة من الحجز اليدوي
  const debtorSalons = summary.filter(s => s.manualOwedPending > 0)
  const totalManualDebt = debtorSalons.reduce((s, x) => s + x.manualOwedPending, 0)

  const collectManualDebt = async (sid) => {
    const { error } = await supabase.from("bookings")
      .update({ payment_status: "settled", settled_at: new Date().toISOString() })
      .eq("salon_id", sid).eq("booking_type", "manual").neq("payment_status", "settled")
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    toast("✅ تم تسجيل تحصيل العمولة من الصالون")
    loadData()
  }

  // تصدير CSV
  const exportCSV = () => {
    const { from, to, label } = getDayRange()
    const rows = [
      ["اسم الصالون", "رقم الآيبان", "البنك", "إجمالي المبيعات", "عمولة المنصة", "صافي المستحقات", "عدد الحجوزات"],
      ...pendingSalons.map(s => [s.name, s.iban, s.bank, s.totalSales, s.platformFee, s.netAmount, s.bookingsCount])
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob(["" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "تسوية_يومية_بيوتي_تيك_" + from + ".csv"
    a.click()
    toast("✅ تم تصدير ملف التسوية!")
  }

  // اعتماد التسوية اليومية + حفظ في التاريخ
  const settleAll = async () => {
    if (pendingSalons.length === 0) { toast("لا توجد مستحقات معلقة"); return }
    setSettling(true)
    const today = new Date().toISOString().split("T")[0]
    const pendingIds = bookings.filter(b => b.payment_status !== "settled").map(b => b.id)
    // تحديث حالة الحجوزات — هذي أهم عملية بالتسوية، لازم نتأكد إنها نجحت فعلاً
    const { error: updateError } = await supabase.from("bookings")
      .update({ payment_status: "settled", settled_at: new Date().toISOString() })
      .in("id", pendingIds)
    if (updateError) {
      setSettling(false)
      toast("⚠ فشلت التسوية! لم يتم تحديث أي حجز: " + updateError.message)
      return
    }
    // حفظ سجل التسوية (للأرشفة والمرجعية)
    const settlementRecord = {
      date: today,
      salons_count: pendingSalons.length,
      total_net: totalNet,
      platform_fee: totalPlatformFee,
      bookings_count: pendingIds.length,
      details: pendingSalons.map(s => ({
        salon_name: s.name,
        iban: s.iban,
        net: s.netAmount,
        fee: s.platformFee,
        bookings: s.bookingsCount,
        has_love_gifts: s.loveGiftAmount > 0,
      }))
    }
    const { error: historyError } = await supabase.from("settlement_history").insert([settlementRecord])
    setSettling(false)
    if (historyError) {
      toast("✅ تمت التسوية، لكن تعذّر حفظها بالسجل التاريخي: " + historyError.message)
    } else {
      toast("✅ تمت التسوية! حُوِّل " + totalNet.toLocaleString() + " ر.س لـ " + pendingSalons.length + " صالون")
    }
    loadData()
    loadHistory()
  }

  const { from, to, label } = getDayRange()

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:T.ink, marginBottom:6 }}>💳 إدارة التسوية المالية</div>
      <div style={{ fontSize:12, color:T.inkSoft, marginBottom:16 }}>يوم التسوية: كل يوم — نهاية اليوم</div>

      {/* فلاتر يومية */}
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {[
          { id:"today",     label:"اليوم" },
          { id:"yesterday", label:"أمس" },
          { id:"week",      label:"7 أيام" },
        ].map(d => (
          <button key={d.id} onClick={() => setDayFilter(d.id)}
            style={{ flex:1, padding:"9px", borderRadius:10, border:`2px solid ${dayFilter===d.id ? T.roseDp : T.creamDk}`, background:dayFilter===d.id ? T.roseL : T.white, color:dayFilter===d.id ? T.roseDp : T.inkSoft, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
            {d.label}
          </button>
        ))}
      </div>

      {/* شرح التسوية */}
      <div style={{ background:T.goldPale, borderRadius:12, padding:"10px 14px", marginBottom:12, border:`1px solid ${T.goldL}` }}>
        <div style={{ fontSize:12, color:T.inkSoft, lineHeight:1.8 }}>
          📌 <strong style={{ color:T.ink }}>خطوات التسوية:</strong><br/>
          ١. صدّر ملف CSV واحفظه<br/>
          ٢. ارفعه للبنك وحوّل المبالغ<br/>
          ٣. ارجع واضغط "اعتماد التحويل"
        </div>
      </div>

      <div style={{ fontSize:11, color:T.inkSoft, marginBottom:16, background:T.cream, padding:"8px 12px", borderRadius:8 }}>
        📅 الفترة: {from} — {to} · {label}
      </div>

      {/* ملخص إجمالي */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
        <div style={{ background:`linear-gradient(135deg,${T.gold},${T.gold2})`, borderRadius:12, padding:"12px", textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:900, color:T.white }}>{totalNet.toLocaleString()}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,.8)" }}>إجمالي المحولات</div>
        </div>
        <div style={{ background:`linear-gradient(135deg,${T.roseDp},#7A3020)`, borderRadius:12, padding:"12px", textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:900, color:T.white }}>{totalPlatformFee.toLocaleString()}</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,.8)" }}>عمولة المنصة</div>
        </div>
        <div style={{ background:T.white, borderRadius:12, padding:"12px", textAlign:"center", border:`1px solid ${T.creamDk}` }}>
          <div style={{ fontSize:18, fontWeight:900, color:T.roseDp }}>{pendingSalons.length}</div>
          <div style={{ fontSize:9, color:T.inkSoft }}>صالون معلق</div>
        </div>
      </div>

      {/* لوحة مديونية الحجز اليدوي — مستحقات المنصة من الصالونات */}
      {debtorSalons.length > 0 && (
        <div style={{ background:"linear-gradient(135deg,#1976D2,#0D47A1)", borderRadius:16, padding:"16px", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.white }}>🖐️ مديونية الحجز اليدوي</div>
            <div style={{ fontSize:18, fontWeight:900, color:T.white }}>{totalManualDebt.toLocaleString()} ر.س</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {debtorSalons.map(s => (
              <div key={s.salonId} style={{ background:"rgba(255,255,255,.12)", borderRadius:12, padding:"10px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.white }}>{s.name}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.8)" }}>{s.manualBookingsCount} حجز يدوي · {s.phone}</div>
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:14, fontWeight:800, color:"#FFD54F", marginBottom:4 }}>{s.manualOwedPending.toLocaleString()} ر.س</div>
                  <button onClick={() => collectManualDebt(s.salonId)}
                    style={{ padding:"4px 12px", borderRadius:20, border:"none", background:T.white, color:"#1976D2", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    ✅ تم التحصيل
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* أزرار التصدير والاعتماد */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={exportCSV}
          style={{ flex:1, padding:"11px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.green},#1B5E20)`, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
          📊 تصدير CSV
        </button>
        <button onClick={settleAll} disabled={settling}
          style={{ flex:1, padding:"11px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${T.gold},${T.gold2})`, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
          {settling ? "...جاري" : "✅ اعتماد التحويل"}
        </button>
      </div>

      {/* سجل التسويات السابقة */}
      <div style={{ marginBottom:16 }}>
        <button onClick={() => setShowHistory(!showHistory)}
          style={{ width:"100%", padding:"10px", borderRadius:12, border:`1px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif", display:"flex", justifyContent:"space-between" }}>
          <span>📋 سجل التسويات السابقة ({history.length})</span>
          <span>{showHistory ? "▲" : "▼"}</span>
        </button>
        {showHistory && (
          <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:8 }}>
            {history.length === 0 && <div style={{ textAlign:"center", padding:16, color:T.inkSoft, fontSize:12 }}>لا توجد تسويات سابقة بعد</div>}
            {history.map((h, i) => (
              <div key={i} style={{ background:T.white, borderRadius:12, padding:"12px 14px", border:`1px solid ${T.creamDk}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>📅 {h.date}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:T.green }}>{(h.total_net||0).toLocaleString()} ر.س</div>
                </div>
                <div style={{ display:"flex", gap:16, fontSize:11, color:T.inkSoft }}>
                  <span>🏪 {h.salons_count} صالون</span>
                  <span>📅 {h.bookings_count} حجز</span>
                  <span style={{ color:"#C62828" }}>عمولة: {(h.platform_fee||0).toLocaleString()} ر.س</span>
                </div>
                {h.details && (
                  <div style={{ marginTop:8 }}>
                    {h.details.map((d, j) => (
                      <div key={j} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"3px 0", borderBottom:`1px solid ${T.creamDk}` }}>
                        <span style={{ color:T.inkSoft }}>{d.salon_name} {d.has_love_gifts ? "💝" : ""}</span>
                        <span style={{ fontWeight:700, color:T.green }}>{(d.net||0).toLocaleString()} ر.س</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* إدخال عربون يدوي — مؤقت قبل بوابة الدفع */}
      <div style={{ background:T.roseL, borderRadius:14, padding:"14px 16px", marginBottom:16, border:`1.5px solid ${T.rose}` }}>
        <div style={{ fontSize:13, fontWeight:800, color:T.roseDp, marginBottom:4 }}>🧪 وضع تجريبي — إدخال عربون يدوي</div>
        <div style={{ fontSize:11, color:T.inkSoft, marginBottom:12 }}>قبل ربط بوابة الدفع — أدخل العربون يدوياً لكل حجز</div>
        <ManualDepositEntry bookings={bookings} onUpdate={loadData} toast={toast} />
      </div>

      {/* جدول التسوية */}
      {loading && <div style={{ textAlign:"center", padding:30, color:T.inkSoft }}>...جاري التحميل</div>}
      {!loading && summary.length === 0 && <Empty icon="💳" title="لا توجد مستحقات" desc="لا توجد حجوزات مكتملة في هذه الفترة" />}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {summary.map(s => (
          <div key={s.salonId} style={{ background:T.white, borderRadius:14, padding:"14px 16px", border:`1.5px solid ${s.pendingCount > 0 ? T.roseL : T.creamDk}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{s.name}</div>
                <div style={{ fontSize:11, color:T.inkSoft }}>📞 {s.phone}</div>
              </div>
              <span style={{ background:s.pendingCount > 0 ? T.roseL : T.greenL, color:s.pendingCount > 0 ? T.roseDp : T.green, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>
                {s.pendingCount > 0 ? s.pendingCount + " معلق" : "✅ مسوّى"}
              </span>
            </div>
            <div style={{ background:T.cream, borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
              {[
                ["إجمالي المبيعات", s.totalSales.toLocaleString() + " ر.س", T.ink],
                ["عمولة المنصة (10%)", s.platformFee.toLocaleString() + " ر.س", "#C62828"],
                ["صافي مستحق الصالون", s.netAmount.toLocaleString() + " ر.س", T.green],
                ["عدد الحجوزات", s.bookingsCount + " حجز", T.inkSoft],
              ].map(r => (
                <div key={r[0]} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:`1px solid ${T.creamDk}` }}>
                  <span style={{ color:T.inkSoft }}>{r[0]}</span>
                  <span style={{ fontWeight:700, color:r[2] }}>{r[1]}</span>
                </div>
              ))}
            </div>
            {/* إهداء المحبة مميز */}
            {s.loveGiftAmount > 0 && (
              <div style={{ background:`linear-gradient(135deg,#FCE4EC,#FFF9C4)`, borderRadius:10, padding:"8px 12px", marginBottom:8, border:"1px solid #F8BBD0" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#C2185B", marginBottom:4 }}>💝 إهداء المحبة (مبلغ كامل)</div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color:"#880E4F" }}>المبلغ الكامل المستلم</span>
                  <span style={{ fontWeight:700, color:"#C2185B" }}>{s.loveGiftAmount.toLocaleString()} ر.س</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color:"#880E4F" }}>عمولتك (10%)</span>
                  <span style={{ fontWeight:700, color:"#C62828" }}>{s.loveGiftFee.toLocaleString()} ر.س</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color:"#880E4F" }}>صافي الصالون</span>
                  <span style={{ fontWeight:700, color:T.green }}>{s.loveGiftNet.toLocaleString()} ر.س</span>
                </div>
              </div>
            )}
            <div style={{ fontSize:11, color:T.inkSoft }}>
              🏦 آيبان: <span style={{ color:T.ink, fontWeight:600 }}>{s.iban}</span>
              {s.bank !== "—" && <span> · {s.bank}</span>}
            </div>

            {/* مديونية الحجز اليدوي لنفس الصالون */}
            {s.manualOwedPending > 0 && (
              <div style={{ background:"#E3F2FD", borderRadius:10, padding:"8px 12px", marginTop:8, border:"1px solid #90CAF9" }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color:"#1976D2", fontWeight:700 }}>🖐️ مستحق عليه من الحجز اليدوي ({s.manualBookingsCount})</span>
                  <span style={{ fontWeight:800, color:"#0D47A1" }}>{s.manualOwedPending.toLocaleString()} ر.س</span>
                </div>
              </div>
            )}

            <button onClick={() => {
                const lines = [
                  `📄 كشف حساب — ${s.name}`,
                  `بيوتي تيك 🌸`,
                  ``,
                  `إجمالي المبيعات: ${s.totalSales.toLocaleString()} ر.س`,
                  `عمولة المنصة (10%): ${s.platformFee.toLocaleString()} ر.س`,
                  `صافي مستحقك: ${s.netAmount.toLocaleString()} ر.س`,
                  `عدد الحجوزات: ${s.bookingsCount}`,
                ]
                if (s.loveGiftAmount > 0) lines.push(``, `💝 إهداء محبة: ${s.loveGiftAmount.toLocaleString()} ر.س (صافيك ${s.loveGiftNet.toLocaleString()} ر.س)`)
                if (s.manualOwedPending > 0) lines.push(``, `🖐️ مستحق علينا من الحجز اليدوي: ${s.manualOwedPending.toLocaleString()} ر.س`)
                const waNum = (s.phone || "").replace(/^0/, "").replace(/[^0-9]/g, "")
                const msg = encodeURIComponent(lines.join("\n"))
                if (waNum) window.open(`https://wa.me/966${waNum}?text=${msg}`, "_blank")
              }}
              style={{ width:"100%", marginTop:10, padding:"8px", borderRadius:10, border:`1px solid ${T.creamDk}`, background:T.cream, color:T.inkSoft, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              📄 إرسال كشف حساب عبر واتساب
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}


function AdminSalonsList({ salonsList, onUpdate }) {
  const [editId, setEditId] = useState(null)
  const [newPkg, setNewPkg] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const [search, setSearch] = useState("")

  const filtered = salonsList.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  // الصالونات اللي اشتراكها بينتهي خلال 3 أيام أو أقل (وما زال نشطاً، مو متوقف فعلاً)
  const expiringSoon = salonsList.filter(s => {
    if (!s.subscription_end) return false
    const daysLeft = Math.ceil((new Date(s.subscription_end) - new Date()) / (1000*60*60*24))
    return daysLeft >= 0 && daysLeft <= 3
  }).sort((a,b) => new Date(a.subscription_end) - new Date(b.subscription_end))

  const sendRenewalReminder = (salon) => {
    const daysLeft = Math.ceil((new Date(salon.subscription_end) - new Date()) / (1000*60*60*24))
    const waNum = (salon.phone || "").replace(/^0/, "").replace(/[^0-9]/g, "")
    const msg = encodeURIComponent(
      `🌸 تذكير من بيوتي تيك\n\n` +
      `صالون ${salon.name}، اشتراكك بباقة ${salon.package === "basic" ? "الأساسية" : salon.package === "pro" ? "التوسع" : "النخبة"} ` +
      (daysLeft === 0 ? "ينتهي اليوم!" : `ينتهي بعد ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"} (${salon.subscription_end}).`) +
      `\n\nيرجى التجديد لضمان استمرار ظهور صالونك للعميلات بدون انقطاع 💝`
    )
    if (waNum) window.open(`https://wa.me/966${waNum}?text=${msg}`, "_blank")
  }

  const changePkg = async (salon, pkg) => {
    setSaving(true)
    // عند تفعيل/تغيير الباقة من المدير، نلغي قفل التجربة المنتهية ونحدد تاريخ انتهاء الاشتراك
    const subEnd = new Date()
    if (salon.billing === "yearly") subEnd.setFullYear(subEnd.getFullYear() + 1)
    else subEnd.setMonth(subEnd.getMonth() + 1)
    const { error } = await supabase.from("salons").update({
      package: pkg,
      trial_end: null,
      subscription_end: subEnd.toISOString().split("T")[0],
    }).eq("id", salon.id)
    setSaving(false)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    toast("✅ تم تغيير الباقة وتفعيل الحساب حتى " + subEnd.toLocaleDateString("ar-SA") + "!")
    setEditId(null)
    setNewPkg("")
    onUpdate()   // يعيد جلب القائمة من Supabase
  }

  const toggleVisible = async (sid, current) => {
    const { error } = await supabase.from("salons").update({ visible: !current }).eq("id", sid)
    if (error) { toast("⚠ حدث خطأ: " + error.message); return }
    toast(!current ? "✅ الصالون ظاهر الآن للعميلات" : "🚫 تم إخفاء الصالون عن العميلات")

    // عند التفعيل (مو الإخفاء) — تحقق من وجود إحالة وامنح صاحبتها 200 ر.س بالمحفظة
    if (!current) {
      const { data: salonRow } = await supabase.from("salons").select("referred_by_code, referral_rewarded, name").eq("id", sid)
      const s = salonRow?.[0]
      if (s?.referred_by_code && !s.referral_rewarded) {
        const { data: clientRow } = await supabase.from("clients").select("id, full_name").eq("referral_code", s.referred_by_code)
        if (clientRow?.[0]) {
          const expiresAt = new Date()
          expiresAt.setFullYear(expiresAt.getFullYear() + 1)
          const { error: creditError } = await supabase.from("wallet_credits").insert([{
            client_id: clientRow[0].id,
            amount: 200,
            remaining: 200,
            source: "referral",
            source_salon_id: sid,
            expires_at: expiresAt.toISOString(),
          }])
          if (!creditError) {
            await supabase.from("salons").update({ referral_rewarded: true }).eq("id", sid)
            toast("🎁 تم منح " + (clientRow[0].full_name || "العميلة") + " رصيد 200 ر.س مقابل إحالة " + s.name)
          }
        }
      }
    }
    onUpdate()
  }

  const PKG_LABELS = {
    basic: { label:"📦 أساسية", color:T.inkSoft, bg:T.creamDk },
    pro:   { label:"⚡ توسع",   color:T.gold,    bg:T.goldPale },
    elite: { label:"✦ نخبة",   color:T.roseDp,  bg:T.roseL },
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>
          الصالونات ({salonsList.length})
        </div>
      </div>

      {/* تنبيه انتهاء الاشتراكات القريبة */}
      {expiringSoon.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#E65100", marginBottom:8 }}>⏰ اشتراكات قاربت على الانتهاء ({expiringSoon.length})</div>
          {expiringSoon.map(s => {
            const daysLeft = Math.ceil((new Date(s.subscription_end) - new Date()) / (1000*60*60*24))
            return (
              <Card key={s.id} style={{ padding:"12px 14px", marginBottom:8, border:"1.5px solid #FFB74D" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{s.name}</div>
                    <div style={{ fontSize:11, color:T.inkSoft }}>{s.phone}</div>
                  </div>
                  <span style={{ background:daysLeft===0?"#FFEBEE":"#FFF3E0", color:daysLeft===0?T.red:"#E65100", fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>
                    {daysLeft === 0 ? "ينتهي اليوم!" : `باقي ${daysLeft} ${daysLeft===1?"يوم":"أيام"}`}
                  </span>
                </div>
                <button onClick={() => sendRenewalReminder(s)}
                  style={{ width:"100%", padding:"9px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#25D366,#1FA855)", color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  💬 إرسال تذكير واتساب
                </button>
              </Card>
            )
          })}
        </div>
      )}

      {/* بحث */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="ابحث باسم أو جوال أو إيميل..."
        style={{ width:"100%", padding:"10px 14px", border:`1.5px solid ${T.creamDk}`, borderRadius:12, fontSize:13, fontFamily:"Tajawal,sans-serif", background:T.white, outline:"none", marginBottom:14 }} />

      {filtered.length === 0 && <Empty icon="🏪" title="لا توجد نتائج" desc="" />}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map(s => (
          <Card key={s.id} style={{ padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:T.ink }}>{s.name}</div>
                <div style={{ fontSize:12, color:T.inkSoft, marginTop:2 }}>{s.phone} · {s.email}</div>
                <div style={{ fontSize:12, color:T.inkSoft }}>📍 {s.city}</div>
                <div style={{ fontSize:11, color:T.inkMuted }}>
                  {new Date(s.created_at).toLocaleDateString("ar-SA")}
                  {s.trial_end && ` · تجربة حتى: ${new Date(s.trial_end).toLocaleDateString("ar-SA")}`}
                </div>
              </div>
              <span style={{ background:PKG_LABELS[s.package||"basic"]?.bg, color:PKG_LABELS[s.package||"basic"]?.color, fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>
                {PKG_LABELS[s.package||"basic"]?.label}
              </span>
            </div>

            {/* حالة الظهور للعميلات — يضمن وصول رسوم التأسيس قبل النشر */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:s.visible ? T.greenL : "#FFF3E0", borderRadius:10, padding:"8px 12px", marginBottom:10 }}>
              <span style={{ fontSize:12, fontWeight:700, color:s.visible ? T.green : "#E65100" }}>
                {s.visible ? "👁️ ظاهر للعميلات" : "🚫 مخفي — بانتظار رسوم التأسيس (600 ر.س)"}
              </span>
              <button onClick={() => toggleVisible(s.id, s.visible)}
                style={{ padding:"5px 14px", borderRadius:20, border:"none", background:s.visible ? "#E65100" : T.green, color:T.white, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                {s.visible ? "إخفاء" : "✅ تفعيل الظهور"}
              </button>
            </div>
            {s.referred_by_code && !s.visible && (
              <div style={{ fontSize:10, color:T.gold, marginBottom:10, textAlign:"center" }}>
                🎁 صالون مُرشَّح — تفعيله يمنح المُرشِّحة 200 ر.س تلقائياً
              </div>
            )}
            {s.subscription_end && (
              <div style={{ fontSize:11, color:T.inkSoft, marginBottom:10 }}>
                📅 الاشتراك ينتهي: <strong style={{ color:T.ink }}>{s.subscription_end}</strong>
              </div>
            )}

            {/* تغيير الباقة */}
            {editId === s.id ? (
              <div style={{ background:T.cream, borderRadius:10, padding:"12px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.ink, marginBottom:10 }}>اختر الباقة الجديدة:</div>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  {Object.entries(PKG_LABELS).map(([id, p]) => (
                    <button key={id} onClick={() => setNewPkg(id)}
                      style={{ flex:1, padding:"9px 6px", borderRadius:10, border:`2px solid ${newPkg===id ? T.roseDp : T.creamDk}`, background:newPkg===id ? T.roseL : T.white, color:newPkg===id ? T.roseDp : T.inkSoft, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => setEditId(null)}
                    style={{ flex:1, padding:"9px", borderRadius:10, border:`1px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:12, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    إلغاء
                  </button>
                  <button onClick={() => newPkg && changePkg(s, newPkg)} disabled={!newPkg || saving}
                    style={{ flex:2, padding:"9px", borderRadius:10, border:"none", background:newPkg ? T.roseDp : T.creamDk, color:T.white, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                    {saving ? "...جاري" : "✓ تأكيد التغيير"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setEditId(s.id); setNewPkg(s.package||"basic") }}
                style={{ width:"100%", padding:"9px", borderRadius:10, border:`1.5px solid ${T.roseL}`, background:T.white, color:T.roseDp, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                🔄 تغيير الباقة
              </button>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

function AdminDashboard({ setScreen }) {
  const toast = useToast()
  const [tab, setTab] = useState("stats")
  const [adminPass, setAdminPass] = useState("")
  const [auth, setAuth] = useState(false)
  const [focusPass, setFocusPass] = useState(false)
  const [stats, setStats] = useState({ salons:0, clients:0, bookings:0 })
  const [salonsList, setSalonsList] = useState([])
  const [pkgStats, setPkgStats] = useState({ basic:0, pro:0, elite:0 })
  const [adminModal, setAdminModal] = useState(null)
  const [commissionStats, setCommissionStats] = useState({ total:0, pending:0, loveGifts:0, services:0 })

  useEffect(() => {
    if (!auth) return
    // جلب الإحصائيات
    supabase.from('salons').select('*').then(({ data }) => {
      if (data) {
        setStats(s => ({ ...s, salons: data.length }))
        setSalonsList(data || [])
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
    // جلب بيانات العمولة من الخدمات
    supabase.from('bookings').select('platform_fee,payment_status,booking_type').eq('status','completed').then(({ data: bks }) => {
      if (!bks) return
      const total = bks.reduce((s,b) => s + (b.platform_fee||0), 0)
      const pending = bks.filter(b => b.payment_status !== 'settled').reduce((s,b) => s + (b.platform_fee||0), 0)
      const loveGifts = bks.filter(b => b.booking_type === 'love_gift').reduce((s,b) => s + (b.platform_fee||0), 0)
      const services = bks.filter(b => b.booking_type !== 'love_gift').reduce((s,b) => s + (b.platform_fee||0), 0)
      setCommissionStats({ total, pending, loveGifts, services })
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
    { id:"stats",       label:"الإحصائيات", icon:"📊" },
    { id:"commissions", label:"العمولات",   icon:"💸" },
    { id:"settlement",  label:"التسوية",    icon:"💳" },
    { id:"salons",      label:"الصالونات",  icon:"🏪" },
    { id:"packages",    label:"الباقات",    icon:"📦" },
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
        <button onClick={() => setScreen("terms-page")}
          style={{ padding:"6px 14px", borderRadius:50, border:"1px solid rgba(255,255,255,.3)", background:"transparent", color:"rgba(255,255,255,.7)", fontSize:10, cursor:"pointer", fontFamily:"Tajawal,sans-serif", marginLeft:6 }}>
          📋 الشروط
        </button>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => setScreen("client-home")}
            style={{ padding:"6px 12px", borderRadius:50, border:"1px solid rgba(255,255,255,.2)", background:"transparent", color:"rgba(255,255,255,.7)", fontSize:11, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
            🏠 الرئيسية
          </button>
          <button onClick={() => { setAuth(false); setScreen("client-home") }}
            style={{ padding:"6px 12px", borderRadius:50, border:"1px solid rgba(255,255,255,.3)", background:"transparent", color:"rgba(255,255,255,.8)", fontSize:11, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
            خروج
          </button>
        </div>
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
            {/* إيرادات العمولة من الخدمات */}
            <div style={{ background:`linear-gradient(135deg,#1B5E20,#2E7D32)`, borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,.8)", marginBottom:8 }}>💸 عمولة المنصة من الخدمات (10%)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <div style={{ fontSize:22, fontWeight:900, color:"#fff" }}>{commissionStats.total.toLocaleString()} ر.س</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,.7)" }}>إجمالي العمولات المحصّلة</div>
                </div>
                <div>
                  <div style={{ fontSize:22, fontWeight:900, color:"#fff" }}>{commissionStats.pending.toLocaleString()} ر.س</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,.7)" }}>⏳ معلق التحويل</div>
                </div>
                <div>
                  <div style={{ fontSize:18, fontWeight:900, color:"#FFF9C4" }}>{commissionStats.loveGifts.toLocaleString()} ر.س</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,.7)" }}>💝 عمولة إهداء المحبة</div>
                </div>
                <div>
                  <div style={{ fontSize:18, fontWeight:900, color:"#FFF9C4" }}>{commissionStats.services.toLocaleString()} ر.س</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,.7)" }}>✂️ عمولة الخدمات</div>
                </div>
              </div>
            </div>
            {/* أرقام رئيسية */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              {[
                { label:"🏪 صالون مسجّل", value:stats.salons, gold:true, key:"salons" },
                { label:"👤 عميلة مسجّلة", value:stats.clients, key:"clients" },
                { label:"📅 حجز إجمالي", value:stats.bookings, key:"bookings" },
                { label:"🎁 في التجربة", value:salonsList.filter(s => s.trial_end && new Date(s.trial_end) > new Date()).length, key:"trial" },
                { label:"✅ انتهت تجربتهم", value:salonsList.filter(s => s.trial_end && new Date(s.trial_end) < new Date()).length, key:"trial_done" },
                { label:"🚫 مخفية (بانتظار الدفع)", value:salonsList.filter(s => !s.visible).length, key:"hidden" },
                { label:"💰 إيرادات/شهر", value:monthlyRevenue.toLocaleString()+" ر.س", key:"revenue", gold2:true },
              ].map(st => (
                <div key={st.key} onClick={() => setAdminModal(st.key)}
                  style={{ padding:14, borderRadius:16, background:st.gold ? `linear-gradient(135deg,${T.gold},${T.gold2})` : st.gold2 ? `linear-gradient(135deg,${T.roseDp},#7A4830)` : T.white, textAlign:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(44,32,24,.08)" }}>
                  <div style={{ fontSize:22, fontWeight:900, color:st.gold||st.gold2 ? T.white : T.roseDp }}>{st.value}</div>
                  <div style={{ fontSize:10, color:st.gold||st.gold2 ? "rgba(255,255,255,.8)" : T.inkSoft, fontWeight:600, marginTop:4 }}>{st.label}</div>
                  <div style={{ fontSize:9, color:st.gold||st.gold2 ? "rgba(255,255,255,.5)" : T.inkMuted, marginTop:3 }}>← تفاصيل</div>
                </div>
              ))}
            </div>

            {/* Modal التفاصيل */}
            {adminModal && (
              <div onClick={() => setAdminModal(null)} style={{ position:"fixed", inset:0, background:"rgba(44,32,24,.5)", zIndex:3000, display:"flex", alignItems:"flex-end" }}>
                <div onClick={e => e.stopPropagation()} style={{ background:T.white, borderRadius:"24px 24px 0 0", width:"100%", maxHeight:"80vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
                  <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.creamDk}`, display:"flex", justifyContent:"space-between" }}>
                    <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>
                      {adminModal==="salons" ? "🏪 الصالونات المسجّلة" : adminModal==="clients" ? "👤 العملاء" : adminModal==="bookings" ? "📅 الحجوزات" : adminModal==="trial" ? "🎁 في التجربة المجانية" : adminModal==="trial_done" ? "✅ انتهت تجربتهم" : "💰 الإيرادات"}
                    </div>
                    <button onClick={() => setAdminModal(null)} style={{ width:28, height:28, borderRadius:"50%", border:"none", background:T.cream, cursor:"pointer" }}>✕</button>
                  </div>
                  <div style={{ overflowY:"auto", padding:"14px 20px", flex:1 }}>
                    {adminModal==="salons" && salonsList.map((s,i) => (
                      <div key={i} style={{ padding:"10px 0", borderBottom:`1px solid ${T.creamDk}`, display:"flex", justifyContent:"space-between" }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{s.name}</div>
                          <div style={{ fontSize:11, color:T.inkSoft }}>{s.email} · {s.city}</div>
                          <div style={{ fontSize:11, color:T.inkSoft }}>{s.phone}</div>
                        </div>
                        <span style={{ fontSize:10, background:T.roseL, color:T.roseDp, padding:"3px 8px", borderRadius:20, height:"fit-content", fontWeight:700 }}>
                          {s.package === "elite" ? "نخبة" : s.package === "pro" ? "توسع" : "أساسية"}
                        </span>
                      </div>
                    ))}
                    {adminModal==="trial" && salonsList.filter(s => s.trial_end && new Date(s.trial_end) > new Date()).map((s,i) => (
                      <div key={i} style={{ padding:"10px 0", borderBottom:`1px solid ${T.creamDk}`, display:"flex", justifyContent:"space-between" }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{s.name}</div>
                          <div style={{ fontSize:11, color:T.inkSoft }}>{s.phone} · {s.city}</div>
                        </div>
                        <div style={{ fontSize:11, color:T.green, fontWeight:700 }}>
                          باقي {Math.ceil((new Date(s.trial_end)-new Date())/(1000*60*60*24))} يوم
                        </div>
                      </div>
                    ))}
                    {adminModal==="trial_done" && salonsList.filter(s => s.trial_end && new Date(s.trial_end) < new Date()).map((s,i) => (
                      <div key={i} style={{ padding:"10px 0", borderBottom:`1px solid ${T.creamDk}`, display:"flex", justifyContent:"space-between" }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{s.name}</div>
                          <div style={{ fontSize:11, color:T.inkSoft }}>{s.phone} · {s.email}</div>
                        </div>
                        <span style={{ fontSize:10, background:T.redL, color:T.red, padding:"3px 8px", borderRadius:20, fontWeight:700 }}>منتهية</span>
                      </div>
                    ))}
                    {adminModal==="revenue" && (
                      <div style={{ padding:"14px 0" }}>
                        {[
                          { name:"الأساسية", count:pkgStats.basic, price:200 },
                          { name:"التوسع", count:pkgStats.pro, price:800 },
                          { name:"النخبة", count:pkgStats.elite, price:1500 },
                        ].map(p => (
                          <div key={p.name} style={{ padding:"10px 0", borderBottom:`1px solid ${T.creamDk}`, display:"flex", justifyContent:"space-between" }}>
                            <div>
                              <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>باقة {p.name}</div>
                              <div style={{ fontSize:11, color:T.inkSoft }}>{p.count} صالون × {p.price} ر.س</div>
                            </div>
                            <div style={{ fontSize:14, fontWeight:800, color:T.roseDp }}>{(p.count*p.price).toLocaleString()} ر.س</div>
                          </div>
                        ))}
                        <div style={{ padding:"12px 0", display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:800 }}>
                          <span>الإجمالي</span>
                          <span style={{ color:T.gold }}>{monthlyRevenue.toLocaleString()} ر.س/شهر</span>
                        </div>
                        <div style={{ fontSize:12, color:T.inkSoft, background:T.goldPale, borderRadius:10, padding:"10px 12px", marginTop:8 }}>
                          💡 رسوم التأسيس المتوقعة: {(stats.salons*600).toLocaleString()} ر.س
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === "salons" && (
          <AdminSalonsList salonsList={salonsList} onUpdate={async () => {
            const { data } = await supabase.from("salons").select("*")
            if (data) setSalonsList([...data])   // spread عشان يجبر React على re-render
          }} />
        )}

        {tab === "commissions" && <AdminCommissions />}
        {tab === "settlement" && <AdminSettlement />}
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

function BottomNav({ screen, setScreen, user }) {
  const role = user?.user_metadata?.role
  if (["owner-dashboard","admin","booking","owner-register","owner-login","client-register","client-login","payment"].includes(screen)) return null

  const tabs = role === "owner" ? [
    { id:"client-home", icon:"🏠", label:"الرئيسية" },
    { id:"owner-dashboard", icon:"📊", label:"لوحتي" },
  ] : [
    { id:"client-home", icon:"🏠", label:"الرئيسية" },
    { id:"my-bookings", icon:"📅", label:"حجوزاتي" },
    { id:"profile", icon:"👤", label:"ملفي" },
  ]

  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:T.white, borderTop:`1px solid ${T.roseL}`, display:"flex", zIndex:600, paddingBottom:"env(safe-area-inset-bottom,0px)", boxShadow:"0 -4px 20px rgba(44,32,24,.08)" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setScreen(t.id)}
          style={{ flex:1, padding:"10px 4px 8px", border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontFamily:"Tajawal,sans-serif" }}>
          <span style={{ fontSize:20 }}>{t.icon}</span>
          <span style={{ fontSize:10, fontWeight: screen===t.id ? 700 : 400, color: screen===t.id ? T.roseDp : T.inkSoft }}>{t.label}</span>
          {screen===t.id && <div style={{ width:4, height:4, borderRadius:"50%", background:T.roseDp }} />}
        </button>
      ))}
    </div>
  )
}

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
              <>
                <button onClick={() => setScreen("gift")}
                  style={{ padding:"7px 12px", borderRadius:50, border:"none", background:"linear-gradient(135deg,#FCE4EC,#F8BBD0)", color:"#C2185B", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  💝 إهداء محبة
                </button>
                <button onClick={() => setScreen("my-bookings")}
                  style={{ padding:"7px 12px", borderRadius:50, border:`1.5px solid ${T.roseL}`, background:T.white, color:T.roseDp, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  📅 حجوزاتي
                </button>
                <button onClick={() => setScreen("profile")}
                  style={{ padding:"7px 12px", borderRadius:50, border:`1.5px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
                  👤 ملفي
                </button>
              </>
            )}
            <button onClick={logout}
              style={{ padding:"7px 12px", borderRadius:50, border:`1.5px solid ${T.creamDk}`, background:T.white, color:T.inkSoft, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              خروج
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setScreen("gift")}
              style={{ padding:"7px 12px", borderRadius:50, border:"1.5px solid #F8BBD0", background:"linear-gradient(135deg,#FCE4EC,#F8BBD0)", color:"#C2185B", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"Tajawal,sans-serif" }}>
              💝 إهداء محبة
            </button>
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

  // تحديث الكاش عند أول تحميل بكل جلسة جديدة (مرة واحدة فقط، لا يتكرر بكل صفحة بنفس الجلسة)
  useEffect(() => {
    if (!sessionStorage.getItem("cache_cleared_this_session")) {
      sessionStorage.setItem("cache_cleared_this_session", "1")
      if ("caches" in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
      }
    }
  }, [])
  const [salon, setSalon] = useState(null)
  const [payData, setPayData] = useState(null)
  const [user, setUser] = useState(null)

  // التقاط كود الإحالة من الرابط (مثل ?ref=ABC123) وحفظه — يبقى متاحاً وقت تسجيل الصالون
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref) sessionStorage.setItem("referral_code", ref)
  }, [])

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
    if (screen === "reset-password")  return <ResetPasswordPage setScreen={go} />
    if (screen === "client-register") return <ClientRegister setScreen={go} />
    if (screen === "booking")         return <BookingPage salon={salon} setScreen={go} />
    if (screen === "salon-detail")     return <SalonDetailPage salon={salon} setScreen={go} setSalon={setSalon} />
    if (screen === "compare")           return <ComparePage setScreen={go} setSalon={setSalon} />
    if (screen === "owner-register")  return <OwnerRegister setScreen={go} />
    if (screen === "owner-login")     return <OwnerLogin setScreen={go} />
    if (screen === "owner-dashboard") return <OwnerDashboard setScreen={go} />
    if (screen === "admin")           return <AdminDashboard setScreen={go} />
    if (screen === "about")           return <AboutPage      setScreen={go} />
    if (screen === "contact")         return <ContactPage    setScreen={go} />
    if (screen === "faq")             return <FAQPage        setScreen={go} />
    if (screen === "privacy")         return <PrivacyPage    setScreen={go} />
  if (screen === "terms-page")      return <TermsPage      setScreen={go} />
    if (screen === "404")             return <NotFoundPage   setScreen={go} />
    if (screen === "gift")             return <GiftPage        setScreen={go} salon={salon} setSalon={setSalon} />
    if (screen === "my-bookings")      return <MyBookingsPage  setScreen={go} setSalon={setSalon} />
    if (screen === "profile")           return <ClientProfile   setScreen={go} />
    return <NotFoundPage setScreen={go} />
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
                                    { label:"تواصل معنا", screen:"contact", icon:"💬" },
                  { label:"الأسئلة الشائعة", screen:"faq", icon:"❓" },
                  { label:"سياسة الخصوصية", screen:"privacy", icon:"🔒" },
                  { label:"الشروط والأحكام", screen:"terms-page", icon:"📋" },
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
