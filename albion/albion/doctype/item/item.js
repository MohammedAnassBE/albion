// Copyright (c) 2026, Essdee and contributors
// For license information, please see license.txt

frappe.ui.form.on('Item', {
    size_range: function(frm) {
        if (frm.doc.size_range) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Size Range',
                    name: frm.doc.size_range
                },
                callback: function(r) {
                    if (r.message) {
                        frm.clear_table('sizes');
                        r.message.sizes.forEach(function(row) {
                            let child = frm.add_child('sizes');
                            child.size = row.size;
                        });
                        frm.refresh_field('sizes');
                    }
                }
            });
        }
    }
});
