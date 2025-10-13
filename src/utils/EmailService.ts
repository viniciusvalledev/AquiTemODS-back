import nodemailer from "nodemailer";

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
    const confirmationUrl = `http://localhost:3000/confirmar-conta?token=${token}`; // AJUSTE A URL SE NECESSÁRIO
    const message = {
      from: `"Aqui Tem ODS" <${process.env.MAIL_USER}>`,
      to: to,
      subject: "Confirmação de Cadastro - Aqui Tem ODS",
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
    const resetUrl = `http://localhost:3000/redefinir-senha?token=${token}`; // AJUSTE A URL SE NECESSÁRIO
    const message = {
      from: `"Aqui Tem ODS" <${process.env.MAIL_USER}>`,
      to: to,
      subject: "Redefinição de Senha - Aqui Tem ODS",
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
    const confirmationUrl = `http://localhost:3000/confirmar-novo-email?token=${token}`; // AJUSTE A URL SE NECESSÁRIO
    const message = {
      from: `"Aqui Tem ODS" <${process.env.MAIL_USER}>`,
      to: to,
      subject: "Confirmação de Alteração de E-mail - Aqui Tem ODS",
      html: `Recebemos um pedido para alterar o e-mail da sua conta para este endereço.<br><br>
                   Por favor, clique no link abaixo para confirmar a alteração:<br>
                   <a href="${confirmationUrl}">${confirmationUrl}</a><br><br>
                   Se você não solicitou esta alteração, por favor ignore este e-mail.`,
    };
    await this.transporter.sendMail(message);
  }
}

export default new EmailService();