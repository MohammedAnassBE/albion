export default {
	doctype: 'Size Range',
	icon: 'list',
	subtitle: 'Predefined range of sizes for items',
	fields: [
		{ fieldname: 'size_range_name', fieldtype: 'Data', label: 'Size Range Name', reqd: 1 },
		{ fieldname: 'sizes', fieldtype: 'Table', label: 'Sizes', options: 'Size Range Detail', columns: [
			{ field: 'size', header: 'Size', type: 'link', options: 'Size' },
		]},
	],
}
