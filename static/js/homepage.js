const socket = io()
const send = document.querySelector("#sendMessage")
const text = document.querySelector("#enteringMessage")
const typingArea = document.querySelector(".typingArea")
const chatBox = document.querySelector("#chatBox")
const title = document.querySelector(".title")
let chatMessage

const username = window.location.pathname.replace(/\/homepage\//, '')

socket.on('history', msg => {
    chatMessage = msg || []
    if(chatMessage.length) {
        //先按信息发送时间先后排序
        chatMessage.sort((a, b) => {
            a.time - b.time
        })
    }
    chatMessage.forEach(item => updateBox(item))
    scrollToBottom()
})

socket.on('userConnected', msg => {
    //这里msg是字符串
    const join = document.createElement('small')
    join.textContent = msg
    join.className = 'text-muted my-3 connectMsg'
    chatBox.append(join)
    scrollToBottom()
})

socket.on('msg', msg => {
    //当有任何人包括自己发言时获取到了信息
    updateBox(msg)
    scrollToBottom()
})

socket.on('userLeave', msg => {
    //这里msg是字符串
    const leave = document.createElement('small')
    leave.textContent = msg
    leave.className = 'text-muted my-3 connectMsg'
    chatBox.append(leave)
    scrollToBottom()
})

socket.on('loginUsers', num => {
    if(num === 1) {
        title.textContent = 'There is only 1 participant.'
    } else {
        title.textContent = `There are ${num} participants.`
    }
})

function updateBox(chatMsg) {
    // 参数为对象， 属性包括username，time，message， avatarPath
    const li = document.createElement('li')
    li.className = 'media mb-3'
    const img = document.createElement('img')
    //头像
    img.src = '/public/avatars/' + chatMsg.avatarPath
    img.className = 'mr-3'
    li.append(img)
    const div = document.createElement('div')
    div.className = 'media-body'
    const user = document.createElement('b')
    //展示用户名和发言时间
    user.className = 'mt-0 mb-1 userInfo'
    user.textContent = (chatMsg.username === username ? 'You' : chatMsg.username) + ' ' + (new Date(+chatMsg.time).toLocaleString())
    div.append(user)
    //用文本结点加入，还能防一下xss
    div.append(document.createTextNode(chatMsg.message))
    li.append(div)
    chatBox.append(li)
}

function scrollToBottom() {
    //将聊天信息框滚动至最低端
    chatBox.scrollTop = chatBox.scrollHeight - chatBox.clientHeight
}

function sendMsg() {
    socket.emit('msg', text.value)
    text.value = ''
}

send.addEventListener('click', e => {
    sendMsg()
})

typingArea.addEventListener('submit', e => {
    //阻止表单提交
    e.preventDefault()
})