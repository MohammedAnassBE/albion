export default {
	doctype: 'Machine',
	icon: 'settings',
	subtitle: 'Machine identification and gauge assignment',
	fields: [
		{ fieldname: 'machine_id', fieldtype: 'Data', label: 'Machine ID', reqd: 1 },
		{ fieldname: 'machine_gg', fieldtype: 'Link', label: 'Machine GG', options: 'Machine GG', reqd: 1 },
	],
}
