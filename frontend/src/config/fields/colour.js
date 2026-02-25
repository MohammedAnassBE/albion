export default {
	doctype: 'Colour',
	icon: 'palette',
	subtitle: 'Colour master record',
	fields: [
		{ fieldname: 'colour_name', fieldtype: 'Data', label: 'Colour Name', reqd: 1 },
		{ fieldname: 'colour_no', fieldtype: 'Link', label: 'Colour No', options: 'Colour No' },
		{ fieldname: 'yarn_name', fieldtype: 'Data', label: 'Yarn Name' },
	],
}
