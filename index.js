const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = 3000;
// middleware
app.use(express.json());
app.use(cors());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yemo7.mongodb.net/trustpaydb?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();
    const userCollection = client.db("trustpaydb").collection("users");
    // jwt create api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    // user api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = [];
      if (user?.email) query.push({ email: user.email });
      if (user?.nid) query.push({ nid: user.nid });
      if (user?.phone) query.push({ phone: user.phone });
      const exist = await userCollection.findOne({ $or: query });
      if (exist) {
        return res.send({ message: "User Already Exist!" });
      }

      if (user.role == "agent") {
        const userInfo = {
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          pin: user.pin,
          nid: user.nid,
          amount: "00",
          status: false,
        };
        const result = await userCollection.insertOne(userInfo);
        res.send(result);
        console.log(user);
      } else {
        const userInfo = {
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          pin: user.pin,
          nid: user.nid,
          amount: "40",
          status: false,
        };
        const result = await userCollection.insertOne(userInfo);
        res.send(result);
      }
    });
    app.post("/user-login", async (req, res) => {
      const user = req.body;
      const query = [];
      if (user?.text) query.push({ email: user.text });
      if (user?.text) query.push({ phone: user.text });
      const exist = await userCollection.findOne({ $or: query });
      if (!exist) {
        return res.send({ message: "User Not Found!" });
      }
      res.send(exist);
    });
    app.get("/users", verifyToken, async (req, res) => {
      const user = req.query;
      const query = [];
      if (user?.text && user?.email) {
        query.push({ $or: [{ phone: user.text }, { email: user.email }] });
      } else {
        if (user?.text) {
          query.push({ $or: [{ email: user.text }, { phone: user.text }] });
        }
        if (user?.email) {
          query.push({ $or: [{ email: user.email }, { phone: user.email }] });
        }
      }

      const exist = await userCollection.findOne({ $or: query });
      // console.log(user);
      res.send(exist);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running...");
});
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
