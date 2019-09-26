//跳转页的时间倒计时
const msg = document.querySelector('strong')
let num = msg.textContent

function countDown() {
    setTimeout(() => {
        num -= 1
        msg.textContent = num
        if(num) {
            countDown()
        } else {
            location.href = '/'
        }
    }, 1000)
}

countDown()

console.log(1)