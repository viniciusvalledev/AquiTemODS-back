import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sequelize from "./config/database";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config();

// Rotas
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import avaliacaoRoutes from "./routes/avaliacao.routes";
import projetoRoutes from "./routes/projeto.routes"; // Alterado
import fileRoutes from "./routes/file.routes";
import adminRoutes from "./routes/admin.routes";
import { authMiddleware } from "./middlewares/auth.middleware";

const app = express();
const uploadsPath = path.resolve(process.cwd(), "uploads");

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/uploads", express.static(uploadsPath));

// Conecta ao banco com Sequelize
sequelize
  .authenticate()
  .then(() => {
    console.log("Conexão com o banco estabelecida com sucesso!");
  })
  .catch((error: any) => {
    console.error("Erro ao conectar no banco:", error);
  });

app.use("/api/auth", authRoutes);
app.use("/api/projetos", projetoRoutes); // Alterado
app.use("/api/avaliacoes", avaliacaoRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", authMiddleware, userRoutes);

export default app;