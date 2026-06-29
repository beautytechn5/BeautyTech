// ══════════════════════════════════════════
// 🔒 VERIFY PAYMENT — Edge Function
// يتأكد من نجاح الدفع عن طريق ميسر باستخدام المفتاح السري
// المفتاح السري لا يظهر أبداً للمتصفح — يبقى هنا فقط بأمان
// يدعم أيضاً الدفع الجزئي أو الكامل من محفظة العميلة، والتجديد الذاتي للاشتراك
// ══════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MOYASAR_SECRET_KEY = Deno.env.get('MOYASAR_SECRET_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// تخصم المبلغ المطلوب من أرصدة محفظة العميلة (الأقدم انتهاءً أولاً) فعلياً وبأمان
async function deductWallet(supabase: any, clientId: string, amount: number) {
  const { data: credits } = await supabase
    .from('wallet_credits')
    .select('*')
    .eq('client_id', clientId)
    .gt('remaining', 0)
    .order('expires_at', { ascending: true })

  const valid = (credits || []).filter((c: any) => !c.expires_at || new Date(c.expires_at) > new Date())
  const totalAvailable = valid.reduce((s: number, c: any) => s + Number(c.remaining), 0)

  if (totalAvailable < amount) {
    return { success: false, error: 'رصيد المحفظة غير كافٍ' }
  }

  let remaining = amount
  for (const credit of valid) {
    if (remaining <= 0) break
    const deduct = Math.min(Number(credit.remaining), remaining)
    await supabase.from('wallet_credits').update({ remaining: Number(credit.remaining) - deduct }).eq('id', credit.id)
    remaining -= deduct
  }
  return { success: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { payment_id, booking_data, wallet_only, client_id, wallet_amount, subscription_data, renewal_data } = await req.json()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // ══════════════════════════════════════
    // الحالة الخاصة: تجديد اشتراك صالون موجود فعلاً (يُحدّد بـ salon_code الفريد)
    // ══════════════════════════════════════
    if (renewal_data) {
      if (!payment_id || !renewal_data.salon_code) {
        return new Response(
          JSON.stringify({ error: 'بيانات التجديد غير مكتملة' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const moyasarRes = await fetch(`https://api.moyasar.com/v1/payments/${payment_id}`, {
        headers: { 'Authorization': 'Basic ' + btoa(`${MOYASAR_SECRET_KEY}:`) },
      })

      if (!moyasarRes.ok) {
        return new Response(
          JSON.stringify({ error: 'تعذّر التحقق من الدفع عند ميسر' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const payment = await moyasarRes.json()

      if (payment.status !== 'paid') {
        return new Response(
          JSON.stringify({ error: 'الدفع لم يكتمل', status: payment.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (renewal_data.expected_amount && payment.amount !== renewal_data.expected_amount) {
        return new Response(
          JSON.stringify({ error: 'المبلغ المدفوع لا يطابق المبلغ المطلوب — تم رفض العملية أمنياً' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: salonCheck } = await supabase.from('salons').select('id, billing').eq('salon_code', renewal_data.salon_code)
      if (!salonCheck?.[0]) {
        return new Response(
          JSON.stringify({ error: 'تم الدفع بنجاح لكن رقم الصالون غير صحيح — تواصلي مع الدعم فوراً', payment_id: payment.id, payment_succeeded: true }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const subEnd = new Date()
      if (salonCheck[0].billing === 'yearly') subEnd.setFullYear(subEnd.getFullYear() + 1)
      else subEnd.setMonth(subEnd.getMonth() + 1)

      const { error: updateError } = await supabase.from('salons').update({
        trial_end: null,
        skip_trial: true,
        visible: true,
        subscription_end: subEnd.toISOString().split('T')[0],
        payment_id: payment.id,
      }).eq('id', salonCheck[0].id)

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'تم الدفع بنجاح لكن تعذّر تحديث الحساب: ' + updateError.message, payment_id: payment.id, payment_succeeded: true }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, subscription_end: subEnd.toISOString().split('T')[0] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ══════════════════════════════════════
    // الحالة الخاصة: اشتراك صالون جديد (تخطّي التجربة المجانية) أو ترقية باقة
    // ══════════════════════════════════════
    if (subscription_data) {
      if (!payment_id) {
        return new Response(
          JSON.stringify({ error: 'payment_id مطلوب' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const moyasarRes = await fetch(`https://api.moyasar.com/v1/payments/${payment_id}`, {
        headers: { 'Authorization': 'Basic ' + btoa(`${MOYASAR_SECRET_KEY}:`) },
      })

      if (!moyasarRes.ok) {
        return new Response(
          JSON.stringify({ error: 'تعذّر التحقق من الدفع عند ميسر' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const payment = await moyasarRes.json()

      if (payment.status !== 'paid') {
        return new Response(
          JSON.stringify({ error: 'الدفع لم يكتمل', status: payment.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (subscription_data.expected_amount && payment.amount !== subscription_data.expected_amount) {
        return new Response(
          JSON.stringify({ error: 'المبلغ المدفوع لا يطابق المبلغ المطلوب — تم رفض العملية أمنياً' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: subscription_data.email,
        password: subscription_data.password,
        email_confirm: true,
        user_metadata: { role: 'owner', name: subscription_data.owner_name },
      })

      if (authError) {
        return new Response(
          JSON.stringify({ error: 'تم الدفع بنجاح لكن تعذّر إنشاء الحساب: ' + authError.message, payment_id: payment.id, payment_succeeded: true }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const subEnd = new Date()
      if (subscription_data.salon_fields?.billing === 'yearly') subEnd.setFullYear(subEnd.getFullYear() + 1)
      else subEnd.setMonth(subEnd.getMonth() + 1)

      const { data: salonRow, error: salonError } = await supabase.from('salons').insert([{
        ...subscription_data.salon_fields,
        visible: true,
        skip_trial: true,
        trial_end: null,
        subscription_end: subEnd.toISOString().split('T')[0],
        payment_id: payment.id,
      }]).select()

      if (salonError) {
        return new Response(
          JSON.stringify({ error: 'تم الدفع بنجاح لكن تعذّر حفظ بيانات الصالون: ' + salonError.message, payment_id: payment.id, payment_succeeded: true }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, salon: salonRow?.[0] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ══════════════════════════════════════
    // الحالة الخاصة: الدفع كامل من المحفظة (بدون ميسر إطلاقاً)
    // ══════════════════════════════════════
    if (wallet_only) {
      if (!client_id || !wallet_amount) {
        return new Response(
          JSON.stringify({ error: 'بيانات المحفظة غير مكتملة' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const deduction = await deductWallet(supabase, client_id, wallet_amount)
      if (!deduction.success) {
        return new Response(
          JSON.stringify({ error: deduction.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const { data: insertedBooking, error: insertError } = await supabase
        .from('bookings')
        .insert([{
          ...booking_data.booking_fields,
          payment_status: 'paid',
          wallet_used: wallet_amount,
          status: booking_data.booking_fields.status || 'pending',
        }])
        .select()

      if (insertError) {
        await deductWallet(supabase, client_id, -wallet_amount).catch(() => {})
        const isSlotTaken = insertError.message?.includes('duplicate key') || insertError.code === '23505'
        return new Response(
          JSON.stringify({
            error: isSlotTaken ? 'تم حجز هذا الوقت للتو من عميلة أخرى — أعيدي المحاولة بوقت آخر' : 'تعذّر حفظ الحجز: ' + insertError.message,
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, booking: insertedBooking?.[0] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ══════════════════════════════════════
    // الحالة العادية: دفع عبر ميسر (مع خصم جزئي اختياري من المحفظة)
    // ══════════════════════════════════════
    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'payment_id مطلوب' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const moyasarRes = await fetch(`https://api.moyasar.com/v1/payments/${payment_id}`, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${MOYASAR_SECRET_KEY}:`),
      },
    })

    if (!moyasarRes.ok) {
      return new Response(
        JSON.stringify({ error: 'تعذّر التحقق من الدفع عند ميسر' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payment = await moyasarRes.json()

    if (payment.status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'الدفع لم يكتمل', status: payment.status, message: payment.source?.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (booking_data?.expected_amount && payment.amount !== booking_data.expected_amount) {
      return new Response(
        JSON.stringify({ error: 'المبلغ المدفوع لا يطابق المبلغ المطلوب — تم رفض العملية أمنياً' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (client_id && wallet_amount > 0) {
      await deductWallet(supabase, client_id, wallet_amount)
    }

    const { data: insertedBooking, error: insertError } = await supabase
      .from('bookings')
      .insert([{
        ...booking_data.booking_fields,
        payment_id: payment.id,
        payment_status: 'paid',
        wallet_used: wallet_amount || 0,
        status: booking_data.booking_fields.status || 'pending',
      }])
      .select()

    if (insertError) {
      const isSlotTaken = insertError.message?.includes('duplicate key') || insertError.code === '23505'

      await supabase.from('refunds_needed').insert([{
        payment_id: payment.id,
        amount: payment.amount,
        reason: isSlotTaken ? 'slot_conflict' : 'insert_failed',
        client_phone: booking_data?.booking_fields?.client_phone || null,
        details: insertError.message,
      }]).then(() => {}, () => {})

      return new Response(
        JSON.stringify({
          error: isSlotTaken
            ? 'تم الدفع بنجاح، لكن شخصاً آخر حجز هذا الوقت بنفس اللحظة. سيتم استرجاع مبلغك تلقائياً خلال 24 ساعة.'
            : 'تم الدفع بنجاح لكن تعذّر حفظ الحجز: ' + insertError.message,
          payment_id: payment.id,
          payment_succeeded: true,
          needs_refund: true,
          slot_conflict: isSlotTaken,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, booking: insertedBooking?.[0], payment }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'خطأ غير متوقع: ' + err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})