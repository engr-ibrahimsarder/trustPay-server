const express = require("express");
const app = express();
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const tranjectionCollection = client
      .db("trustpaydb")
      .collection("agentTranjection");
    // tranjectionId create
    const tran_Id = new ObjectId().toString();
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
      // Hash the PIN before storing it
      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(user.pin, salt);

      const userInfo = {
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        pin: hashedPin,
        nid: user.nid,
        amount: user.role === "agent" ? "00" : "40",
        status: false,
      };
      const result = await userCollection.insertOne(userInfo);
      res.send(result);
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
      res.send(exist);
    });
    app.get("/all-users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.patch("/user/:id", verifyToken, async (req, res) => {
      const user = req.body;
      const phone = req.params.id;
      const filter = { phone: phone };
      const exist = await userCollection.findOne(filter);
      const updatedDoc = {
        $set: {
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: "agent",
          pin: user.pin,
          nid: user.nid,
          amount: Number(100000),
          status: true,
        },
      };
      const result = await userCollection.updateOne(exist, updatedDoc);
      res.send(result);
    });
    let total = 0;
    // user send money
    app.patch("/user-sendmoney/:id", verifyToken, async (req, res) => {
      const sendMoney = req.body;
      // below user every trajection admin fee
      const role = "admin";
      const admin = await userCollection.findOne({ role });
      if (sendMoney.amount >= 100) {
        total = total + 5; // Increase Admin Fee
        const updatedDocAdmin = {
          $set: {
            name: admin.name,
            phone: admin.phone,
            email: admin.email,
            role: admin.role,
            pin: admin.pin,
            nid: admin.nid,
            amount: total,
            status: admin.status,
            tranjectionId: tran_Id,
          },
        };
        await userCollection.updateOne(admin, updatedDocAdmin);
      }
      // below user another user send money
      const userPhone = req.params.id;
      const phone = { phone: userPhone };
      const email = { email: sendMoney.email };
      const currentUser = await userCollection.findOne(email);
      const user = await userCollection.findOne(phone);

      if (!user) {
        return res.send({ message: "User Not Found!" });
      }
      const currentUserRemainingAmount = currentUser.amount - sendMoney.amount;
      console.log(currentUserRemainingAmount);
      const userCurrentAmount = Number(user.amount) + sendMoney.amount;

      const updatedDocCurrentUser = {
        $set: {
          name: currentUser.name,
          phone: currentUser.phone,
          email: currentUser.email,
          role: currentUser.role,
          pin: currentUser.pin,
          nid: currentUser.nid,
          amount: currentUserRemainingAmount,
          status: currentUser.status,
          tranjectionId: tran_Id,
        },
      };
      const updatedDocUser = {
        $set: {
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          pin: user.pin,
          nid: user.nid,
          amount: userCurrentAmount,
          status: true,
          tranjectionId: tran_Id,
        },
      };
      const userSendMonyTranjection = {
        name: currentUser.name,
        phone: currentUser.phone,
        email: currentUser.email,
        role: currentUser.role,
        pin: currentUser.pin,
        nid: currentUser.nid,
        amount: sendMoney.amount,
        status: currentUser.status,
        tranjectionId: tran_Id,
      };
      await tranjectionCollection.insertOne(userSendMonyTranjection);
      const currentUserUpdate = await userCollection.updateOne(
        currentUser,
        updatedDocCurrentUser
      );
      const updateUser = await userCollection.updateOne(user, updatedDocUser);

      res.send(currentUserUpdate);
    });

    // user cashout
    app.patch("/user-cashout/:id", verifyToken, async (req, res) => {
      const cashOutUser = req.body;
      // below user every trajection admin fee 0.50%
      const role = "admin";
      const admin = await userCollection.findOne({ role });
      const adminFeeUserCashOut = (0.5 / 100) * cashOutUser.amount;
      const agentFeeUserCashOut = (1.5 / 100) * cashOutUser.amount;
      const agentTotalFeeAmount = cashOutUser.amount + agentFeeUserCashOut;
      const adminTotalAmount = adminFeeUserCashOut + admin.amount;
      const updatedDocAdmin = {
        $set: {
          name: admin.name,
          phone: admin.phone,
          email: admin.email,
          role: admin.role,
          pin: admin.pin,
          nid: admin.nid,
          amount: adminTotalAmount,
          status: admin.status,
          tranjectionId: tran_Id,
        },
      };
      await userCollection.updateOne(admin, updatedDocAdmin);

      // below user cashout from agent account
      const agentPhone = req.params.id;
      const email = { email: cashOutUser.email };
      const currentUser = await userCollection.findOne(email);
      const phone = { phone: agentPhone };
      const agentUser = await userCollection.findOne(phone);
      if (!agentUser) {
        return res.send({ message: "User Not Found!" });
      }
      const agentTotalAmount = agentTotalFeeAmount + agentUser.amount;
      const updatedDocAgent = {
        $set: {
          name: agentUser.name,
          phone: agentUser.phone,
          email: agentUser.email,
          role: agentUser.role,
          pin: agentUser.pin,
          nid: agentUser.nid,
          amount: agentTotalAmount,
          status: agentUser.status,
          tranjectionId: tran_Id,
        },
      };
      await userCollection.updateOne(agentUser, updatedDocAgent);
      const currentUserAmountFee =
        cashOutUser.amount + adminFeeUserCashOut + agentFeeUserCashOut;
      const currentUserRemainingAmount =
        currentUser.amount - currentUserAmountFee;
      const updatedDocCurrentUser = {
        $set: {
          name: currentUser.name,
          phone: currentUser.phone,
          email: currentUser.email,
          role: currentUser.role,
          pin: currentUser.pin,
          nid: currentUser.nid,
          amount: currentUserRemainingAmount,
          status: currentUser.status,
          tranjectionId: tran_Id,
        },
      };
      const currentUserTranjection = {
        name: currentUser.name,
        phone: currentUser.phone,
        email: currentUser.email,
        role: currentUser.role,
        pin: currentUser.pin,
        nid: currentUser.nid,
        amount: currentUserAmountFee,
        status: currentUser.status,
        tranjectionId: tran_Id,
      };
      await tranjectionCollection.insertOne(currentUserTranjection);
      const updateCurrentUser = await userCollection.updateOne(
        currentUser,
        updatedDocCurrentUser
      );
      res.send(updateCurrentUser);
    });
    // agent cashin
    app.patch("/agent-user/:id", verifyToken, async (req, res) => {
      const cashIn = req.body;
      const userPhone = req.params.id;
      const email = { email: cashIn.email };
      const phone = { phone: userPhone };
      const agentUser = await userCollection.findOne(email);
      const user = await userCollection.findOne(phone);
      const userPreviousAmount = parseInt(user.amount);
      const userCashIn = parseInt(cashIn?.amount);
      const agentPreviousAmount = parseInt(agentUser?.amount);
      const agentRemainingAmount = agentPreviousAmount - userCashIn;
      const userTotalCashIn = userPreviousAmount + userCashIn;
      const updatedDocAgent = {
        $set: {
          name: agentUser.name,
          phone: agentUser.phone,
          email: agentUser.email,
          role: agentUser.role,
          pin: agentUser.pin,
          nid: agentUser.nid,
          amount: agentRemainingAmount,
          status: agentUser.status,
          tranjectionId: tran_Id,
        },
      };
      const updatedDocUser = {
        $set: {
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          pin: user.pin,
          nid: user.nid,
          amount: userTotalCashIn,
          status: true,
          tranjectionId: tran_Id,
        },
      };
      const updateAgentUser = await userCollection.updateOne(
        agentUser,
        updatedDocAgent
      );
      const updateUser = await userCollection.updateOne(user, updatedDocUser);
      const agentTranjection = {
        name: agentUser.name,
        phone: agentUser.phone,
        email: agentUser.email,
        role: agentUser.role,
        pin: agentUser.pin,
        nid: agentUser.nid,
        amount: userCashIn,
        status: agentUser.status,
        tranjectionId: tran_Id,
      };
      await tranjectionCollection.insertOne(agentTranjection);
      res.send(updateAgentUser);
    });
    app.get("/agent-user", verifyToken, async (req, res) => {
      const email = req.query;
      const result = await tranjectionCollection.find(email).toArray();
      res.send(result);
    });
    // admin all tranjection
    app.get("/adminalltranjection", async (req, res) => {
      const result = await tranjectionCollection.find().toArray();
      res.send(result);
    });
    app.get("/userquery", async (req, res) => {
      const phone = req.query;
      const result = await userCollection.findOne(phone);
      res.send(result);
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
