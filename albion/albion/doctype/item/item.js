// Copyright (c) 2026, Essdee and contributors
// For license information, please see license.txt

frappe.ui.form.on('Item', {
    onload: function(frm) {
        if (frm.is_new()) {
            frappe.db.get_doc('Albion Settings').then(settings => {
                if (settings.default_colour_attribute && !frm.doc.colour_attribute) {
                    frm.set_value('colour_attribute', settings.default_colour_attribute);
                }
                if (settings.default_size_attribute && !frm.doc.size_attribute) {
                    frm.set_value('size_attribute', settings.default_size_attribute);
                }
            });
        }
        frm.trigger('set_queries');
    },

    refresh: function(frm) {
        frm.trigger('set_queries');
    },

    colour_attribute: function(frm) {
        frm.trigger('set_queries');
    },

    size_attribute: function(frm) {
        frm.trigger('set_queries');
    },

    set_queries: function(frm) {
        if (frm.doc.colour_attribute) {
            frm.fields_dict['colours'].grid.get_field('colour').get_query = function() {
                return {
                    filters: {
                        'attribute': frm.doc.colour_attribute
                    }
                };
            };
        }
        if (frm.doc.size_attribute) {
            frm.fields_dict['sizes'].grid.get_field('size').get_query = function() {
                return {
                    filters: {
                        'attribute': frm.doc.size_attribute
                    }
                };
            };
        }
    },

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