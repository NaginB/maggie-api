import express, { Request, Response } from "express";
import createMaggie from "./routes";
import Models from "./models";
import Joi from "joi";

const app = express();
app.use(express.json());

// @ts-ignore
app.get("/", (_req: Request, res: Response) => {
  return res.status(200).json({ message: "App is live 😗" });
});

const UserValidationSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
});

const apiRouter = createMaggie({
  prefix: "/api/v1",

  models: [
    {
      model: Models.User,
      path: "user",
      validationSchema: UserValidationSchema,
    },
    // { model: Product, path: "product" },
  ],
});

app.use(apiRouter);

export default app;
