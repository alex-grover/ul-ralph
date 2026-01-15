import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: "Ultralight Gear Tracker <noreply@ultralightgear.app>",
      to: email,
      subject: "Reset your password",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Reset your password</h1>

  <p style="margin-bottom: 16px;">You requested a password reset for your Ultralight Gear Tracker account.</p>

  <p style="margin-bottom: 24px;">Click the button below to reset your password. This link will expire in 1 hour.</p>

  <a href="${resetUrl}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a>

  <p style="margin-top: 24px; color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:</p>
  <p style="color: #999; font-size: 12px; word-break: break-all;">${resetUrl}</p>
</body>
</html>
      `,
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
