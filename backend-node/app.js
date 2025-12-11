require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const ejsMate = require('ejs-mate');
const app = express();
const singleRouteRouter = require('./routes/singleroute');
const resultrouteRouter = require('./routes/resultroute');
const chargerouteRouter = require('./routes/chargeroute');
const weatherRouter = require('./routes/weather');
const ExpressError = require('./utils/ExpressError');
const wrapAsync = require('./utils/wrapsysnc');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require("./models/user");
const userRoutes = require("./routes/userRoute");

app.use(express.static(path.join(__dirname, "public")));
app.set("views",path.join(__dirname, "views"));
app.set("view engine" , "ejs");
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.engine('ejs', ejsMate);


mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/routeopt', {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(()=>console.log('Mongo connected')).catch(e=>console.log('Mongo error',e));


const sessionOptions={
  secret:"secretcode",
  resave:false,
  saveUninitialized:true,
  cookie:{
    expires:Date.now() + 7*24*60*60*1000,
    maxAge:7*24*60*60*1000,
    httpOnly:true,
  }
}

app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
//passport.use(new LocalStrategy({ usernameField: 'email' }, User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next) =>{
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currUser = req.user;
  next();
})
app.get('/',(req, res) =>{
  res.redirect('/login');
})

app.get("/home", (req, res) => {
  res.render("index.ejs", { route: null });  // FIXED
});

app.use('/', singleRouteRouter);
app.use('/optimal',resultrouteRouter);
app.use('/',userRoutes);
app.use('/charging',chargerouteRouter);
app.use('/weather',weatherRouter);
// app.use('/api', routeRouter);

app.all(/.*/, (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

app.use((err,req,res,next) =>{
    let {status=500, message="bahut gatiya error"} = err;
    res.status(status).send(message);
    //res.send("revolved validation error");
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server listening on http://localhost:${PORT}`));
