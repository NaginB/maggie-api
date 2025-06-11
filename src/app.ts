import express, { Request, Response } from "express";
import createMaggie from "./routes";
import Models from "./models";

const app = express();
app.use(express.json());

// @ts-ignore
app.get("/", (_req: Request, res: Response) => {
  return res.status(200).json({ message: "App is live 😗" });
});

const apiRouter = createMaggie({
  prefix: "/api/v1",
  models: [
    { model: Models.User, path: "user" },
    // { model: Product, path: "product" },
  ],
});

app.use(apiRouter);

export default app;
