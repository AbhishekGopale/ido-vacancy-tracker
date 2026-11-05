import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { env } from './config/env.js';
import { redisConnectionOptions } from './config/redis.js';
import { EMAIL_QUEUE_NAME } from './queue/emailQueue.js';
import { EmailPayload, renderEmail } from './queue/emailTemplates.js';

console.log('🚀 Initializing BullMQ Email Worker process...');

// Create Transporter based on configuration
let transporter: nodemailer.Transporter;

if (env.EMAIL_PROVIDER === 'smtp' && env.EMAIL_HOST) {
  transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: env.EMAIL_USER
      ? {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASSWORD,
        }
      : undefined,
  });
  console.log(`📧 Configured SMTP Transporter (${env.EMAIL_HOST}:${env.EMAIL_PORT})`);
} else {
  // Development / Log Transporter
  transporter = nodemailer.createTransport({
    jsonTransport: true,
  });
  console.log('📝 Configured Development Log Email Transporter (emails logged to stdout)');
}

async function processEmailJob(job: Job<EmailPayload>): Promise<void> {
  const { to, template, data } = job.data;
  console.log(`⚙️ [Worker] Processing job ${job.id} (Attempt ${job.attemptsMade + 1}) for ${to} [${template}]`);

  const { subject, html, text } = renderEmail(template, data);

  if (env.EMAIL_PROVIDER === 'log') {
    console.log('------------------------------------------------------------');
    console.log(`📬 [DEV EMAIL DISPATCH] To: ${to}`);
    console.log(`📋 Subject: ${subject}`);
    console.log(`📄 Text Content:\n${text}`);
    console.log('------------------------------------------------------------');
    return;
  }

  const info = await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  console.log(`✅ [Worker] Email delivered to ${to} (MessageId: ${info.messageId})`);
}

export const emailWorker = new Worker<EmailPayload>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConnectionOptions,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 1000,
    },
  }
);

emailWorker.on('ready', () => {
  console.log('⚡ [Worker] Email worker is active and listening for queue jobs.');
});

emailWorker.on('completed', (job: Job) => {
  console.log(`🎉 [Worker] Job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`❌ [Worker] Job ${job?.id} failed with error: ${err.message}. Retries remaining: ${5 - (job?.attemptsMade || 0)}`);
});

emailWorker.on('error', (err: Error) => {
  console.error('💥 [Worker] Internal worker error:', err);
});

// Graceful Shutdown
async function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Gracefully terminating BullMQ worker...`);
  try {
    await emailWorker.close();
    console.log('✅ Worker paused and closed. Exiting process.');
    process.exit(0);
  } catch (err) {
    console.error('⚠️ Error during worker shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
