// vault/lib/stickies.js — Supabase helpers for the Sticky Board

export async function getStickies(supabase, userId) {
  const { data, error } = await supabase
    .from('stickies').select('*').eq('user_id', userId).order('position')
  return { stickies: data || [], error }
}

export async function getStickyColumns(supabase, userId) {
  const { data, error } = await supabase
    .from('sticky_columns').select('*').eq('user_id', userId).order('position')
  return { columns: data || [], error }
}

export async function createSticky(supabase, { userId, columnId, content, color, rotation, sourceType, sourceNoteId }) {
  const { data, error } = await supabase.from('stickies').insert({
    user_id: userId,
    column_id: columnId || null,
    content: content || '',
    color: color || 'paper',
    rotation: rotation ?? parseFloat((Math.random() * 6 - 3).toFixed(2)),
    source_type: sourceType || 'manual',
    source_note_id: sourceNoteId || null,
    position: 0,
  }).select().single()
  return { sticky: data, error }
}

export async function updateSticky(supabase, id, updates) {
  const { data, error } = await supabase.from('stickies').update(updates).eq('id', id).select().single()
  return { sticky: data, error }
}

export async function deleteSticky(supabase, id) {
  const { error } = await supabase.from('stickies').delete().eq('id', id)
  return { error }
}

export async function createColumn(supabase, { userId, name, position }) {
  const { data, error } = await supabase.from('sticky_columns').insert({
    user_id: userId, name: name || 'New Column', position: position ?? 0,
  }).select().single()
  return { column: data, error }
}

export async function updateColumn(supabase, id, updates) {
  const { error } = await supabase.from('sticky_columns').update(updates).eq('id', id)
  return { error }
}

export async function deleteColumn(supabase, id) {
  const { error } = await supabase.from('sticky_columns').delete().eq('id', id)
  return { error }
}

export async function shareSticky(supabase, stickyId, targetUserId) {
  const { data: sticky } = await supabase.from('stickies').select('shared_with').eq('id', stickyId).single()
  if (!sticky) return { error: 'Sticky not found' }
  const already = sticky.shared_with || []
  if (already.includes(targetUserId)) return { error: null }
  const { error } = await supabase.from('stickies')
    .update({ shared_with: [...already, targetUserId] }).eq('id', stickyId)
  return { error: error?.message || null }
}

// Used by dashboard to pin a Lattice message to the board
export async function pinLatticeMsgToBoard(supabase, { userId, content, color }) {
  // Get first column or create one
  const { data: cols } = await supabase.from('sticky_columns')
    .select('id').eq('user_id', userId).order('position').limit(1)
  let columnId = cols?.[0]?.id || null

  if (!columnId) {
    const { data: newCol } = await supabase.from('sticky_columns')
      .insert({ user_id: userId, name: 'Board', position: 0 }).select().single()
    columnId = newCol?.id || null
  }

  const rotation = parseFloat((Math.random() * 6 - 3).toFixed(2))
  const { data, error } = await supabase.from('stickies').insert({
    user_id: userId,
    column_id: columnId,
    content: content.slice(0, 280),
    color: color || 'paper',
    rotation,
    source_type: 'lattice',
    position: 0,
  }).select().single()
  return { sticky: data, error }
}
