/** Starter automations installed for every new tenant (all editable/disable-able in Automation). */
export const DEFAULT_WORKFLOWS = [
  {
    name: 'Notify customer when shipment departs',
    trigger_event: 'shipment.status_changed',
    conditions: [{ field: 'to', op: 'eq', value: 'in_transit' }],
    actions: [{ type: 'customer_message', text: 'Good news — your shipment {{number}} has departed. Track it any time in your portal.' }],
  },
  {
    name: 'Notify customer on delivery',
    trigger_event: 'shipment.status_changed',
    conditions: [{ field: 'to', op: 'eq', value: 'delivered' }],
    actions: [{ type: 'customer_message', text: 'Your shipment {{number}} has been delivered. Thank you!' }],
  },
  {
    name: 'Alert ops when a customs hold is raised',
    trigger_event: 'customs.hold',
    conditions: [],
    actions: [{ type: 'notify', module: 'customs', action: 'u', title: 'Customs hold: {{number}}', body: '{{hold_reason}}', level: 'error' }],
  },
  {
    name: 'Remind finance about overdue invoices',
    trigger_event: 'invoice.overdue',
    conditions: [],
    actions: [{ type: 'notify', module: 'invoices', action: 'u', title: 'Invoice {{number}} is overdue', body: 'AED {{outstanding}} outstanding', level: 'warning' }],
  },
];
