import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export class EmailService {
  /** Gửi email xác thực tài khoản */
  async sendVerificationEmail(email: string, token: string, username: string) {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await transporter.sendMail({
      from: `"ChatApp" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: 'Xác thực tài khoản ChatApp',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Xin chào ${username}!</h2>
          <p>Cảm ơn bạn đã đăng ký. Vui lòng nhấn nút bên dưới để xác thực email:</p>
          <a href="${verifyUrl}" 
             style="display: inline-block; padding: 12px 24px; background: #5865F2; 
                    color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Xác thực Email
          </a>
          <p style="color: #666; font-size: 14px;">
            Link có hiệu lực trong ${process.env.VERIFY_TOKEN_EXPIRY_HOURS || 24} giờ.
          </p>
          <p style="color: #999; font-size: 12px;">
            Nếu bạn không đăng ký, vui lòng bỏ qua email này.
          </p>
        </div>
      `,
    });
  }

  /** Gửi email đặt lại mật khẩu */
  async sendResetPasswordEmail(email: string, token: string, username: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"ChatApp" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: 'Đặt lại mật khẩu ChatApp',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Xin chào ${username}!</h2>
          <p>Bạn vừa yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới để tiếp tục:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background: #5865F2; 
                    color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Đặt lại Mật khẩu
          </a>
          <p style="color: #666; font-size: 14px;">
            Link có hiệu lực trong ${process.env.RESET_TOKEN_EXPIRY_HOURS || 1} giờ.
          </p>
          <p style="color: #999; font-size: 12px;">
            Nếu bạn không yêu cầu, vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.
          </p>
        </div>
      `,
    });
  }

  /** Gửi email thông báo đăng nhập từ thiết bị mới (optional) */
  async sendNewDeviceLoginEmail(email: string, deviceName: string, ipAddress: string) {
    await transporter.sendMail({
      from: `"ChatApp Security" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: 'Đăng nhập từ thiết bị mới',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Phát hiện đăng nhập mới</h2>
          <p>Tài khoản của bạn vừa được đăng nhập từ:</p>
          <ul>
            <li><strong>Thiết bị:</strong> ${deviceName || 'Không xác định'}</li>
            <li><strong>IP:</strong> ${ipAddress}</li>
            <li><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</li>
          </ul>
          <p style="color: #666;">
            Nếu đây không phải bạn, vui lòng đổi mật khẩu ngay lập tức.
          </p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();