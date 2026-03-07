import { createClient } from '@/lib/supabase'

export async function getEnclaveBudget(enclaveId) {
  const sb = createClient()
  const { data } = await sb
    .from('enclaves')
    .select('budget_cents, budget_period')
    .eq('id', enclaveId)
    .single()
  return data || { budget_cents: null, budget_period: 'unlimited' }
}

export async function getEnclaveSpend(enclaveId) {
  const sb = createClient()
  const { data } = await sb
    .from('build_log')
    .select('actual_cost_cents, estimated_cost_cents, status')
    .eq('enclave_id', enclaveId)
    .in('status', ['approved', 'completed'])
  if (!data) return 0
  return data.reduce(
    (sum, row) => sum + (row.actual_cost_cents ?? row.estimated_cost_cents ?? 0),
    0
  )
}

export async function getBuildHistory(enclaveId) {
  const sb = createClient()
  const { data } = await sb
    .from('build_log')
    .select('*')
    .eq('enclave_id', enclaveId)
    .order('created_at', { ascending: false })
    .limit(30)
  return data || []
}

export async function setEnclaveBudget(enclaveId, budgetCents, period = 'monthly') {
  const sb = createClient()
  const { error } = await sb
    .from('enclaves')
    .update({ budget_cents: budgetCents, budget_period: period })
    .eq('id', enclaveId)
  return !error
}

export async function logBuild(enclaveId, userId, description, estimatedCostCents, stewardReasoning, neuronSnapshot = null) {
  const sb = createClient()
  const { data, error } = await sb
    .from('build_log')
    .insert({
      enclave_id: enclaveId,
      user_id: userId,
      description,
      estimated_cost_cents: estimatedCostCents,
      ted_reasoning: stewardReasoning,
      status: 'pending',
      neuron_snapshot: neuronSnapshot,
    })
    .select()
    .single()
  return error ? null : data
}

export async function updateBuildStatus(buildId, status, actualCostCents) {
  const sb = createClient()
  const update = { status, updated_at: new Date().toISOString() }
  if (actualCostCents != null) update.actual_cost_cents = actualCostCents
  const { error } = await sb.from('build_log').update(update).eq('id', buildId)
  return !error
}
