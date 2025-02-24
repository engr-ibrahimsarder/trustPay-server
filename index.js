const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
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
      const result = await userCollection.insertOne(user);
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
