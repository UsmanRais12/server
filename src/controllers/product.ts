import { UploadApiResponse } from "cloudinary";
import { RequestHandler } from "express";
import { truncate } from "fs/promises";
import { isValidObjectId } from "mongoose";
import cloudUploader, { cloudApi } from "src/cloud";
import ProductModel from "src/models/product";
import { UserDocument } from "src/models/user";
import categories from "src/utils/categories";
import { sendErrorResp } from "src/utils/helper";

// Utility function to upload image
const uploadImage = (filePath: string): Promise<UploadApiResponse> => {
  return cloudUploader.upload(filePath, {
    width: 1280,
    height: 720,
    crop: "fill",
  });
};

// Utility function to validate image files
const validateImages = (images: any[]): boolean => {
  if (!images) return false;
  return images.every((img) => img.mimetype?.startsWith("image"));
};

// Handler to list new product
export const listNewProduct: RequestHandler = async (req, res) => {
  const { name, price, category, description, purchasingDate } = req.body;
  const { images } = req.files || {};

  if (!name || !price || !category || !description || !purchasingDate) {
    return sendErrorResp(res, "All fields are required.", 400);
  }

  const newProduct = new ProductModel({
    owner: req.user.id,
    name,
    price,
    category,
    description,
    purchasingDate,
  });

  if (images && Array.isArray(images) && images.length > 5) {
    return sendErrorResp(res, "Image files cannot be more than 5!", 422);
  }

  if (!validateImages(images)) {
    return sendErrorResp(res, "Invalid file type, files must be image type!", 422);
  }

  try {
    if (Array.isArray(images)) {
      const uploadPromises = images.map((file) => uploadImage(file.filepath));
      const uploadResults = await Promise.all(uploadPromises);
      newProduct.images = uploadResults.map(({ secure_url, public_id }) => ({ url: secure_url, id: public_id }));
      newProduct.thumbnail = newProduct.images[0].url;
    } else if (images) {
      const { secure_url, public_id } = await uploadImage(images.filepath);
      newProduct.images = [{ url: secure_url, id: public_id }];
      newProduct.thumbnail = secure_url;
    }
  } catch (error) {
    console.error("Error uploading images:", error);
    return sendErrorResp(res, "Error uploading images.", 500);
  }

  try {
    await newProduct.save();
    res.status(201).json({ message: "Added new product!" });
  } catch (error) {
    console.error("Error saving product:", error);
    return sendErrorResp(res, "Error saving product.", 500);
  }
};

// Handler to update product
export const updateProduct: RequestHandler = async (req, res) => {
  const productId = req.params.id;
  if (!isValidObjectId(productId)) {
    return sendErrorResp(res, "Product ID not valid", 422);
  }

  const { name, price, category, description, purchasingDate, thumbnail } = req.body;
  const { images } = req.files || {};

  try {
    const product = await ProductModel.findOne({ _id: productId, owner: req.user.id });
    if (!product) {
      return sendErrorResp(res, 'Product not found', 404);
    }

    const existingImageCount = product.images?.length || 0;
    const isMultipleImages = Array.isArray(images);

    if (isMultipleImages && existingImageCount + images.length > 5) {
      return sendErrorResp(res, "Image files cannot be more than 5!", 422);
    }

    if (isMultipleImages || images) {
      if (!validateImages(images)) {
        return sendErrorResp(res, "Invalid file type, files must be image type!", 422);
      }

      try {
        if (isMultipleImages) {
          const uploadPromises = images.map((file) => uploadImage(file.filepath));
          const uploadResults = await Promise.all(uploadPromises);
          const newImages = uploadResults.map(({ secure_url, public_id }) => ({ url: secure_url, id: public_id }));
          product.images?.push(...newImages);
        } else {
          const { secure_url, public_id } = await uploadImage(images.filepath);
          product.images?.push({ url: secure_url, id: public_id });
        }
      } catch (error) {
        console.error("Error uploading images:", error);
        return sendErrorResp(res, "Error uploading images.", 500);
      }
    }

    // Update product details
    product.name = name || product.name;
    product.price = price || product.price;
    product.category = category || product.category;
    product.description = description || product.description;
    product.purchasingDate = purchasingDate || product.purchasingDate;
    product.thumbnail = thumbnail || product.thumbnail;

    await product.save();
    res.status(200).json({ message: "Product updated successfully" });

  } catch (error) {
    console.error("Error updating product:", error);
    return sendErrorResp(res, "Error updating product.", 500);
  }
};

