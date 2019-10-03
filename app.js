const express = require('express')
const app = express()
const sqlite = require('sqlite')
//promise版的sqlite模块
const cookieParser = require('cookie-parser')
const nodemailer= require('nodemailer')

const https = require('https')
const fs = require('fs')
let port = 80
let httpsPort = 443

//cookie签名
let cookieSignature = 'myApp'

const dbPromise = sqlite.open(__dirname + '/db/vote.sqlite')
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
    let cookie = req.signedCookies
    if(cookie.uid) {
        let user =  await db.get(`SELECT * FROM users WHERE uid = ${cookie.uid}`)
        if(user) {
            res.redirect('/homepage/' + user.username)
        } else {
            res.send('fake cookie')
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
        // const data = await db.all(`select * from users`)

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
    .post(async (req, res, next) => {
        //接受注册信息
        let user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}"`)
        if(user) {
            res.render('redirect.pug', {title: 'redirecting', msg: 'username already in use', time: '2'})
        } else {
            //用户名可以注册，注册成功设置cookie并跳转
            await db.run(`INSERT INTO users VALUES(null,"${req.body.username}","${req.body.password}","${req.body.email}",null,"${req.ip}","${Date.now()}","${req.body.avatarPath}")`)
            user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}"`)
            res.cookie('uid', user.uid, {signed: true})
            res.render('redirect', {title: 'redirecting', msg: "registration success", time: "2"})
        }
        next()
    })
    
    //登陆成功主页
    app.get('/homepage/:username', async (req, res, next) => {
    const user = await db.get(`SELECT * FROM users WHERE username = "${req.params.username}" AND uid = "${req.signedCookies.uid}"`)
    if(user) {
        res.render('homepage', {title: 'Homepage', username: user.username, avatarPath: __dirname + '/public/avatars/' + user.avatarPath})
    } else {
        res.clearCookie('uid')
        res.render('redirect', {title: 'redirecting', msg: "can't find user", time: "2"})
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
            `
        }, (err, info) => {
            if (err) {
                //发送失败则在跳转页显示错误信息
                res.render('redirect.pug', {title: 'redirecting', msg: "error" + err.responseCode, time: '2'})
            } else {
                db.run(`INSERT INTO passwordChanging VALUES(${user.uid}, "${req.body.password}", ${token})`)
                setTimeout(() => {
                    //20f分钟后使连接失效
                    db.run(`DELETE FROM passwordChanging WHERE token = ${token}`)
                }, 1000 * 60 * 20)
                res.render('redirect.pug', {title: 'redirecting', msg: "Please check your email in 20 minutes", time: '3'})
            }
        })
    } else {
        res.render('redirect.pug', {title: 'redirecting', msg: "Wrong username or email", time: '3'})
    }
})

app.get('/verification/:token', async (req, res, next) => {
    //验证token是否存在
    const Sent = await db.get(`SELECT * FROM passwordChanging WHERE token = ${req.params.token}`)
    if(Sent) {
        //连接有效则将临时数据库中的新密码更新到users
        await db.run(`UPDATE users SET password = "${Sent.password}" WHERE uid = ${Sent.uid}`)
        db.run(`DELETE FROM passwordChanging WHERE token = ${req.params.token}`)
        res.render('redirect.pug', {title: 'redirecting', msg: "Password updated successfully", time: '2'})
    } else {
        res.render('redirect.pug', {title: 'redirecting', msg: "Link expried", time: '5'})
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
    app.listen(port, () => {
        console.log(`express listenning on ${port}`)
    })
    https.createServer({
        key: fs.readFileSync("/root/.acme.sh/limbotech.top/limbotech.top.key"),
        cert: fs.readFileSync("/root/.acme.sh/limbotech.top/limbotech.top.cer")
    }, app).listen(httpsPort)
})