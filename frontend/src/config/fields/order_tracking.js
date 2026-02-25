export default {
	doctype: 'Order Tracking',
	icon: 'check-circle',
	subtitle: 'Track order completion by colour and size',
	fields: [
		{ fieldname: 'order', fieldtype: 'Link', label: 'Order', options: 'Order', reqd: 1 },
		{ fieldname: 'style', fieldtype: 'Link', label: 'Style', options: 'Style', reqd: 1 },
		{ fieldname: 'colour', fieldtype: 'Link', label: 'Colour', options: 'Colour', reqd: 1 },
		{ fieldname: 'size', fieldtype: 'Link', label: 'Size', options: 'Size', reqd: 1 },
		{ fieldname: 'quantity', fieldtype: 'Int', label: 'Quantity', reqd: 1 },
		{ fieldname: 'knitter', fieldtype: 'Link', label: 'Knitter', options: 'Knitter', reqd: 1 },
		{ fieldname: 'completion_date', fieldtype: 'Date', label: 'Completion Date', reqd: 1 },
		{ fieldname: 'user', fieldtype: 'Link', label: 'User', options: 'User', read_only: 1 },
	],
}
