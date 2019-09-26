const submit = document.getElementById('register')
const username = document.getElementById('username')

submit.addEventListener('click', e => {
    username.textContent = username.textContent.trim()
    if(username.textContent === "" || username.textContent === "undefined" || username.textContent === "null") {
        e.preventDefault()
        alert('fuck u')
    }
})
