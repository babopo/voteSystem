const express = require('express')
const app = express()
const sqlite = require('sqlite')
//promise版的sqlite模块
const cookieParser = require('cookie-parser')
const https = require('https')
const fs = require('fs')
let port = 80
let httpsPort = 443

//cookie签名
let cookieSignature = 'myApp'

const dbPromise = sqlite.open(__dirname + '/db/vote.sqlite')
//dbPromise 的value为可调用的db
let db


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
            res.render('redirect.pug', {title: 'redirecting', msg: "logging in"})
        } else {
            res.render('redirect.pug', {title: 'redirecting', msg: "wrong username or password"})
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
            res.render('redirect.pug', {title: 'redirecting', msg: 'username already in use'})
        } else {
            //用户名可以注册，注册成功设置cookie并跳转
            await db.run(`INSERT INTO users VALUES(null,"${req.body.username}","${req.body.password}","${req.body.email}",null,"${req.ip}","${Date.now()}","${req.body.avatarPath}")`)
            user = await db.get(`SELECT * FROM users WHERE username = "${req.body.username}"`)
            res.cookie('uid', user.uid, {signed: true})
            res.render('redirect', {title: 'redirecting', msg: "registration success"})
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
        res.render('redirect', {title: 'redirecting', msg: "can't find user"})
    }
    next()
})


//登出
app.get('/logout', (req, res, next) => {
    res.clearCookie('uid')
    res.render('redirect.pug', {title: 'redirecting', msg: "logging out"})
    next()
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