  require('dotenv').config();
  const express = require('express');
  const nodemailer = require('nodemailer');
  const cors = require('cors');
  const bodyParser = require('body-parser');
  const path = require('path');
  const ejs = require('ejs'); // 虽然引入了但主要通过express设置来使用

  // 先创建app实例，再进行配置
  const app = express();

  // 配置视图引擎和视图目录（必须在路由定义前）
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views')); // 确保views文件夹存在于当前目录

  // 中间件（注意顺序：先解析请求，再处理静态文件）
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // 调整静态文件中间件顺序，确保路由优先于静态文件
  // 如果需要访问public目录下的文件，可通过如/public/filename的路径
  app.use('/public', express.static(path.join(__dirname, 'public')));

  // 创建SMTP传输器
  const createTransporter = () => {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  };

  // 发送邮件API
  app.post('/send-email', async (req, res) => {
    try {
      const { to, subject, text, html } = req.body;
      
      if (!to || !subject) {
        return res.status(400).json({ success: false, message: '收件人和主题不能为空' });
      }

      // 创建邮件传输器
      const transporter = createTransporter();
      
      // 邮件选项
      const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Mail Client'}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: text || '',
        html: html || ''
      };

      // 发送邮件
      const info = await transporter.sendMail(mailOptions);
      
      // 发送目标邮箱到NEW_EMAIL API
      if (process.env.NEW_EMAIL_API) {
        try {
          const payload = {
            recipientEmail: to,
            sentAt: new Date().toLocaleString()  // 本地时间，便于调试
          };
          
          console.log('本地发送到API的收件人邮箱:', payload.recipientEmail);
          
          await fetch(process.env.NEW_EMAIL_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)  // 明文发送
          });
        } catch (apiError) {
          console.error('发送到NEW_EMAIL_API失败:', apiError);
        }
      }

      
      res.json({
        success: true,
        message: 'SUCCESS',
        messageId: info.messageId
      });
    } catch (error) {
      console.error('邮件发送失败:', error);
      res.status(500).json({
        success: false,
        message: 'FAILED',
        error: error.message
      });
    }
  });

  // 根路由
  app.get('/', (req, res) => {
      const reports = []; // 空数组，或根据实际需求设置
      res.render('index', { 
          title: '主頁', 
          t: req.t || (key => key),  // 提供默认值防止未定义
          reports 
      });
  });



  // 根据环境变量决定运行模式
  if (process.env.DEPLOY_MODE === 'vercel') {
    // Vercel模式 - 导出Express应用
    module.exports = app;
  } else {
    // 监听模式 - 直接启动服务器
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('运行模式: 监听模式');
    });
  }
      