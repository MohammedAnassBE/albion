import { getDoc } from '@/api/client'

export default {
	doctype: 'Style',
	fields: [
		{ fieldname: 'style_code', fieldtype: 'Data', label: 'Style Code', reqd: 1 },
		{ fieldname: 'style_name', fieldtype: 'Data', label: 'Style Name', reqd: 1 },
		{ fieldname: 'machine_frame', fieldtype: 'Link', label: 'Machine Frame', options: 'Machine Frame', reqd: 1 },
		{ fieldname: 'gg', fieldtype: 'Data', label: 'GG', reqd: 1 },
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
		{ fieldname: 'colours', fieldtype: 'Table', label: 'Colours', options: 'Style Colour', columns: [
			{ field: 'colour', header: 'Colour', type: 'link', options: 'Colour' },
			{ field: 'colour_no', header: 'Colour No', type: 'data', read_only: true },
			{ field: 'yarn_name', header: 'Yarn Name', type: 'data', read_only: true },
		]},
		{ fieldname: 'sizes', fieldtype: 'Table', label: 'Sizes', options: 'Style Size', columns: [
			{ field: 'size', header: 'Size', type: 'link', options: 'Size' },
		]},
		{ fieldname: 'processes', fieldtype: 'Table', label: 'Processes', options: 'Style Process', columns: [
			{ field: 'process_name', header: 'Process', type: 'link', options: 'Process' },
			{ field: 'minutes', header: 'Minutes', type: 'float' },
		]},
	],
}
