import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sequelize from "./config/database";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config();

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import avaliacaoRoutes from "./routes/avaliacao.routes";
import projetoRoutes from "./routes/projeto.routes";
import adminRoutes from "./routes/admin.routes";
import { authMiddleware } from "./middlewares/auth.middleware";

const app = express();
const uploadsPath = path.resolve(process.cwd(), "uploads");

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/uploads", express.static(uploadsPath));

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
app.use("/api/projetos", projetoRoutes);
app.use("/api/avaliacoes", avaliacaoRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/users", authMiddleware, userRoutes);
app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));

export default app;