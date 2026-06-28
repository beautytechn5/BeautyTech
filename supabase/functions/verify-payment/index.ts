// ══════════════════════════════════════════
// VERIFY PAYMENT — Edge Function
// ══════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MOYASAR_SECRET_KEY = Deno.env.get('MOYASAR_SECRET_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const { payment_id, booking_data, wallet_only, client_id, wallet_amount } = await req.json()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
            error: isSlotTaken ? 'تم حجز هذا الوقت للتو من عميلة أخرى' : 'تعذر حفظ الحجز: ' + insertError.message,
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, booking: insertedBooking?.[0] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'payment_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const moyasarRes = await fetch('https://api.moyasar.com/v1/payments/' + payment_id, {
      headers: {
        'Authorization': 'Basic ' + btoa(MOYASAR_SECRET_KEY + ':'),
      },
    })

    if (!moyasarRes.ok) {
      return new Response(
        JSON.stringify({ error: 'verification failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payment = await moyasarRes.json()

    if (payment.status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'payment not completed', status: payment.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (booking_data && booking_data.expected_amount && payment.amount !== booking_data.expected_amount) {
      return new Response(
        JSON.stringify({ error: 'amount mismatch' }),
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
        client_phone: booking_data && booking_data.booking_fields ? booking_data.booking_fields.client_phone : null,
        details: insertError.message,
      }]).then(function() {}, function() {})

      return new Response(
        JSON.stringify({
          error: isSlotTaken ? 'slot taken, refund pending' : 'booking failed: ' + insertError.message,
          payment_id: payment.id,
          payment_succeeded: true,
          needs_refund: true,
          slot_conflict: isSlotTaken,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, booking: insertedBooking?.[0], payment: payment }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'unexpected error: ' + err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})