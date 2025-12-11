const express = require('express');
const wrapsync = require('../utils/wrapsysnc');
const router = express.Router();
const User = require('../models/user');
const passport = require('passport');

router.get('/signup',(req,res)=>{
    res.render('users/signup.ejs');
});

router.post('/signup',async(req,res)=>{
    try {
        console.log(req.body);
        const {username ,email , password} = req.body;
        const newuser = new User({username:username , email:email});
        console.log(newuser);
        
        const registeredUser = await User.register(newuser , password);
        console.log(registeredUser);
        
        const loguser = req.login(registeredUser , (err) =>{
            if(err){
                return next(err);
            }
             console.log("Login successful!");
            req.flash('success' , `welcome to the site ${username}`);
            return res.redirect('/home');
        })
        // req.flash('success' , `welcome to the site ${username}`);
        // return res.redirect('/home');
        
    } catch (error) {
        req.flash('error' , error.message);
        return res.redirect('/signup');
    }
    
})  

router.get('/login' , (req,res) =>{
    res.render('users/login.ejs')
});

router.post("/login" ,passport.authenticate('local',{failureRedirect: "/login" , failureFlash:true}),async(req,res)=>{
    req.flash("success" , "Your login completed Enjoy!");
    res.redirect('/home');
});

router.get('/logout' , (req,res) =>{
    req.logout((err) =>{
        if(err){
            return next(err);
        }
        req.flash('success' , 'logout successful');
        res.redirect('/login');
    })
    
});



module.exports = router;