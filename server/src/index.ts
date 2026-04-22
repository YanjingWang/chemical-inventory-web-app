import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/api.js";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiRouter);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
