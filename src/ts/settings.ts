window.onload = function () {
    const ipAdressInput = document.getElementById('ip_address_input') as HTMLInputElement
    if (localStorage.getItem('ip_address') !== null) {
        ipAdressInput.value = localStorage.getItem('ip_address')
    }
}

function save() {
    const ipAdressInput = document.getElementById('ip_address_input') as HTMLInputElement
    localStorage.setItem('ip_address', ipAdressInput.value)
}