import categoryModel from "./category";
import departmentModel from "./department";
import itemModel from "./item";
import productModel from "./product";
import subCategoryModel from "./subcategory";
import userModel from "./User";

const Models = {
  User: userModel,
  Department: departmentModel,
  Category: categoryModel,
  SubCategory: subCategoryModel,
  Product: productModel,
  Item: itemModel,
};

export default Models;
