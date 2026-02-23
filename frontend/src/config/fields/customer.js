export default {
	doctype: 'Customer',
	icon: 'users',
	subtitle: 'Customer contact and address details',
	fields: [
		{ fieldname: 'customer_name', fieldtype: 'Data', label: 'Customer Name', reqd: 1 },
		{ fieldname: 'phone', fieldtype: 'Data', label: 'Phone' },
		{ fieldname: 'email', fieldtype: 'Data', label: 'Email' },
		{ fieldname: 'address', fieldtype: 'Small Text', label: 'Address' },
	],
}
