import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export const compressImages = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.files) {
        return next();
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    try {
        const processingPromises: Promise<void>[] = [];

        for (const field in files) {
            for (const file of files[field]) {
                // Verifica se o mimetype do arquivo é de uma imagem suportada pelo sharp
                const isImage = file.mimetype.startsWith('image/');

                // Apenas executa a compressão se o arquivo for uma imagem
                if (isImage) {
                    const originalPath = file.path;
                    const newFilename = `${path.basename(file.filename, path.extname(file.filename))}.webp`;
                    const outputPath = path.join(path.dirname(originalPath), newFilename);

                    // Log para depuração
                    console.log(`Comprimindo imagem: ${originalPath} -> ${outputPath}`);

                    const promise = sharp(originalPath)
                        .webp({ quality: 80 })
                        .toFile(outputPath)
                        .then(async () => {
                            // Deleta o arquivo original após a compressão
                            await fs.unlink(originalPath);
                            
                            // Atualiza as informações do arquivo na requisição
                            file.path = outputPath;
                            file.filename = newFilename;
                            file.mimetype = 'image/webp'; // Também é bom atualizar o mimetype
                        });
                    
                    processingPromises.push(promise);
                } else {
                    // Se não for uma imagem (ex: PDF), apenas informa no console e continua.
                    // O arquivo já foi salvo pelo multer, então não precisamos fazer nada aqui.
                    console.log(`Arquivo não é uma imagem, pulando compressão: ${file.filename}`);
                }
            }
        }

        await Promise.all(processingPromises);
        next();
    } catch (error) {
        console.error("Erro ao processar arquivos:", error);
        next(error);
    }
};