import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOADS_DIR = path.resolve(__dirname, "..", "..", "uploads");

class FileStorageService {
  private async ensureUploadsDirExists(): Promise<void> {
    try {
      await fs.access(UPLOADS_DIR);
    } catch (error) {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
  }

  public async saveBase64(base64String: string): Promise<string | null> {
    if (!base64String || base64String.trim() === "") {
      return null;
    }

    await this.ensureUploadsDirExists();

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

    return `/uploads/${uniqueFilename}`; // Alterado para /uploads
  }

  public async save(file: Express.Multer.File): Promise<string> {
    await this.ensureUploadsDirExists();
    const fileUrl = `/uploads/${file.filename}`; // Alterado para /uploads
    return fileUrl;
  }
}

export default new FileStorageService();