import { getDoc } from '@/api/client'

export default {
	doctype: 'Item',
	fields: [
		{ fieldname: 'item_code', fieldtype: 'Data', label: 'Item Code', reqd: 1 },
		{ fieldname: 'item_name', fieldtype: 'Data', label: 'Item Name', reqd: 1 },
		{ fieldname: 'machine_gg', fieldtype: 'Link', label: 'Machine GG', options: 'Machine GG', reqd: 1 },
		{
			fieldname: 'size_range', fieldtype: 'Link', label: 'Size Range', options: 'Size Range',
			async onChange(val, form) {
				if (!val) {
					form.sizes = []
					return
				}
				const doc = await getDoc('Size Range', val)
				if (doc?.sizes) {
					form.sizes = doc.sizes.map(row => ({ size: row.size }))
				}
			},
		},
		{ fieldname: 'colours', fieldtype: 'Table', label: 'Colours', options: 'Item Colour', columns: [
			{ field: 'colour', header: 'Colour', type: 'link', options: 'Colour' },
		]},
		{ fieldname: 'sizes', fieldtype: 'Table', label: 'Sizes', options: 'Item Size', columns: [
			{ field: 'size', header: 'Size', type: 'link', options: 'Size' },
		]},
		{ fieldname: 'processes', fieldtype: 'Table', label: 'Processes', options: 'Item Process', columns: [
			{ field: 'process_name', header: 'Process', type: 'link', options: 'Process' },
			{ field: 'minutes', header: 'Minutes', type: 'float' },
		]},
	],
}
