const prisma = require('../../../config/prismaClient');
const catchAsync = require('../../../helpers/catchAsync');
const {
  userSignUpService,
  userLoginService,
} = require("../services/auth.service");

const AuthController ={
    SignUp: catchAsync(async(req, res)=>{
        try{
            const createUser = await userSignUpService(req.body);
            return res.status(201).json({
                message: "User created successfully",
                data: createUser,
            });
        }catch(error){
        res.status(400).json({
          message: error.message,
        });
        }
    }),
    Login: catchAsync(async(req, res)=>{
        try{
            const loginUser = await userLoginService(req.body);
            return res.status(200).json({
                message: "User logged in successfully",
                data: loginUser,
            });
        }catch(error){
        res.status(400).json({
          message: error.message,
        });
        }
    }),
    profile: catchAsync(async(req, res)=>{
        try{
            const user = await prisma.userProfile.findUnique({
                where: { id: req.user.id },
            });
            return res.status(200).json({
                message: "User profile fetched successfully",
                data: user,
            });
        }catch(error){
        res.status(400).json({
          message: error.message,
        });
        }
    })
}

module.exports = AuthController