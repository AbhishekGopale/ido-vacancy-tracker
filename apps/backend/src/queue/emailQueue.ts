import { Queue, JobsOptions } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { EmailPayload, renderEmail } from './emailTemplates.js';

export const EMAIL_QUEUE_NAME = 'email-queue';

export let emailQueue: Queue<EmailPayload> | null = null;

try {
  emailQueue = new Queue<EmailPayload>(EMAIL_QUEUE_NAME, {
    connection: redisConnectionOptions,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: {
        count: 500,
      },
    },
  });
} catch {
  emailQueue = null;
}

import { env } from '../config/env.js';
import nodemailer from 'nodemailer';

let directTransporter: nodemailer.Transporter | null = null;

function getDirectTransporter(): nodemailer.Transporter | null {
  if (!directTransporter && env.EMAIL_PROVIDER === 'smtp' && env.EMAIL_HOST) {
    directTransporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465 || env.EMAIL_SECURE,
      auth:
        env.EMAIL_USER && env.EMAIL_PASSWORD
          ? {
              user: env.EMAIL_USER,
              pass: env.EMAIL_PASSWORD,
            }
          : undefined,
    });
  }
  return directTransporter;
}

export async function enqueueEmail(
  name: string,
  payload: EmailPayload,
  opts?: JobsOptions
): Promise<void> {
  const fromSender = env.EMAIL_FROM;
  const checkingId = payload.data?.checkingId || 'N/A';
  const { subject, html, text } = renderEmail(payload.template, payload.data);

  // 1. Try BullMQ Queue if Redis is active
  try {
    if (emailQueue) {
      await emailQueue.add(name, payload, {
        ...opts,
        jobId: opts?.jobId || `${payload.template}-${payload.to}-${Date.now()}`,
      });
      console.log(`📨 [MAIL TRANSMIT - QUEUE] Job: ${name} | From: ${fromSender} | To: ${payload.to} | Checking ID: ${checkingId}`);
      return;
    }
  } catch {
    // Redis unavailable: fallback to direct transmission below
  }

  // 2. Direct SMTP Transmission
  if (env.EMAIL_PROVIDER === 'smtp') {
    if (!env.EMAIL_PASSWORD) {
      console.warn(`⚠️ [SMTP CONFIG INCOMPLETE] EMAIL_PROVIDER is 'smtp', but EMAIL_PASSWORD is empty in apps/backend/.env.`);
      console.warn(`   Real emails cannot be dispatched to ${payload.to} until an SMTP password/app-password is configured.`);
      console.log(`📬 [MAIL TRANSMIT - SIMULATED] From: ${fromSender} | To: ${payload.to} | Checking ID: ${checkingId} | Subject: ${subject}`);
      return;
    }

    try {
      const transporter = getDirectTransporter();
      if (transporter) {
        console.log(`📡 [SMTP CONNECTING] Transmitting email to ${payload.to} via ${env.EMAIL_HOST}:${env.EMAIL_PORT}...`);
        const info = await transporter.sendMail({
          from: fromSender,
          to: payload.to,
          subject,
          text,
          html,
        });
        console.log(`✅ [SMTP DELIVERED] Real email successfully delivered to ${payload.to}! Message ID: ${info.messageId} | Checking ID: ${checkingId}`);
        return;
      }
    } catch (err: any) {
      console.error(`❌ [SMTP ERROR] Transmission to ${payload.to} failed: ${err.message}`);
      return;
    }
  }

  // 3. Simulated Logger (EMAIL_PROVIDER === 'log')
  console.log(`📬 [MAIL TRANSMIT - SIMULATED (DEV LOG)] From: ${fromSender} | To: ${payload.to} | Checking ID: ${checkingId} | Subject: ${subject}`);
  console.log(`ℹ️ [NOTE] EMAIL_PROVIDER=log is active. To deliver actual emails to real inboxes, configure EMAIL_PROVIDER=smtp and your SMTP password in apps/backend/.env.`);
}
