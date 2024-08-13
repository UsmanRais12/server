import { Response } from "express";

export const sendErrorResp = (res:Response, message :string, statuscode:number) =>{
    res.status(statuscode).json({message:message})
}