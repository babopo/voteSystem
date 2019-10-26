const express = require('express')
const app = express()
const sqlite = require('sqlite')
//promise版的sqlite模块
const cookieParser = require('cookie-parser')
const nodemailer= require('nodemailer')
const multer = require('multer')
const sharp = require('sharp')
const fs = require('fs')
const fsp = fs.promises

const httpServer = require('http').createServer(app)
const httpsServer = require('https').createServer(({
    key: fs.readFileSync("/root/.acme.sh/limbotech.top/limbotech.top.key"),
    cert: fs.readFileSync("/root/.acme.sh/limbotech.top/limbotech.top.cer")
}, app))
const url = require('url')
const port = 80
const httpsPort = 443

// 记录有多少人正在聊天室中
let loginUsers = 0

//websocket http server
const io = require('socket.io')(httpServer)
//只在homepage页请求了连接，而homepage页url的最后一个/之后为username
io.on('connection', async socket => {
    //建立连接时触发
    loginUsers++
    const username = decodeURIComponent(url.parse(socket.request.headers.referer).path.replace(/\/homepage\//, ''))
    //从url中获取的用户名记得转码
    const user = await db.get(`SELECT * FROM users WHERE username = "${username}"`)
    const history = await db.all(`SELECT username, time, message, avatarPath FROM chatMessage JOIN users USING (uid)`)
    //通知其他人有人连接
    socket.broadcast.emit('userConnected', username + ' connected')
    io.emit('loginUsers', loginUsers)
    //历史记录只发给建立连接的客户端，是一个json数组
    socket.emit("history", history)

    socket.on('msg', async msg => {
        //当这个连接有信息发送过来时触发，给所有连接中的客户端发送信息
        const time = Date.now()
        await db.run(`INSERT INTO chatMessage VALUES("${user.uid}", "${msg}", "${time}")`)
        const newMessage = await db.get(`SELECT username, time, message, avatarPath FROM users JOIN chatMessage USING (uid) WHERE time = "${time}" AND username = "${username}"`)
        io.emit('msg', newMessage)
        //需要给所有人发送当前发言人的头像，名称，时间和内容   
    })
    socket.on('disconnect', async () => {
        //通知所有人有人离开
        io.emit('loginUsers', --loginUsers)
        socket.broadcast.emit('userLeave', username + ' disconnected')
    })
})
//websocket https server
const ios = require('socket.io')(httpsServer)
//只在homepage页请求了连接，而homepage页url的最后一个/之后为username
ios.on('connection', async socket => {
    //建立连接时触发
    loginUsers++
    const username = decodeURIComponent(url.parse(socket.request.headers.referer).path.replace(/\/homepage\//, ''))
    //从url中获取的用户名记得转码
    const user = await db.get(`SELECT * FROM users WHERE username = "${username}"`)
    const history = await db.all(`SELECT username, time, message, avatarPath FROM chatMessage JOIN users USING (uid)`)
    //通知其他人有人连接
    socket.broadcast.emit('userConnected', username + ' connected')
    ios.emit('loginUsers', loginUsers)
    //历史记录只发给建立连接的客户端，是一个json数组
    socket.emit("history", history)

    socket.on('msg', async msg => {
        //当这个连接有信息发送过来时触发，给所有连接中的客户端发送信息
        const time = Date.now()
        await db.run(`INSERT INTO chatMessage VALUES("${user.uid}", "${msg}", "${time}")`)
        const newMessage = await db.get(`SELECT username, time, message, avatarPath FROM users JOIN chatMessage USING (uid) WHERE time = "${time}" AND username = "${username}"`)
        ios.emit('msg', newMessage)
        //需要给所有人发送当前发言人的头像，名称，时间和内容   
    })
    socket.on('disconnect', async () => {
        //通知所有人有人离开
        ios.emit('loginUsers', --loginUsers)
        socket.broadcast.emit('userLeave', username + ' disconnected')
    })
})

//cookie签名
const cookieSignature = 'myApp'

const dbPromise = sqlite.open(__dirname + '/db/chattingRoom.sqlite')
//dbPromise 的value为可调用的db
let db

//创建邮件发送服务
const mailer = nodemailer.createTransport({
    service: "qq",
    sercure: true,
    auth: {
        user: "453565260",
        pass: "bicmkojwoceabgbh"
    }
})

//处理头像上传
const uploader = multer({
    dest: __dirname + '/public/avatars/'
})

//前置过滤器
app.use(cookieParser(cookieSignature))
//解析请求体
app.use(express.json())
app.use(express.urlencoded())

//设置使用views文件夹下的pug模板
app.set('view engine', 'pug')

//首页
app.get('/', async (req, res, next) => {
    //打开首页
    const cookie = req.signedCookies
    if(cookie.uid) {
        const user =  await db.get(`SELECT * FROM users WHERE uid = ${cookie.uid}`)
        if(user) {
            res.redirect('/homepage/' + user.username)
        } else {
            res.clearCookie('uid')
            res.render('redirect.pug', {title: 'redirecting', msg: "fake cookie", time: '2'})
        }
    } else {
        //没有cookie则返回输入账号页面
        res.render('index.pug', {title: 'Shithub'})
    }
    next()
})

//登陆页
app.route('/login')
    .post(async (req, res, next) => {
        const user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}" AND password = "${req.body.password}"`)
        //查不到返回undefined
        if(user) {
            //更新登陆时间
            await db.run(`UPDATE users SET lastLoginDate = "${Date.now()}", lastloginIP = "${req.ip}" WHERE uid = ${user.uid}`)
            res.cookie('uid', user.uid, { signed: true})
            res.render('redirect.pug', {title: 'redirecting', msg: "logging in", time: '2'})
        } else {
            res.render('redirect.pug', {title: 'redirecting', msg: "wrong username or password", time: '2'})
        }
        next()
    })
    
    
//注册页
app.route('/register')
    .get((req, res, next) => {
        //转到注册页面
        res.render('register.pug', {title: "Rigister"})
        next()
    })
    .post(uploader.single('avatar'), async (req, res, next) => {
        // 接受注册信息
        const filePath = __dirname + '/public/avatars/' + req.file.filename
        let user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}"`)
        if(user) {
            res.render('redirect.pug', {title: 'redirecting', msg: 'username already in use', time: '2'})
            fs.unlink(filePath)
            //删除上传的文件
        } else {
            //用户名可以注册，注册成功设置cookie并跳转
            if (/image/.test(req.file.mimetype)) {
                // 判断上传的是否是图片
                imgBuffer = await fsp.readFile(req.file.path)
                await sharp(imgBuffer).resize(50, 50).toFile(req.file.path)
                //将图片统一大小后重新保存
            } else {
                //不是图片直接删掉
                fs.unlink(filePath)
            }
            await db.run(`INSERT INTO users VALUES(null,"${req.body.username}","${req.body.password}","${req.body.email}",null,"${req.ip}","${Date.now()}","${req.file.filename}")`)
            user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}"`)
            res.cookie('uid', user.uid, {signed: true})
            res.render('redirect', {title: 'redirecting', msg: "registration success", time: "2"})
        }
        next()
    })


//登陆成功主页
app.get('/homepage/:username', async (req, res, next) => {
    //同时检测用户名和cookie防止直接输入url打开
    const user = await db.get(`SELECT * FROM users WHERE username = "${req.params.username}" AND uid = "${req.signedCookies.uid}"`)
    if(user) {
        res.render('homepage', {title: 'Homepage', username: user.username, avatarPath: '/public/avatars/' + user.avatarPath})
    } else {
        res.clearCookie('uid')
        res.render('redirect', {title: 'redirecting', msg: "can't find user, plese login again", time: "2"})
    }
    next()
})


//登出
app.get('/logout', (req, res, next) => {
    res.clearCookie('uid')
    res.render('redirect.pug', {title: 'redirecting', msg: "logging out", time: '2'})
    next()
})


//忘记密码
app.get('/forget', (req, res, next) => {
    res.render('forget.pug', {title: 'Forget'})
    next()
})
app.post('/forget', async (req, res, next) => {
    const user = await db.get(`SELECT * FROM users WHERE ${req.body.method} = "${req.body.val}"`)
    if(user) {
        const token = Math.random().toString().slice(2)
        const tempURL = 'http://47.97.208.138/verification/' + token
        mailer.sendMail({
            from: '"Shithub" <453565260@qq.com>',
            to: user.email,
            subject: 'Please verify your account',
            text: `
            Username: ${user.username}
            New Password: ${req.body.password}

            click: ${tempURL}
            This link would be expried in 20 minutes! 
            `
        }, (err, info) => {
            if (err) {
                //发送失败则在跳转页显示错误信息
                res.render('redirect.pug', {title: 'redirecting', msg: "error" + err.responseCode, time: '2'})
            } else {
                db.run(`INSERT INTO passwordChanging VALUES(${user.uid}, "${req.body.password}", ${token})`)
                setTimeout(() => {
                    //20分钟后使连接失效
                    db.run(`DELETE FROM passwordChanging WHERE token = ${token}`)
                }, 1000 * 60 * 20)
                res.render('redirect.pug', {title: 'redirecting', msg: "please check your email in 20 minutes", time: '3'})
            }
        })
    } else {
        res.render('redirect.pug', {title: 'redirecting', msg: "wrong username or email", time: '3'})
    }
})

app.get('/verification/:token', async (req, res, next) => {
    //验证token是否存在
    const Sent = await db.get(`SELECT * FROM passwordChanging WHERE token = ${req.params.token}`)
    if(Sent) {
        //连接有效则将临时数据库中的新密码更新到users
        await db.run(`UPDATE users SET password = "${Sent.password}" WHERE uid = ${Sent.uid}`)
        db.run(`DELETE FROM passwordChanging WHERE token = ${req.params.token}`)
        res.render('redirect.pug', {title: 'redirecting', msg: "password updated successfully", time: '2'})
    } else {
        res.render('redirect.pug', {title: 'redirecting', msg: "link expried", time: '5'})
    }
})


//访问静态文件
app.use('/static', express.static(__dirname + '/static'))
//脚本和样式
app.use('/public', express.static(__dirname + '/public'))
//用户上传的文件

//注意接的文件夹名称最后生成的是基于启动的node进程目录，所以用绝对路径更保险
//第一个参数要创建虚拟路径前缀，否则不能访问
//多看文档





 



dbPromise.then((data) => {
    //数据库加载完成后再开始监听端口
    db = data
    httpServer.listen(port, () => {
        console.log(`express listenning on ${port}`)
    })
    httpsServer.listen(httpsPort)
})