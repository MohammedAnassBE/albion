export default {
	doctype: 'Machine',
	icon: 'settings',
	subtitle: 'Machine identification and gauge assignment',
	fields: [
		{ fieldname: 'machine_id', fieldtype: 'Data', label: 'Machine ID', reqd: 1 },
		{ fieldname: 'machine_frame', fieldtype: 'Link', label: 'Machine Frame', options: 'Machine Frame', reqd: 1 },
	],
}
