require("dotenv").config();
const jwt = require("jsonwebtoken");

const { MongoClient, ObjectId } = require("mongodb");
const uri = process.env.mongo_url;

async function connectToCluster(uri) {
  let mongoClient;

  try {
    mongoClient = new MongoClient(uri);
    console.log("Connecting to MongoDB Atlas cluster...");
    await mongoClient.connect();
    console.log("Successfully connected to MongoDB Atlas!");

    return mongoClient;
  } catch (error) {
    console.error("Connection to MongoDB Atlas failed!", error);
    process.exit();
  }
}

module.exports.userVerification = (req, res, next) => {
  const token = req.cookies.token;
  //   console.log(token);
  if (!token) {
    return res.json({ status: false });
  }

  jwt.verify(token, process.env.TOKEN_KEY, async (err, data) => {
    if (err) {
      return res.json({ status: false });
    } else {
      mongoClient = await connectToCluster(uri);
      const db = mongoClient.db("health-db");
      const collection = db.collection("login-user");

      //   console.log(data.id);

      // data.id is the email id of the user
      result = await collection.findOne({ Email: data.id });

      //   console.log(result);

      if (result) {
        // next() is used to move to the next middleware or route
        next();
        // return res.json({ status: true, user: result.Username });
      } else return res.json({ status: false });
    }
  });
};