export const deleteProduct : RequestHandler = async(req,res) =>{
  const productId = req.params.id
  if(isValidObjectId(productId)){
   const product =  await ProductModel.findOneAndDelete({_id: productId, owner:req.user.id});
   res.json({message:"Product removed successfully."})
   if(!product){
    return sendErrorResp(res,'Product not found',404)
   }
   const images = product.images
   if(images?.length){
    const ids  = images?.map(({id})=> id)
    await cloudApi.delete_resources(ids)
   }


  }else{
    return sendErrorResp(res,"Product id not valid",422)
  }
}

export const deleteProductImage : RequestHandler = async(req,res) =>{
  const {productId,imageId} = req.params
  if(!isValidObjectId(productId))
    return sendErrorResp(res,"Invalid product Id",422)
 const product =  await ProductModel.findOneAndUpdate({_id:productId,owner:req.user.id},{
    $pull:{
      images: {id:imageId}
    }
  },{new:true})

  if(!product) return sendErrorResp(res,"Product not found",404)

  if(product.thumbnail?.includes(imageId)){
    const images = product.images
    if(images)
    product.thumbnail = images[0].url
  else product.thumbnail = "";
  await product.save()
  }
  await cloudUploader.destroy(imageId)

  res.json({message:"Image removed successfully."})
}

export const getProductDetails: RequestHandler = async(req,res) =>{
  const {id} = req.params;
  if(!isValidObjectId(id))
    return sendErrorResp(res,"Invalid product Id",422)
  const product = await ProductModel.findById(id).populate<{owner:UserDocument}>('owner');
  if(!product) return sendErrorResp(res,'Product not found',404)
    res.json({product:{
    id:product._id,
    description: product.description,
    thumbnail: product.thumbnail,
    category: product.category,
    date: product.purchasingDate,
    price: product.price,
    images: product.images?.map(({url})=>{url}),
    seller:{
      id: product.owner._id,
      name:product.owner.name,
      avatar:product.owner.avatar?.url
    }
    }})
    

}
export const getProductsByCategory: RequestHandler = async(req,res) =>{
  const {category} = req.params
  const {page ="1",pageSize="10"} = req.query as {page:string, pageSize:string}
  if(! categories.includes(category)) return sendErrorResp(res,"Invalid category",422)
  const products = await ProductModel.find({category}).skip((+page - 1) * +pageSize).limit(+pageSize)
  const listings =  products.map(p=>{
    return{
      id:p._id,
      name:p.name,
      thumbnail: p.thumbnail,
      category:p.category,
      price:p.price
    }
  })
  res.json({products: listings})
}
export const getLatestProducts : RequestHandler = async (req,res) =>{
  const products = await ProductModel.find().sort('-createdAt').limit(10)
  const listings =  products.map(p=>{
    return{
      id:p._id,
      name:p.name,
      thumbnail: p.thumbnail,
      category:p.category,
      price:p.price
    }
  })
  res.json({products: listings})
}
export const getlistings: RequestHandler = async(req,res) =>{

  const {page ="1",pageSize="10"} = req.query as {page:string, pageSize:string}
  const products = await ProductModel.find({owner: req.user.id}).skip((+page - 1) * +pageSize).limit(+pageSize)
  const listings =  products.map(p=>{
    return{
      id:p._id,
      name:p.name,
      thumbnail: p.thumbnail,
      category:p.category,
      price:p.price,
      images : p.images?.map(i=>i.url),
      date:p.purchasingDate,
      description: p.description,
      seller:{
        id:req.user.id,
        name:req.user.name,
        avatar:req.user.avatar?.url
      }
    }
  })
  res.json({products: listings})
}