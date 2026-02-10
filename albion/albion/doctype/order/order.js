// Copyright (c) 2026, Essdee and contributors
// For license information, please see license.txt

frappe.provide("albion.order");

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
    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.trigger('render_order_matrix');
        }
    },
    
    render_order_matrix: async function(frm) {
        try {
            await waitForOrderMatrix();
            
            if (!frm.order_matrix) {
                frm.order_matrix = new frappe.albion.ui.OrderMatrix(
                    frm.fields_dict['order_matrix_html'].wrapper
                );
            }
            
            const items = frm.doc.items || [];
            const orderDetails = frm.doc.order_details || [];
            
            frm.order_matrix.load_data(items, orderDetails, frm.doc.docstatus);
        } catch (e) {
            console.error('Failed to load OrderMatrix:', e);
            $(frm.fields_dict['order_matrix_html'].wrapper).html(
                '<div class="text-muted">Loading components...</div>'
            );
        }
    },
    
    on_submit: function(frm) {
        frm.trigger('save_order_details');
    },
    
    save_order_details: function(frm) {
        if (frm.order_matrix) {
            const details = frm.order_matrix.get_data();
            frm.doc.order_details = details;
        }
    }
});

albion.order.OrderController = class OrderController extends frappe.ui.form.Controller {
    async refresh() {
        $(this.frm.fields_dict['order_matrix_html'].wrapper).html("");
        
        if (!this.frm.is_new()) {
            try {
                await waitForOrderMatrix();
                
                this.frm.order_matrix = new frappe.albion.ui.OrderMatrix(
                    this.frm.fields_dict['order_matrix_html'].wrapper
                );
                
                const items = this.frm.doc.items || [];
                const orderDetails = this.frm.doc.order_details || [];
                
                this.frm.order_matrix.load_data(items, orderDetails, this.frm.doc.docstatus);
            } catch (e) {
                console.error('Failed to load OrderMatrix:', e);
            }
        }
    }
    
    validate() {
        if (this.frm.order_matrix) {
            const details = this.frm.order_matrix.get_data();
            this.frm.doc.order_details = details;
        }
    }
}

extend_cscript(cur_frm.cscript, new albion.order.OrderController({frm: cur_frm}));