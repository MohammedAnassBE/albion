frappe.provide("my_app");

my_app.redirect_to_web = function () {
    if (window.location.pathname === '/' || window.location.pathname === '/app' || window.location.pathname === '/app/') {
        window.location.href = '/web';
    }
};

$(document).ready(function () {
    my_app.redirect_to_web();
});
