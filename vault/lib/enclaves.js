// vault/lib/enclaves.js — Supabase helpers for the Enclave system

export async function createEnclave(supabase, { name, userId }) {
  // Step 1 — insert only, no chained .select() to avoid triggering policy chain
  const { error: insertError } = await supabase
    .from('enclaves')
    .insert({ name: name.trim(), created_by: userId })

  if (insertError) return { data: null, error: insertError }

  // Step 2 — wait for insert to settle before reading back
  await new Promise(r => setTimeout(r, 200))

  const { data: enclave, error: fetchError } = await supabase
    .from('enclaves')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError) return { data: null, error: fetchError }

  // Step 3 — add creator as owner member
  const { error: memberError } = await supabase
    .from('enclave_members')
    .insert({ enclave_id: enclave.id, user_id: userId, role: 'owner' })

  if (memberError) return { data: null, error: memberError }

  return { data: { ...enclave, role: 'owner' }, error: null }
}

export async function getUserEnclaves(supabase, userId) {
  // Two separate queries — no relational join to avoid cross-table policy chain
  const { data: memberships, error: memError } = await supabase
    .from('enclave_members')
    .select('enclave_id, role')
    .eq('user_id', userId)

  if (memError || !memberships?.length) return []

  const enclaveIds = memberships.map(m => m.enclave_id)

  const { data: enclaves, error: encError } = await supabase
    .from('enclaves')
    .select('*')
    .in('id', enclaveIds)

  if (encError || !enclaves) return []

  // Merge role from memberships back onto each enclave
  const roleMap = Object.fromEntries(memberships.map(m => [m.enclave_id, m.role]))
  return enclaves.map(e => ({ ...e, role: roleMap[e.id] }))
}

export async function inviteMember(supabase, enclaveId, userEmail) {
  // Look up user by email in profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', userEmail.trim().toLowerCase())
    .single()
  if (!profile) return { error: 'No Vault user found with that email' }

  const { error } = await supabase.from('enclave_members').insert({
    enclave_id: enclaveId, user_id: profile.id, role: 'member',
  })
  if (error?.code === '23505') return { error: 'Already a member' }
  return { error: error?.message || null }
}

export async function removeMember(supabase, enclaveId, userId) {
  const { error } = await supabase.from('enclave_members')
    .delete()
    .eq('enclave_id', enclaveId)
    .eq('user_id', userId)
  return { error: error?.message || null }
}

export async function getEnclaveMembers(supabase, enclaveId) {
  const { data, error } = await supabase
    .from('enclave_members')
    .select('role, joined_at, profiles(*)')
    .eq('enclave_id', enclaveId)
  return { members: data || [], error }
}

export async function deleteEnclave(supabase, enclaveId) {
  const { error } = await supabase.from('enclaves').delete().eq('id', enclaveId)
  return { error: error?.message || null }
}
