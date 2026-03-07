import { readFileSync } from 'fs'
import { join } from 'path'

let _cached = null

function getFullKnowledge() {
  if (_cached) return _cached
  _cached = readFileSync(join(process.cwd(), 'VAULT_KNOWLEDGE.md'), 'utf8')
  return _cached
}

function getSection(heading) {
  const full = getFullKnowledge()
  const lines = full.split('\n')
  const start = lines.findIndex(l => l.trim() === `## ${heading}` || l.trim() === `### ${heading}`)
  if (start === -1) return ''
  let end = lines.findIndex((l, i) => i > start && (l.startsWith('## ') || l.startsWith('### ')))
  if (end === -1) end = lines.length
  return lines.slice(start, end).join('\n').trim()
}

function getAgentCard(agentName) {
  return getSection(agentName.toUpperCase())
}

function getVoicePrinciples() {
  return getSection('VOICE & TONE PRINCIPLES')
}

export {
  getFullKnowledge,
  getSection,
  getAgentCard,
  getVoicePrinciples,
}
