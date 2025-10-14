import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  public async sendConfirmationEmail(to: string, token: string): Promise<void> {
    const confirmationUrl = `http://172.16.32.199:3000/confirmar-conta?token=${token}`;
    const message = {
      from: `"Meidesaqua" <${process.env.MAIL_USER}>`,
      to: to,
      subject: "Confirmação de Cadastro - Meidesaqua",
      html: `Obrigado por se cadastrar! Por favor, clique no link abaixo para ativar sua conta:<br><br>
                   <a href="${confirmationUrl}">${confirmationUrl}</a><br><br>
                   Se você não se cadastrou em nosso site, por favor ignore este e-mail.`,
    };
    await this.transporter.sendMail(message);
  }

  public async sendPasswordResetEmail(
    to: string,
    token: string
  ): Promise<void> {
    const resetUrl = `http://172.16.32.199:3000/redefinir-senha?token=${token}`;
    const message = {
      from: `"Meidesaqua" <${process.env.MAIL_USER}>`,
      to: to,
      subject: "Redefinição de Senha - Meidesaqua",
      html: `Recebemos um pedido para redefinir a senha da sua conta.<br><br>
                   Por favor, clique no link abaixo para criar uma nova senha:<br>
                   <a href="${resetUrl}">${resetUrl}</a><br><br>
                   Se você não solicitou esta alteração, por favor ignore este e-mail.`,
    };
    await this.transporter.sendMail(message);
  }

  public async sendEmailChangeConfirmationEmail(
    to: string,
    token: string
  ): Promise<void> {
    const confirmationUrl = `http://172.16.32.199:3000/confirmar-novo-email?token=${token}`;
    const message = {
      from: `"Meidesaqua" <${process.env.MAIL_USER}>`,
      to: to,
      subject: "Confirmação de Alteração de E-mail - Meidesaqua",
      html: `Recebemos um pedido para alterar o e-mail da sua conta para este endereço.<br><br>
                   Por favor, clique no link abaixo para confirmar a alteração:<br>
                   <a href="${confirmationUrl}">${confirmationUrl}</a><br><br>
                   Se você não solicitou esta alteração, por favor ignore este e-mail.`,
    };
    await this.transporter.sendMail(message);
  }

  public async sendGenericEmail(options: EmailOptions): Promise<void> {
    const message = {
      from: `"MeideSaquá" <${process.env.MAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };
    await this.transporter.sendMail(message);
  }
}

export default new EmailService();
