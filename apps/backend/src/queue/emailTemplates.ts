export interface EmailPayload {
  to: string;
  subject: string;
  template: 'WELCOME_USER' | 'APPROVAL_REQUEST' | 'REPLACEMENT_REQUIRED' | 'STATUS_ALERT';
  data: Record<string, any>;
}

export function renderEmail(template: EmailPayload['template'], data: Record<string, any>): { subject: string; html: string; text: string } {
  switch (template) {
    case 'WELCOME_USER': {
      const subject = `Welcome to Recruitment OS, ${data.firstName}!`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #4f46e5;">Welcome to Recruitment OS</h2>
          <p>Hello <strong>${data.firstName} ${data.lastName}</strong>,</p>
          <p>Your user account has been created with role: <strong>${data.roleName}</strong>.</p>
          <p>Email: <strong>${data.email}</strong></p>
          <div style="margin-top: 24px;">
            <a href="${data.loginUrl || 'http://localhost:5173'}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Log In to Portal</a>
          </div>
        </div>
      `;
      const text = `Hello ${data.firstName},\nYour account has been created with role ${data.roleName}.\nLog in at: ${data.loginUrl || 'http://localhost:5173'}`;
      return { subject, html, text };
    }

    case 'APPROVAL_REQUEST': {
      const checkingId = data.checkingId || `APPR-${data.vacancyCode || 'REQ'}`;
      const subject = `[Action Required] Checking ID ${checkingId} — Level ${data.level} Approval for ${data.candidateName} (${data.vacancyCode})`;
      const approveUrl = `${data.clientUrl || 'http://localhost:5173'}/approve?token=${data.token}&checkingId=${checkingId}&action=APPROVED`;
      const rejectUrl = `${data.clientUrl || 'http://localhost:5173'}/reject?token=${data.token}&vacancyCode=${data.vacancyCode}&checkingId=${checkingId}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); color: white; padding: 14px 18px; border-radius: 8px; font-weight: bold; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <span>Recruitment OS — Level ${data.level} Mobile Approval</span>
            <span style="background-color: rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 4px; font-size: 12px; font-family: monospace;">${checkingId}</span>
          </div>

          <div style="margin-bottom: 16px; padding: 10px 14px; background-color: #f1f5f9; border-radius: 6px; font-size: 12px; color: #475569;">
            <div><strong>Approval Checking ID:</strong> <span style="font-family: monospace; color: #4f46e5; font-weight: bold;">${checkingId}</span></div>
            <div><strong>Application Sender:</strong> Abhishek Gopale (<a href="mailto:abhishek.gopale@idonneous.com" style="color: #4f46e5;">abhishek.gopale@idonneous.com</a>)</div>
            <div><strong>Approver:</strong> Divya (<a href="mailto:divya@idonneous.com" style="color: #4f46e5;">divya@idonneous.com</a>)</div>
          </div>

          <h3 style="color: #1e293b; margin-top: 0; font-size: 18px;">Vacancy: ${data.vacancyCode} — ${data.jobTitle}</h3>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #cbd5e1;">
            <p style="margin: 4px 0;"><strong>Client Project:</strong> ${data.projectName}</p>
            <p style="margin: 4px 0;"><strong>Zone & Area:</strong> ${data.zone} — ${data.area}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 10px 0;" />
            <p style="margin: 4px 0;"><strong>Candidate Name:</strong> ${data.candidateName}</p>
            <p style="margin: 4px 0;"><strong>Contact Email:</strong> ${data.candidateEmail || 'Not provided'}</p>
            <p style="margin: 4px 0;"><strong>Phone:</strong> ${data.candidatePhone || 'Not provided'}</p>
            ${data.resumeId ? `<p style="margin: 4px 0;"><strong>Resume / Portfolio Ref:</strong> ${data.resumeId}</p>` : ''}
          </div>

          <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">
            Please tap below to approve or reject this candidate directly from your mobile device:
          </p>

          <div style="display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap;">
            <a href="${approveUrl}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; text-align: center; flex: 1; min-width: 140px;">
              ✓ 1-Click Approve (Level ${data.level})
            </a>
            <a href="${rejectUrl}" style="background-color: #f43f5e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; text-align: center; flex: 1; min-width: 140px;">
              ✕ Reject Candidate
            </a>
          </div>
          <p style="font-size: 11px; color: #94a3b8; margin-top: 24px; text-align: center;">
            Verification Checking ID: ${checkingId} • Single-use link expires in 72 hours.
          </p>
        </div>
      `;
      const text = `Approval Checking ID: ${checkingId}\nSender: abhishek.gopale@idonneous.com\nApprover: divya@idonneous.com\nApproval Required for ${data.candidateName} (${data.vacancyCode})\nPosition: ${data.jobTitle}\nApprove: ${approveUrl}\nReject: ${rejectUrl}`;
      return { subject, html, text };
    }

    case 'REPLACEMENT_REQUIRED': {
      const subject = `[Action Required] Candidate Rejected for ${data.vacancyCode} — Sourcing Reset to ACTIVE`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #f43f5e;">Candidate Rejection & Sourcing Reset</h2>
          <p>Hello Zone Recruiter (<strong>${data.zone} Zone</strong>),</p>
          <p>The candidate <strong>${data.candidateName}</strong> for vacancy <strong>${data.vacancyCode} (${data.jobTitle})</strong> was rejected at Level ${data.level}.</p>
          
          <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 4px 0; color: #9f1239;"><strong>Structured Rejection Reason:</strong> ${data.rejectionReason}</p>
            ${data.comments ? `<p style="margin: 4px 0; color: #9f1239;"><strong>Reviewer Comments:</strong> "${data.comments}"</p>` : ''}
          </div>

          <p style="font-size: 14px; font-weight: bold; color: #1e293b;">
            🔄 Vacancy status has automatically reset back to ACTIVE on your Recruiter Dashboard.
          </p>
          <p>Please source and submit a new replacement candidate for ${data.vacancyCode}.</p>
        </div>
      `;
      const text = `Candidate ${data.candidateName} was rejected for ${data.vacancyCode}.\nReason: ${data.rejectionReason}\nVacancy status reset to ACTIVE. Please source a replacement.`;
      return { subject, html, text };
    }

    case 'STATUS_ALERT': {
      const subject = `Vacancy Alert: ${data.vacancyCode} — ${data.title}`;
      const html = `<p>${data.message}</p>`;
      const text = data.message;
      return { subject, html, text };
    }
  }
}
