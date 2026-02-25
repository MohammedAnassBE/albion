export default {
	doctype: 'Albion Settings',
	icon: 'wrench',
	subtitle: 'Global application configuration',
	fields: [
		{ fieldname: 'default_size_range', fieldtype: 'Link', label: 'Default Size Range', options: 'Size Range' },
		{ fieldname: 'company_name', fieldtype: 'Data', label: 'Company Name' },
		{ fieldname: 'apply_zoom', fieldtype: 'Check', label: 'Apply Zoom' },
	],
}
