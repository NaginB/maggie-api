import mongoose, { Document, Schema } from "mongoose";

// 1. Define a TypeScript interface for the User document
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  department: mongoose.Schema.Types.ObjectId;
}

// 2. Create the schema
const userSchema: Schema<IUser> = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
});

// 3. Create the model
const userModel = mongoose.model<IUser>("User", userSchema);

export default userModel;
