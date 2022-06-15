import express from "express";
import { MongoClient } from "mongodb";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import validator from "validator";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT;
const MONGO_URL = process.env.MONGO_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

app.use(express.json());

const connectToDB = async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log("Connected to DB");
  return client;
};

const client = await connectToDB();

const sendMail = async (email, token) => {
  try {
    const accessToken = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.USER_NAME,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken,
      },
    });

    const mailOptions = {
      from: process.env.USER_NAME,
      to: email,
      subject: "Reset Password link for signUp App",
      text:
        "Hello Testing Google Api for Second time\n" +
        "https://incandescent-torte-042425.netlify.app" +
        token,
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (error) {
    return error;
  }
};

app.get("/", (req, res) => {
  res.send("Welcome to Password Reset app");
});

app.post("/forgotPassword", async function (req, res) {
  let { email } = req.body;
  let token = Math.floor(Math.random() * Math.pow(10, 10));
  const postCheck = await client
    .db("forgotPassword")
    .collection("user")
    .findOne({ email: email });
  let data = "";
  if (postCheck) {
    const postUpdate = await client
      .db("forgotPassword")
      .collection("user")
      .updateOne({ email: email }, { $set: { token: token } });
    data = await sendMail(email, token);
  }

  res.send(data);
});

app.post("/signup", async function (req, res) {
  let data = req.body;
  if (validator.isEmail(data.email)) {
    const postCheck = await client
      .db("forgotPassword")
      .collection("user")
      .findOne({ email: data.email, username: data.username });
    if (!postCheck) {
      const postInsert = await client
        .db("forgotPassword")
        .collection("user")
        .insertOne(data);
      res.send(postInsert);
    } else {
      res.status(400).send({ errorMsg: "User already exists" });
    }
  } else {
    res.status(400).send({ errorMsg: "Invalid Email" });
  }
});

app.post("/login", async function (req, res) {
  let data = req.body;
  const postCheck = await client
    .db("forgotPassword")
    .collection("user")
    .findOne(data);
  if (postCheck) {
    res.send(postCheck);
  } else {
    res.status(400).send("Incorrect username or password");
  }
});

app.post("/updatePassword", async function (req, res) {
  let { token, password } = req.body;
  token = parseInt(token);
  let checkData = await client
    .db("forgotPassword")
    .collection("user")
    .findOne({ token: token });

  if (checkData) {
    checkData = await client
      .db("forgotPassword")
      .collection("user")
      .updateOne(
        { token: token },
        { $set: { password: password }, $unset: { token: token } }
      );
    res.send({ msg: "Succussfully updated password" });
  } else {
    res.status(400).send({ errorMsg: "Incorrect Token" });
  }
});

app.listen(PORT, () => {
  console.log(`Listening port : ${PORT}`);
});
