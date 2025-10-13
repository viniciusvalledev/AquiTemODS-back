import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { Usuario, Avaliacao } from "../entities";
import ProfanityFilter from "../utils/ProfanityFilter";
import EmailService from "../utils/EmailService";
import {
  IUpdatePasswordRequest,
  IUpdateProfileRequest,
} from "../interfaces/request";
import { containsEmoji } from "../utils/ValidationEmoji";

class AuthService {
  public async cadastrarUsuario(dadosUsuario: any) {
    if (ProfanityFilter.contemPalavrao(dadosUsuario.username)) {
      throw new Error(
        "Você utilizou palavras inapropriadas no nome de usuário."
      );
    }
    if (containsEmoji(dadosUsuario.username)) {
      throw new Error("O nome de usuário não pode conter emojis.");
    }
    
    const usernameExistente = await Usuario.findOne({
      where: { username: dadosUsuario.username, enabled: true },
    });
    if (usernameExistente) {
      throw new Error("Usuário já cadastrado, use outro e tente novamente.");
    }

    const emailExistente = await Usuario.findOne({
      where: { email: dadosUsuario.email },
    });
    if (emailExistente) {
      if (emailExistente.enabled) {
        throw new Error("Email já cadastrado, use outro e tente novamente.");
      }
      // Se o usuário existe mas não está habilitado, permite uma nova tentativa de cadastro deletando o antigo.
      await emailExistente.destroy();
    }

    const senhaCriptografada = await bcrypt.hash(dadosUsuario.password, 10);
    const tokenConfirmacao = uuidv4();

    const novoUsuario = await Usuario.create({
      nomeCompleto: dadosUsuario.nomeCompleto,
      username: dadosUsuario.username,
      email: dadosUsuario.email,
      password: senhaCriptografada,
      confirmationToken: tokenConfirmacao,
      enabled: false,
    });

    await EmailService.sendConfirmationEmail(
      novoUsuario.email,
      tokenConfirmacao
    );

    const { password, ...dadosSeguros } = novoUsuario.get({ plain: true });
    return dadosSeguros;
  }

  public async login(username: string, pass: string) {
    const usuario = await Usuario.findOne({
      where: {
        [Op.or]: [{ username: username }, { email: username }],
      },
    });

    if (!usuario) {
      throw new Error("Usuário ou senha inválidos");
    }

    if (!usuario.enabled) {
      throw new Error(
        "Sua conta ainda não foi verificada. Por favor, verifique seu e-mail."
      );
    }

    const isMatch = await bcrypt.compare(pass, usuario.password);
    if (!isMatch) {
      throw new Error("Usuário ou senha inválidos");
    }

    const token = jwt.sign(
      { id: usuario.usuarioId, username: usuario.username },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "8h" } // Aumentado o tempo de expiração
    );

    const { password, ...dadosSeguros } = usuario.get({ plain: true });
    return { user: dadosSeguros, token };
  }

  public async confirmUserAccount(token: string) {
    const usuario = await Usuario.findOne({
      where: { confirmationToken: token },
    });

    if (!usuario) {
      throw new Error("Token de confirmação inválido ou não encontrado.");
    }

    usuario.enabled = true;
    usuario.confirmationToken = null;
    await usuario.save();
  }

  public async confirmEmailChange(token: string) {
    const usuario = await Usuario.findOne({
      where: { emailChangeToken: token },
    });

    if (!usuario || !usuario.unconfirmedEmail) {
      throw new Error(
        "Token de alteração de e-mail inválido ou não encontrado."
      );
    }

    usuario.email = usuario.unconfirmedEmail;
    usuario.unconfirmedEmail = null;
    usuario.emailChangeToken = null;
    await usuario.save();
  }

  public async forgotPassword(email: string) {
    const usuario = await Usuario.findOne({ where: { email } });

    if (usuario) {
      const token = uuidv4();
      usuario.resetPasswordToken = token;
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1); // Token expira em 1 hora
      usuario.resetPasswordTokenExpiry = expiryDate;

      await usuario.save();
      await EmailService.sendPasswordResetEmail(usuario.email, token);
    }
  }

  public async resetPassword(token: string, newPassword: string) {
    const usuario = await Usuario.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordTokenExpiry: {
          [Op.gt]: new Date(), // Verifica se o token não expirou
        },
      },
    });

    if (!usuario) {
      throw new Error("Token de redefinição de senha inválido ou expirado.");
    }

    usuario.password = await bcrypt.hash(newPassword, 10);
    usuario.resetPasswordToken = null;
    usuario.resetPasswordTokenExpiry = null;
    await usuario.save();
  }

  public async updateUserProfile(userId: number, data: IUpdateProfileRequest) {
    const usuario = await Usuario.findOne({ where: { usuarioId: userId } });
    if (!usuario) throw new Error("Usuário não encontrado.");

    if (data.nomeCompleto) {
      usuario.nomeCompleto = data.nomeCompleto;
    }

    if (data.username && data.username !== usuario.username) {
      if (ProfanityFilter.contemPalavrao(data.username)) {
        throw new Error("Você utilizou palavras inapropriadas.");
      }
      const usernameExists = await Usuario.findOne({
        where: { username: data.username },
      });
      if (usernameExists)
        throw new Error("O novo nome de usuário já está em uso.");
      usuario.username = data.username;
    }

    if (data.email && data.email.toLowerCase() !== usuario.email) {
      const emailExists = await Usuario.findOne({
        where: { email: data.email },
      });
      if (emailExists)
        throw new Error("O novo e-mail já está em uso por outra conta.");

      const token = uuidv4();
      usuario.unconfirmedEmail = data.email;
      usuario.emailChangeToken = token;

      await EmailService.sendEmailChangeConfirmationEmail(data.email, token);
    }

    return await usuario.save();
  }

  public async updateUserPassword(
    userId: number,
    request: IUpdatePasswordRequest
  ) {
    const usuario = await Usuario.findOne({ where: { usuarioId: userId } });
    if (!usuario) throw new Error("Usuário não encontrado.");

    const isMatch = await bcrypt.compare(
      request.currentPassword,
      usuario.password
    );
    if (!isMatch) {
      throw new Error("A senha atual está incorreta.");
    }

    usuario.password = await bcrypt.hash(request.newPassword, 10);
    await usuario.save();
  }

  public async deleteUser(userId: number) {
    const usuario = await Usuario.findOne({ where: { usuarioId: userId } });
    if (!usuario) throw new Error("Usuário não encontrado.");

    // Desvincula as avaliações em vez de deletar
    await Avaliacao.update({ usuarioId: null }, { where: { usuarioId: usuario.usuarioId } });

    await usuario.destroy();
  }
}

export default new AuthService();