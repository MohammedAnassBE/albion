export default {
	doctype: 'Client',
	icon: 'users',
	subtitle: 'Client contact and address details',
	fields: [
		{ fieldname: 'client_name', fieldtype: 'Data', label: 'Client Name', reqd: 1 },
		{ fieldname: 'phone', fieldtype: 'Data', label: 'Phone' },
		{ fieldname: 'email', fieldtype: 'Data', label: 'Email' },
		{ fieldname: 'address', fieldtype: 'Small Text', label: 'Address' },
	],
}
