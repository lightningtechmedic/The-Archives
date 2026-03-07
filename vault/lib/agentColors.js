// Shared agent color palette — used by ImpressionThumb, PatternLibrary, etc.
// Keys cover both display names (user, architect, spark) and raw message roles
// (human, claude, gpt) so callers can use either without normalization.

export const agentColors = {
  // Display names
  user:        '#e8e0d5',
  architect:   '#c44e18',
  spark:       '#a07828',
  scribe:      '#4a64d8',
  steward:     '#9a7850',
  advocate:    '#b8856a',
  contrarian:  '#607080',
  socra:       '#3a3530',
  // Raw message role aliases
  human:       '#e8e0d5',
  claude:      '#c44e18',
  gpt:         '#a07828',
}
