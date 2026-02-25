// Copyright (c) 2026, Essdee and contributors
// For license information, please see license.txt

function waitForOrderMatrix(maxAttempts = 50) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (frappe.albion && frappe.albion.ui && frappe.albion.ui.OrderMatrix) {
                clearInterval(interval);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error('OrderMatrix not loaded'));
            }
        }, 100);
    });
}

frappe.ui.form.on('Order', {
    refresh: async function(frm) {
        // Always destroy the previous Vue instance to prevent stale data
        if (frm.order_matrix) {
            frm.order_matrix.destroy();
            frm.order_matrix = null;
        }

        const wrapper = frm.fields_dict['order_matrix_html'].wrapper;
        $(wrapper).html('');

        if (!frm.is_new()) {
            try {
                await waitForOrderMatrix();

                frm.order_matrix = new frappe.albion.ui.OrderMatrix(wrapper);

                const items = frm.doc.items || [];
                const orderDetails = frm.doc.order_details || [];

                frm.order_matrix.load_data(items, orderDetails, frm.doc.docstatus);
            } catch (e) {
                console.error('Failed to load OrderMatrix:', e);
                $(wrapper).html(
                    '<div class="text-muted">Loading components...</div>'
                );
            }
        }

        // Close / Reopen buttons
        if (frm.doc.docstatus === 1 && frm.doc.status !== 'Closed') {
            frm.add_custom_button(__('Close'), function () {
                frappe.confirm(
                    __('Close this Order? Closed orders cannot be cancelled or allocated.'),
                    function () {
                        frappe.call({
                            method: 'albion.albion.doctype.order.order.close_order',
                            args: { order_name: frm.doc.name },
                            callback: function () {
                                frm.reload_doc();
                            },
                        });
                    }
                );
            }, __('Status'));
        }

        if (frm.doc.docstatus === 1 && frm.doc.status === 'Closed') {
            frm.add_custom_button(__('Reopen'), function () {
                frappe.confirm(
                    __('Reopen this Order?'),
                    function () {
                        frappe.call({
                            method: 'albion.albion.doctype.order.order.reopen_order',
                            args: { order_name: frm.doc.name },
                            callback: function () {
                                frm.reload_doc();
                            },
                        });
                    }
                );
            }, __('Status'));

            // Hide Cancel/Amend for closed orders
            frm.page.clear_secondary_action();
        }
    },

    before_save: function(frm) {
        if (frm.order_matrix) {
            const details = frm.order_matrix.get_data();
            frm.doc.order_details = details;
        }
    },

    on_submit: function(frm) {
        if (frm.order_matrix) {
            const details = frm.order_matrix.get_data();
            frm.doc.order_details = details;
        }
    }
});
