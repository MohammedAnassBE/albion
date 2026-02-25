export default {
	doctype: 'Shift',
	icon: 'clock',
	subtitle: 'Shift timing and duration',
	fields: [
		{ fieldname: 'shift_name', fieldtype: 'Data', label: 'Shift Name', reqd: 1 },
		{ fieldname: 'start_time', fieldtype: 'Time', label: 'Start Time', reqd: 1 },
		{ fieldname: 'end_time', fieldtype: 'Time', label: 'End Time', reqd: 1 },
		{ fieldname: 'duration_minutes', fieldtype: 'Int', label: 'Duration (Minutes)', read_only: 1 },
	],
}
