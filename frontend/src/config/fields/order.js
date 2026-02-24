export default {
	doctype: 'Order',
	icon: 'shopping-cart',
	subtitle: 'Customer order with items and quantities',
	fields: [
		{ fieldname: 'customer', fieldtype: 'Link', label: 'Customer', options: 'Customer', reqd: 1 },
		{ fieldname: 'purchase_order', fieldtype: 'Data', label: 'Purchase Order' },
		{ fieldname: 'order_date', fieldtype: 'Date', label: 'Order Date', reqd: 1 },
		{ fieldname: 'delivery_date', fieldtype: 'Date', label: 'Delivery Date' },
		{ fieldname: 'amended_from', fieldtype: 'Link', label: 'Amended From', options: 'Order', read_only: 1, hidden_if_empty: true },
		{ fieldname: 'items', fieldtype: 'Table', label: 'Items', options: 'Order Item', columns: [
			{ field: 'item', header: 'Item', type: 'link', options: 'Item' },
		]},
		{ fieldname: 'order_details', fieldtype: 'Table', label: 'Order Details', options: 'Order Detail', hidden: true, columns: [
			{ field: 'item', header: 'Item', type: 'link', options: 'Item' },
			{ field: 'colour', header: 'Colour', type: 'link', options: 'Colour' },
			{ field: 'size', header: 'Size', type: 'data' },
			{ field: 'quantity', header: 'Quantity', type: 'float' },
		]},
		{ fieldname: 'order_processes', fieldtype: 'Table', label: 'Order Processes', options: 'Order Process', read_only: 1, columns: [
			{ field: 'item', header: 'Item', type: 'link', options: 'Item' },
			{ field: 'process_name', header: 'Process', type: 'link', options: 'Process' },
			{ field: 'minutes', header: 'Minutes', type: 'float' },
		]},
	],
}
