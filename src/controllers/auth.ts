import { RequestHandler } from "express";
import UserModel from "src/models/user";
import crypto from 'crypto';
import AuthVerificationToken from "src/models/authVerificationToken";
import nodemailer from 'nodemailer';
import { sendErrorResp } from "src/utils/helper";
import jwt from 'jsonwebtoken'
import mail from "src/utils/mail";
import passResetTokenModel from "src/models/passwordResetToken";
import { isValidObjectId, Types } from 'mongoose'; 
import cloudUploader from "src/cloud";
const JWT_SECRET = process.env.JWT_SECRET!
const PASSWORD_RESET_LINK = process.env.PASSWORD_RESET_LINK

export const createNewUser: RequestHandler = async (req, res , next) => {
    
    try {
        const { name, email, password } = req.body;
        
        if (!name) return sendErrorResp(res, "Name is missing", 422);
        if (!email) return sendErrorResp(res, "Email is missing", 422);
        if (!password) return sendErrorResp(res, "Password is missing", 422);

        const existingUser = await UserModel.findOne({ email });
        if (existingUser) return sendErrorResp(res, "Unauthorized Request! Email account already registered", 401);

        const user = await UserModel.create({ name, email, password });

        const token = crypto.randomBytes(36).toString('hex');
        await AuthVerificationToken.create({ owner: user._id, token });

        const link = `${process.env.VERIFICATION_LINK}?id=${user._id}&token=${token}`;
        await mail.sendVerification(user.email,link)
        res.json({ message: 'Please check your email' });
    } catch (error) {
        next(error)
    }
};
export const verifyEmail: RequestHandler = async (req,res)=>{
    const {token, id} = req.body
    const authToken = await AuthVerificationToken.findOne({owner:id})
    if (!authToken) return sendErrorResp(res, "Unauthorized access",403)
   const isMatched =  authToken.compareToken(token)
    if (!isMatched) return sendErrorResp(res, "Unauthorized access,Invalid Token",403)
    await UserModel.findByIdAndUpdate(id,{verified:true})
    await AuthVerificationToken.findByIdAndDelete(authToken._id)
    res.json({message:"Thanks for joining us your email is verified"})
}
export const signIn : RequestHandler = async (req,res)=>{
    const {email,password} = req.body
    const user = await UserModel.findOne({email})
    if(!user) return sendErrorResp(res, "Account not registered with this email", 403)
      const isMatched =   await user.comparePassword(password)
    if(!isMatched) return sendErrorResp(res, "Password is incorrect", 403)
    
    const payload = {id:user._id}
    const accessToken = jwt.sign(payload,JWT_SECRET,{
        expiresIn:"15m"
    })
    const refreshToken = jwt.sign(payload,JWT_SECRET)
    if(!user.tokens)  user.tokens = [refreshToken];
    else user.tokens.push(refreshToken)
    await user.save();

    res.json({
        profile:{
            id:user._id,
            email:user.email,
            name: user.name,
            verified: user.verified
        },
        tokens:{refresh:refreshToken,access:accessToken}
    })

}
export const sendProfile: RequestHandler = (req,res)=>{
res.json({
    profile: req.user,
})
}

export const generateVerificationLink: RequestHandler = async (req,res)=>{
    const { id} = req.user
    const token = crypto.randomBytes(36).toString("hex")
    const link = `${process.env.VERIFICATION_LINK}?id=${id}&token=${token}`;

    await AuthVerificationToken.findOneAndDelete({owner: id});

    await AuthVerificationToken.create({owner: id , token})

    await mail.sendVerification(req.user.email , link)
    res.json({message: 'Please check your inbox'})
}
export const grantAccessToken : RequestHandler = async(req,res) => {
const {refreshToken} = req.body
if (!refreshToken) return sendErrorResp(res,"Unauthorized access",403)
    const payload = jwt.verify(refreshToken,JWT_SECRET) as {id:string}
   if(payload.id){
    const user = await UserModel.findOne({
        _id: payload.id,
        tokens: refreshToken,
    })
    if(!user){
        await UserModel.findByIdAndUpdate(payload.id,{tokens:[]} )
        return sendErrorResp(res,"Unauthorized access",401)
    }

    const newaccessToken = jwt.sign({id: user._id} ,JWT_SECRET,{
        expiresIn:"15m"
    })
    const newrefreshToken = jwt.sign({id: user._id},JWT_SECRET)
    const filteredTokens = user.tokens.filter((t)=> t !== refreshToken )
    user.tokens = filteredTokens;
    user.tokens.push(newrefreshToken)
    await user.save()
    res.json({
        tokens:{refresh: newrefreshToken , access: newaccessToken}
    })
   }else{
    return sendErrorResp(res,"Unauthorized access", 401)
   }

}
export const signOut: RequestHandler = async (req,res) => {
    const {refreshToken }= req.body
    const user = await UserModel.findOne({_id:req.user.id , tokens: refreshToken})
    if(!user) return sendErrorResp(res,"Unauthorized request , User not found",403)
  const newTokens =  user.tokens.filter(t => t !== refreshToken)
user.tokens = newTokens
await user.save()
res.send
}

