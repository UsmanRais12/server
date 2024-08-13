import { model, Schema, Document } from "mongoose";
import categories from "src/utils/categories";

// Define the TypeScript type for the productImage
type ProductImage = {
    url: string;
    id: string;
};

// Define the TypeScript interface for the ProductDocument
export interface ProductDocument extends Document {
    owner: Schema.Types.ObjectId;
    name: string;
    price: number;
    purchasingDate: Date;
    category: string;
    images?: ProductImage[];
    thumbnail?: string;
    description: string;
}

// Define a schema for product images
const productImageSchema = new Schema<ProductImage>({
    url: {
        type: String,
        required: true
    },
    id: {
        type: String,
        required: true
    }
});

// Define the main product schema
const schema = new Schema<ProductDocument>({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
    },
    category: {
        type: String,
        enum: categories,
        required: true,
    },
    purchasingDate: {
        type: Date,
        required: true
    },
    images: [productImageSchema], // Use the productImageSchema here
    thumbnail: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Create and export the model
const ProductModel = model<ProductDocument>('Product', schema);
export default ProductModel;
