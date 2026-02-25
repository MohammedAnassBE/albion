export default {
	doctype: 'Currency Exchange',
	icon: 'dollar-sign',
	subtitle: 'Monthly exchange rates (base: GBP)',
	fields: [
		{
			fieldname: 'rates',
			fieldtype: 'Table',
			label: 'Rates',
			options: 'Currency Exchange Rate',
			reqd: 1,
			columns: [
				{ field: 'month_year', header: 'Month Year', type: 'date' },
				{ field: 'euro_rate', header: 'Euro Rate', type: 'float' },
				{ field: 'dollar_rate', header: 'Dollar Rate', type: 'float' },
			],
		},
	],
}
