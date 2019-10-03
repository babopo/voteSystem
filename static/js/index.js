//登陆页面的功能
const registerBtn = document.querySelector('#register')
const forgetBtn = document.querySelector('#forget')
const usernameInput = document.querySelector('#username')
const passwordInput = document.querySelector('#password')

registerBtn.addEventListener('click', e => {
    //跳转到注册页面
    location.href = "/register"
})

forgetBtn.addEventListener('click', e => {
    location.href = "/forget"
})