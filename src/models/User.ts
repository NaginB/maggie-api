import mongoose, { Document, Schema } from "mongoose";

// 1. Define a TypeScript interface for the User document
export interface IUser extends Document {
  firstName: string;
  lastName: string;
}

// 2. Create the schema
const userSchema: Schema<IUser> = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
});

// 3. Create the model
const userModel = mongoose.model<IUser>("User", userSchema);

export default userModel;
