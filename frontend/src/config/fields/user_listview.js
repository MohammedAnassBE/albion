export default {
	doctype: 'User Listview',
	icon: 'columns',
	subtitle: 'Per-user list column preferences',
	fields: [
		{ fieldname: 'user', fieldtype: 'Link', label: 'User', options: 'User', reqd: 1 },
		{ fieldname: 'doctype_name', fieldtype: 'Link', label: 'DocType Name', options: 'DocType', reqd: 1 },
	],
}
