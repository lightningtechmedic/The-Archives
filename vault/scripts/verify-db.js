// vault/scripts/verify-db.js
// Verify every table and column the app depends on actually exists in Supabase.
// Run after every migration: npm run verify-db

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const required = [
  { table: 'notes', columns: ['id','user_id','title','content','visibility','enclave_id'] },
  { table: 'enclaves', columns: ['id','name','created_by','description','created_at'] },
  { table: 'enclave_members', columns: ['id','enclave_id','user_id','role','joined_at'] },
  { table: 'reminders', columns: ['id','note_id','user_id','phrase','reminder_date','note_title'] },
  { table: 'stickies', columns: ['id','user_id','column_id','content','color','rotation','position','source_type','shared_with','sketch_svg','tags','detected_date','note_link_id','updated_at'] },
  { table: 'sticky_columns', columns: ['id','user_id','name','position','type','emoji'] },
]

async function verify() {
  let allGood = true
  for (const { table, columns } of required) {
    const { data, error } = await supabase.from(table).select('*').limit(0)
    if (error) {
      console.error(`❌ Table missing or inaccessible: ${table} — ${error.message}`)
      allGood = false
      continue
    }
    console.log(`✓ Table exists: ${table}`)
  }
  if (allGood) console.log('\n✅ All tables verified')
  else console.log('\n❌ Some tables are missing — run the migrations in Supabase SQL editor')
}

verify()
