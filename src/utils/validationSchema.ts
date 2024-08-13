import { isValidObjectId } from 'mongoose';
import * as yup from 'yup';
import categories from './categories';
import { parseISO } from 'date-fns';

const myEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
const passwordRegex = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[*.!@$%^&(){}[\]:;<>,.?/~_+\-=|\\]).{8,32}$/;



yup.addMethod(yup.string, 'email', function validateEmail(message) {
  return this.matches(myEmailRegex, {
    message,
    name: 'email',
    excludeEmptyString: true,
  });
});
const password = {
  password: yup.string().required("Password is missing").min(8,"Password should be atleast 8 charachters long").matches(passwordRegex,"Password is too simple.")
}
export const newUserSchema = yup.object({
  name: yup.string().required("Name is missing"),
  email: yup.string().email("Invalid Email").required("Email is missing"),
 ...password
});
const tokenandId = {
  id: yup.string().test({
    name:"valid-id",
    message:"Invalid user id",
    test:(value)=>{
      return isValidObjectId(value)
    }
  }),
  token: yup.string().required("Token is missing"),
}
export const verifyTokenSchema = yup.object({
 ...tokenandId
});


export const resetPassSchema = yup.object({
  ...tokenandId,
  ...password
})
export const newProductSchema = yup.object({
  name:yup.string().required("Name is missing"),
  description: yup.string().required("Description is missing"),
  category: yup.string().oneOf(categories,"Invalid category").required("Category is missing"),
  price: yup.string().transform((value)=>{
    if(isNaN(+value)) return ''
    return +value
  }).required("Price is missing"),
  purchasingDate: yup.string().transform((value)=>{
    try{
      return parseISO(value)
    }catch(error){
      return '';
    }

  }).required("Purchasing Date is missing")
})