window.onload = function () {
    var ipAdressInput = document.getElementById('ip_address_input');
    if (localStorage.getItem('ip_address') !== null) {
        ipAdressInput.value = localStorage.getItem('ip_address');
    }
};
function save() {
    var ipAdressInput = document.getElementById('ip_address_input');
    localStorage.setItem('ip_address', ipAdressInput.value);
}
//# sourceMappingURL=settings.js.map