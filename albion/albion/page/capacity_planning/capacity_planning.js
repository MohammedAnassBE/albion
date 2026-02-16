frappe.pages['capacity-planning'] = frappe.pages['capacity-planning'] || {};

frappe.pages['capacity-planning'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Capacity Planning',
        single_column: true
    });

    // Make the page fill viewport — no page-level scrolling
    const style = document.createElement('style');
    style.textContent = `
        [data-page-container="capacity-planning"] .layout-main-section,
        [data-page-container="capacity-planning"] .layout-main-section-wrapper {
            max-width: 100% !important;
        }
        [data-page-container="capacity-planning"] .page-container {
            overflow: hidden !important;
        }
        [data-page-container="capacity-planning"] .main-section {
            overflow: hidden !important;
        }
        [data-page-container="capacity-planning"] .container.page-body {
            overflow: hidden !important;
        }
        [data-page-container="capacity-planning"] .page-content {
            overflow: hidden !important;
        }
        #capacity-planning-app {
            height: calc(100vh - var(--navbar-height, 60px) - 40px);
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);

    // Add container for Vue app
    $(page.main).html('<div id="capacity-planning-app"></div>');

    // Wait for Vue components to load
    function initCapacityPlanning() {
        if (!frappe.albion || !frappe.albion.ui || !frappe.albion.ui.CapacityPlanning) {
            setTimeout(initCapacityPlanning, 100);
            return;
        }

        // Load initial data
        Promise.all([
            frappe.call({
                method: 'albion.albion.page.capacity_planning.capacity_planning.get_orders'
            }),
            frappe.call({
                method: 'albion.albion.page.capacity_planning.capacity_planning.get_processes'
            }),
            frappe.call({
                method: 'albion.albion.page.capacity_planning.capacity_planning.get_machines'
            })
        ]).then(([ordersRes, processesRes, machinesRes]) => {
            const orders = ordersRes.message || [];
            const processes = processesRes.message || [];
            const machines = machinesRes.message || [];

            // Initialize Vue app
            const container = $(page.main).find('#capacity-planning-app')[0];
            const app = new frappe.albion.ui.CapacityPlanning(container);
            app.load_data(orders, processes, machines);

            page.capacity_app = app;
        }).catch(err => {
            console.error('Error loading capacity planning data:', err);
            frappe.show_alert({
                message: __('Error loading data'),
                indicator: 'red'
            });
        });
    }

    // Start initialization
    initCapacityPlanning();
};

frappe.pages['capacity-planning'].refresh = function(wrapper) {
    // Refresh handler - Vue component handles its own refresh
};
