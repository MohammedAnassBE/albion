export default {
	doctype: 'Order Tracking',
	icon: 'check-circle',
	subtitle: 'Track order completion by colour and size',
	fields: [
		{ fieldname: 'order', fieldtype: 'Link', label: 'Order', options: 'Order', reqd: 1 },
		{ fieldname: 'item', fieldtype: 'Link', label: 'Item', options: 'Item', reqd: 1 },
		{ fieldname: 'colour', fieldtype: 'Link', label: 'Colour', options: 'Colour' },
		{ fieldname: 'size', fieldtype: 'Link', label: 'Size', options: 'Size' },
		{ fieldname: 'quantity', fieldtype: 'Int', label: 'Quantity', reqd: 1 },
		{ fieldname: 'completion_date', fieldtype: 'Date', label: 'Completion Date', reqd: 1 },
		{ fieldname: 'user', fieldtype: 'Link', label: 'User', options: 'User', read_only: 1 },
	],
}
