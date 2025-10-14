import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sequelize from "./config/database";

// É uma boa prática carregar as variáveis de ambiente o mais cedo possível
// Se você tem um .env.local, esta linha o carregará. Caso contrário, o dotenv.config() abaixo pegará o .env padrão.
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config();

// Rotas de usuário e MEI
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import avaliacaoRoutes from "./routes/avaliacao.routes";
import estabelecimentoRoutes from "./routes/estabelecimento.routes";
import fileRoutes from "./routes/file.routes";
import adminRoutes from "./routes/admin.routes";
import { authMiddleware } from "./middlewares/auth.middleware";

const app = express();
const uploadsPath = path.resolve(process.cwd(), "uploads");

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/uploads", express.static(uploadsPath));

// conecta ao banco com Sequelize
sequelize
  .authenticate()
  .then(() => {
    console.log("Conexão com o banco estabelecida com sucesso!");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((error: any) => {
    console.error("Erro ao conectar no banco:", error);
  });

app.use("/api/auth", authRoutes);
app.use("/api/estabelecimentos", estabelecimentoRoutes);
app.use("/api/avaliacoes", avaliacaoRoutes);
app.use("/api/files", fileRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/users", authMiddleware, userRoutes);
app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));

export default app;
