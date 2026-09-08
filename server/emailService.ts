import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  callerPhone?: string;
}

let testAccountTransporter: nodemailer.Transporter | null = null;

/**
 * Creates or gets the email transporter.
 * Supports custom SMTP from environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS),
 * Gmail app password, or fallback to Ethereal/mock with full logging so emails can be previewed.
 */
export async function getEmailTransporter(): Promise<nodemailer.Transporter> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // If using Gmail auth
  const gmailUser = process.env.GMAIL_USER || 'yucvtcrnxeh@gmail.com';
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (gmailPass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass.replace(/\s+/g, ''), // Strip any spaces from 16-character app password
      },
    });
  }

  // Fallback: Use Ethereal test account or local logging transporter
  if (!testAccountTransporter) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      testAccountTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email Service] Created Ethereal test account: ${testAccount.user}`);
    } catch {
      // Direct stream transport fallback
      testAccountTransporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }
  }

  return testAccountTransporter;
}

/**
 * Sends an email containing the conversation summary, transcript, or custom requested content.
 */
export async function sendEmailMessage(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}> {
  try {
    const transporter = await getEmailTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.GMAIL_USER || '"Yemot AI Voice Assistant" <ivr-ai@yemot.system>';

    const htmlBody = options.html || `
      <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
        <div style="background-color: #1e3a8a; color: white; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px;">סיכום שיחה קולית - ימות המשיח AI</h2>
        </div>
        
        <p style="font-size: 15px; margin-bottom: 15px;">שלום,</p>
        <p style="font-size: 15px; margin-bottom: 20px;">להלן המידע שביקשת במהלך השיחה הטלפונית:</p>
        
        <div style="background-color: #f8fafc; border-right: 4px solid #2563eb; padding: 14px; border-radius: 4px; margin-bottom: 20px; white-space: pre-wrap; font-size: 15px;">
${options.text}
        </div>

        ${options.callerPhone ? `<p style="font-size: 12px; color: #64748b;">מספר טלפון מחייג: ${options.callerPhone}</p>` : ''}
        <p style="font-size: 12px; color: #64748b;">תאריך ושעה: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">נשלח אוטומטית על ידי מערכת המענה הקולי החכם של ימות המשיח</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject || 'מידע וסיכום משיחה קולית - ימות המשיח AI',
      text: options.text,
      html: htmlBody,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[Email Service] Email sent successfully to ${options.to}. ID: ${info.messageId}`);
    if (previewUrl) {
      console.log(`[Email Service] Preview URL: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (error: any) {
    console.error('[Email Service] Error sending email:', error);
    return {
      success: false,
      error: error.message || 'שגיאה בשליחת האימייל',
    };
  }
}
