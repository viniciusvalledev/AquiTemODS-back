// src/utils/FileStorageService.ts
import fs from "fs/promises"; // Usamos a versão de promessas do 'fs'
import path from "path";
import { v4 as uuidv4 } from "uuid";

// O caminho para a pasta de uploads, a partir da raiz do projeto
const UPLOADS_DIR = path.resolve(__dirname, "..", "..", "uploads");

class FileStorageService {
  /**
   * Garante que a pasta de uploads exista.
   */
  private async ensureUploadsDirExists(): Promise<void> {
    try {
      await fs.access(UPLOADS_DIR);
    } catch (error) {
      // Se a pasta não existe, cria-a
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
  }

  /**
   *
   * @param
   * @returns
   */
  public async saveBase64(base64String: string): Promise<string | null> {
    if (!base64String || base64String.trim() === "") {
      return null;
    }

    await this.ensureUploadsDirExists();

    // Extrai o tipo de imagem e os dados
    const matches = base64String.match(
      /^data:(image\/([a-zA-Z]+));base64,(.+)$/
    );
    if (!matches || matches.length !== 4) {
      throw new Error("Formato de string Base64 inválido.");
    }

    const extension = matches[2];
    const imageBuffer = Buffer.from(matches[3], "base64");
    const uniqueFilename = `${uuidv4()}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, uniqueFilename);

    await fs.writeFile(filePath, imageBuffer);

    // Retorna o caminho público que será usado na API
    return `/images/${uniqueFilename}`;
  }

  /**
   * Salva um ficheiro enviado via formulário (multipart/form-data).
   * @param file O objeto do ficheiro (geralmente do Multer).
   * @returns O URL público do ficheiro salvo.
   */
  public async save(file: Express.Multer.File): Promise<string> {
    await this.ensureUploadsDirExists();

    // O Multer já salva o ficheiro temporariamente, aqui só renomeamos e movemos se necessário
    // Neste exemplo, assumimos que o Multer já salvou na pasta `uploads` com um nome único.
    // O trabalho principal será feito na configuração do Multer.
    const fileUrl = `/images/${file.filename}`;
    return fileUrl;
  }
}

export default new FileStorageService();
