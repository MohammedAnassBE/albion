export default {
	doctype: 'Order',
	icon: 'shopping-cart',
	subtitle: 'Client order with items and quantities',
	fields: [
		{ fieldname: 'client', fieldtype: 'Link', label: 'Client', options: 'Client', reqd: 1 },
		{ fieldname: 'product_developer', fieldtype: 'Link', label: 'Product Developer', options: 'Product Developer', reqd: 1 },
		{ fieldname: 'client_season', fieldtype: 'Link', label: 'Client Season', options: 'Client Season', reqd: 1 },
		{ fieldname: 'currency_type', fieldtype: 'Select', label: 'Currency Type', options: ['Euro', 'Dollar', 'GBP'], reqd: 1 },
		{ fieldname: 'purchase_order', fieldtype: 'Data', label: 'Purchase Order' },
		{ fieldname: 'order_date', fieldtype: 'Date', label: 'Order Date', reqd: 1 },
		{ fieldname: 'delivery_date', fieldtype: 'Date', label: 'Delivery Date' },
		{ fieldname: 'status', fieldtype: 'Data', label: 'Status', read_only: 1, hidden_if_empty: true },
		{ fieldname: 'amended_from', fieldtype: 'Link', label: 'Amended From', options: 'Order', read_only: 1, hidden_if_empty: true },
		{ fieldname: 'styles', fieldtype: 'Table', label: 'Styles', options: 'Order Style', columns: [
			{ field: 'style', header: 'Style', type: 'link', options: 'Style' },
		]},
		{ fieldname: 'order_details', fieldtype: 'Table', label: 'Order Details', options: 'Order Detail', hidden: true, columns: [
			{ field: 'style', header: 'Style', type: 'link', options: 'Style' },
			{ field: 'colour', header: 'Colour', type: 'link', options: 'Colour' },
			{ field: 'size', header: 'Size', type: 'data' },
			{ field: 'quantity', header: 'Quantity', type: 'float' },
		{ field: 'rate', header: 'Rate', type: 'currency' },
		{ field: 'delivery_date', header: 'Delivery Date', type: 'date' },
		]},
		{ fieldname: 'order_processes', fieldtype: 'Table', label: 'Order Processes', options: 'Order Process', read_only: 1, columns: [
			{ field: 'style', header: 'Style', type: 'link', options: 'Style' },
			{ field: 'process_name', header: 'Process', type: 'link', options: 'Process' },
			{ field: 'minutes', header: 'Minutes', type: 'float' },
		]},
	],
}
