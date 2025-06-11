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
  _id: Joi.string().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
});

const apiRouter = createMaggie({
  prefix: "/api/v1",
  models: [
    {
      model: Models.User,
      path: "user",
      validationSchema: UserValidationSchema,
      primaryKey: "email",
      middleWares: [],
    },
  ],
});

app.use(apiRouter);

export default app;
