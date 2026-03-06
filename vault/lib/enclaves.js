// vault/lib/enclaves.js — Supabase helpers for the Enclave system

export async function createEnclave(supabase, { name, description, userId }) {
  // Step 1 — insert enclave
  const { data: enclave, error: enclaveError } = await supabase
    .from('enclaves')
    .insert({ name: name.trim(), created_by: userId })
    .select()
    .single()

  if (enclaveError) return { data: null, error: enclaveError }

  // Step 2 — add creator as owner member
  const { error: memberError } = await supabase
    .from('enclave_members')
    .insert({
      enclave_id: enclave.id,
      user_id: userId,
      role: 'owner',
    })

  if (memberError) return { data: null, error: memberError }

  return { data: { ...enclave, role: 'owner' }, error: null }
}

export async function getUserEnclaves(supabase, userId) {
  const { data, error } = await supabase
    .from('enclave_members')
    .select('role, enclaves(*)')
    .eq('user_id', userId)
  if (error || !data) return []
  return data.map(em => ({ ...em.enclaves, role: em.role })).filter(Boolean)
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