export const generateForgetPasslink: RequestHandler = async(req,res) =>{
    const {email} = req.body;
  const user =  await UserModel.findOne({email})
  if(!user) return sendErrorResp(res,"User not Found",404)
    await passResetTokenModel.findOneAndDelete({owner:user._id})
  const token = crypto.randomBytes(36).toString('hex');
  await passResetTokenModel.create({owner:user._id,token})
  const passResetLink = `${PASSWORD_RESET_LINK}?id=${user._id}&token=${token}`
  await mail.sendPasswordResetLink(user.email,passResetLink)
  res.json({message: "Please check your email for password reset link."})
}

export const grantValid: RequestHandler = async(req,res)=>{
    res.json({valid:true})
}
export const updatePassword: RequestHandler = async (req, res) => {
    const { id, password } = req.body;
  
    try {
      // Find the user by ID
      const user = await UserModel.findById(id);
  
      // Check if user exists
      if (!user) {
        return sendErrorResp(res, "Unauthorized Request, User not found", 403);
      }
  
      // Check if the new password is the same as the old password
      const isSamePassword = await user.comparePassword(password);
      if (isSamePassword) {
        return sendErrorResp(res, "New password cannot be the same as the old password.", 422);
      }
  
      // Update the user's password
      user.password = password;
      await user.save();
  
      // Delete any existing password reset tokens for the user
      await passResetTokenModel.findOneAndDelete({ owner: user._id });
  
      // Send password update notification email
      await mail.sendPasswordUpdateMessage(user.email);
  
      // Respond with success message
      res.json({ message: "Password reset successfully." });
    } catch (error) {
      console.error("Error updating password:", error);
      sendErrorResp(res, "Failed to update password. Please try again later.", 500);
    }
  };

export const updateProfile : RequestHandler = async(req,res)=>{
    const {name} = req.body
    if (typeof name !== 'string' || name.trim().length < 3 ){
        return sendErrorResp(res,'Invalid Name',422)
    }
    await UserModel.findByIdAndUpdate(req.user.id,{name})
    res.json({profile:{...req.user,name}})

}
export const updateAvatar : RequestHandler = async (req,res) =>{
const {avatar} = req.files
if(Array.isArray(avatar)){
    return sendErrorResp(res,'Multiples files are not allowed',422)
}
if(!avatar.mimetype?.startsWith("image")){
    return sendErrorResp(res,'Invalid Image file',422)
}
const user = await UserModel.findById(req.user.id);
if(!user){
    return sendErrorResp(res,"User not found",404)
}
if(user.avatar?.id){
 await cloudUploader.destroy(user.avatar.id)
}
const {secure_url: url, public_id:id} = await cloudUploader.upload(avatar.filepath,{
    width:300,
    height:300,
    crop:'thumb',
    gravity:'face'
})
user.avatar= {url,id}
user.save()
res.json({profile:{...req.user,avatar:user.avatar.url}})
}
export const sendPublicProfile: RequestHandler = async(req,res) =>{
    const profileId = req.params.id
    if(!isValidObjectId(profileId)){
        return sendErrorResp(res,"Invalid profile id",422)
    }
    const user = await UserModel.findById(profileId)
    if(!user){
        return sendErrorResp(res,"Profile not found",422)
    }
    res.json({profile:{id:user._id,name:user.name,avatar:user.avatar?.url}})
}