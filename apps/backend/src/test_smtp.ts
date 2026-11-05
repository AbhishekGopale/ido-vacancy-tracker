import nodemailer from 'nodemailer';
import { env } from './config/env.js';

async function verifySmtp() {
  console.log('--------------------------------------------------');
  console.log('🔍 Testing SMTP Connection to Mail Server...');
  console.log(`Host: ${env.EMAIL_HOST}`);
  console.log(`Port: ${env.EMAIL_PORT} (Secure: ${env.EMAIL_PORT === 465 || env.EMAIL_SECURE})`);
  console.log(`User: ${env.EMAIL_USER || '(empty)'}`);
  console.log(`Password: ${env.EMAIL_PASSWORD ? '******** (' + env.EMAIL_PASSWORD.length + ' chars)' : '(empty)'}`);
  console.log(`Sender: ${env.EMAIL_FROM}`);
  console.log('--------------------------------------------------');

  if (!env.EMAIL_HOST || !env.EMAIL_USER || !env.EMAIL_PASSWORD) {
    console.error('❌ Incomplete SMTP configuration in apps/backend/.env:');
    if (!env.EMAIL_HOST) console.error('   - EMAIL_HOST is missing');
    if (!env.EMAIL_USER) console.error('   - EMAIL_USER is missing');
    if (!env.EMAIL_PASSWORD) console.error('   - EMAIL_PASSWORD is missing');
    console.log('\nPlease enter your credentials in apps/backend/.env and re-run.');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465 || env.EMAIL_SECURE,
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASSWORD,
    },
  });

  try {
    console.log('Connecting and verifying SMTP credentials...');
    await transporter.verify();
    console.log('✅ SMTP Handshake Successful! Mail server authenticated.');

    console.log(`\nSending test ping email to ${env.EMAIL_APPROVER}...`);
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: env.EMAIL_APPROVER,
      subject: `[SMTP Test Ping] Recruitment OS Verification`,
      text: `Hello,\nThis is a test email sent from Recruitment OS via ${env.EMAIL_HOST} to verify live email transmission to ${env.EMAIL_APPROVER}.\n\nTimestamp: ${new Date().toISOString()}`,
    });

    console.log(`🎉 TEST EMAIL SENT SUCCESSFULLY!`);
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Accepted recipients: ${info.accepted.join(', ')}`);
    console.log('--------------------------------------------------');
  } catch (err: any) {
    console.error('\n❌ SMTP Connection Failed!');
    console.error(`Error message: ${err.message}`);
    if (err.code === 'EAUTH') {
      console.error('\n👉 Authentication Error (EAUTH):');
      console.error('   - For Google Workspace / Gmail (smtp.gmail.com):');
      console.error('     You must generate and use a 16-character Google "App Password"');
      console.error('     (Google Account -> Security -> 2-Step Verification -> App Passwords).');
    }
    console.log('--------------------------------------------------');
    process.exit(1);
  }
}

verifySmtp().catch(console.error);
