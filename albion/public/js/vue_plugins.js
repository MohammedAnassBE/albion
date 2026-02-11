import OrderMatrix from "./components/OrderMatrix.vue";
import CapacityPlanning from "./components/CapacityPlanning.vue";
import { createApp, ref } from 'vue';

frappe.provide("frappe.albion.ui");

frappe.albion.ui.OrderMatrix = class {
    constructor(wrapper) {
        this.$wrapper = $(wrapper);
        this.isReadOnlyRef = ref(false);
        this.make_app();
    }

    make_app() {
        this.app = createApp(OrderMatrix, {
            items: this.items || [],
            orderDetails: this.orderDetails || [],
            isReadOnly: this.isReadOnlyRef
        });
        this.vue = this.app.mount(this.$wrapper.get(0));
    }

    load_data(items, orderDetails, docstatus = 0) {
        this.items = items || [];
        this.orderDetails = orderDetails || [];
        this.isReadOnlyRef.value = docstatus === 1;
        if (this.vue) {
            this.vue.initMatrix(this.items, this.orderDetails);
        }
    }

    get_data() {
        if (this.vue) {
            return this.vue.getData();
        }
        return [];
    }

    updateWrapper(wrapper) {
        this.$wrapper = $(wrapper);
        if (this.vue && this.vue.$el) {
            $(this.vue.$el).appendTo(this.$wrapper);
        }
    }
}

frappe.albion.ui.CapacityPlanning = class {
    constructor(wrapper) {
        this.$wrapper = $(wrapper);
        this.make_app();
    }

    make_app() {
        this.app = createApp(CapacityPlanning, {
            orders: this.orders || [],
            processes: this.processes || [],
            machines: this.machines || []
        });
        this.vue = this.app.mount(this.$wrapper.get(0));
    }

    load_data(orders, processes, machines) {
        this.orders = orders || [];
        this.processes = processes || [];
        this.machines = machines || [];
        if (this.vue) {
            this.vue.loadData({
                orders: this.orders,
                processes: this.processes,
                machines: this.machines
            });
        }
    }
}