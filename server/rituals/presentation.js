const plain = text => ({ type: 'plain_text', text: String(text) })
const alert = (message, level = 'info') => ({ type: 'alert', text: plain(message.slice(0, 200)), level })

// Only opt into newer blocks with an equivalent accessible fallback. A failed
// view validation is safe to retry; rate limits/auth/network failures are not.
function fallbackView(view) {
  return { ...view, blocks: view.blocks.flatMap(block => {
    if (block.type === 'alert') return [{ type: 'section', text: block.text }]
    if (block.type !== 'data_table') return [block]
    return block.rows.slice(1).map(row => ({ type: 'section', text: plain(row.filter(c => c.type !== 'action_cell').map(c => c.text ?? String(c.value)).join(' · ')),
      ...(row.find(c => c.type === 'action_cell') ? { accessory: row.find(c => c.type === 'action_cell').element } : {}) }))
  }) }
}
async function sendView(send, args) {
  try { return await send(args) }
  catch (error) {
    if (!['invalid_blocks', 'invalid_arguments', 'invalid_view'].includes(error.data?.error) || !args.view.blocks.some(b => ['alert', 'data_table'].includes(b.type))) throw error
    return send({ ...args, view: fallbackView(args.view) })
  }
}
function restoreInputs(blocks, values) {
  const mappings = { value: 'initial_value', selected_time: 'initial_time', selected_option: 'initial_option', selected_options: 'initial_options', selected_users: 'initial_users', selected_user: 'initial_user', selected_date: 'initial_date', selected_conversation: 'initial_conversation' }
  return blocks.map(b => {
    if (b.type !== 'input') return b
    const v = values[b.block_id]?.value, element = { ...b.element }
    if (v) for (const [source, target] of Object.entries(mappings)) {
      if (!Object.hasOwn(v, source)) continue
      delete element[target]
      if (v[source] != null && v[source] !== '' && (!Array.isArray(v[source]) || v[source].length)) element[target] = v[source]
    }
    return { ...b, element }
  })
}
function actionTable(rows, config) {
  return { type: 'data_table', caption: 'Your open channel tasks — current workflow only', page_size: 5,
    rows: [[{ type: 'raw_text', text: 'Task' }, { type: 'raw_text', text: 'Due (UTC)' }, { type: 'raw_text', text: 'Action' }],
      ...rows.slice(0, 20).map(r => [{ type: 'raw_text', text: r.detail.slice(0, 500) }, { type: 'raw_text', text: r.due },
        { type: 'action_cell', element: { type: 'button', text: plain('Open task'), action_id: 'collab_action', value: JSON.stringify({ c: config, id: r.id, edit: true }) }, fallback: { type: 'raw_text', text: 'Open from Channel to-dos' } }])] }
}
module.exports = { alert, sendView, restoreInputs, actionTable, fallbackView }
