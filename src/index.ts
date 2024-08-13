import "dotenv/config";
import "src/db"
import express, { ErrorRequestHandler } from "express";
import authRouter from "routes/auth";
import 'express-async-errors'
import formidable from "formidable";
import path from "path";
import productRouter from "./routes/product";

const app = express()
app.use(express.json());
app.use(express.static("src/public"))

app.use('/product',productRouter)
app.use("/auth",authRouter)

app.use(function(err,req,res,next){
    res.status(500).json({message:err.message})
} as express.ErrorRequestHandler)

 app.post('/upload-file',async(req,res)=>{
    const form = formidable({
        uploadDir:path.join(__dirname,'public'),
        filename(name,ext,part,form){
            return Date.now() + "_" + part.originalFilename
        }
    })
    await form.parse(req)
    res.send("ok")
 })

app.listen(8000,()=>{
    console.log("This app is running on localhost:8000")
})

//password: abcDEFG456