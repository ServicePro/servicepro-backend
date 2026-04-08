import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import FacebookStrategy from "passport-facebook";
import LinkedInStrategy from "passport-linkedin-oauth2";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

// Serialize
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  User.findById(id).then(user => done(null, user));
});


// GOOGLE
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ googleId: profile.id });

  if (!user) {
    user = await User.create({
      name: profile.displayName,
      googleId: profile.id
    });
  }

  return done(null, user);
}));


// FACEBOOK
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "/api/auth/facebook/callback",
  profileFields: ["id", "displayName", "emails"]
},
async (accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ facebookId: profile.id });

  if (!user) {
    user = await User.create({
      name: profile.displayName,
      facebookId: profile.id
    });
  }

  return done(null, user);
}));


// LINKEDIN
passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  callbackURL: "/api/auth/linkedin/callback",
  scope: ["r_liteprofile", "r_emailaddress"]
},
async (accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ linkedinId: profile.id });

  if (!user) {
    user = await User.create({
      name: profile.displayName,
      linkedinId: profile.id
    });
  }

  return done(null, user);
}));