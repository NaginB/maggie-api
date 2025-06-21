import { RequestHandler } from "express";
import Joi from "joi";
import { Model } from "mongoose";

export interface ControllerSettings {
  getKeys: string[];
  getByIdKeys: string[];
  primaryKey?: string;
}

export interface PopulateField {
  path: string;
  select?: string[];
  populate?: PopulateField[];
}

interface APISettings {
  get?: {
    populate?: PopulateField[];
    keys?: string[];
  };
  getById?: {
    populate?: PopulateField[];
    keys?: string[];
  };
}

interface MaggieModelPayload {
  model: Model<any>;
  path: string;
  validationSchema?: Joi.ObjectSchema;
  primaryKey?: string;
  middleWares?: RequestHandler[];
  settings?: APISettings;
  /**
   * @deprecated Use settings.getById.keys instead
   */
  getByIdKeys?: string[];

  /**
   * @deprecated Use settings.get.keys instead
   */
  getKeys?: string[];
}

export interface MaggiePayload {
  prefix: string;
  models: MaggieModelPayload[];
}

// update this interface
export interface ISetting extends APISettings {
  getByIdKeys: string[];
  getKeys: string[];
  primaryKey?: string;
}
