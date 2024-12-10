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

  // Encrypted token is stored in the cookie
  const token = req.cookies.token;

  // console.log("userVerification ", token);
  if (!token) {
    return res.json({ status: false });
  }

  jwt.verify(token, process.env.TOKEN_KEY, async (err, data) => {
    console.log("data ", data);

    if (err) {
      console.log("Middleware Error ", err);
      return res.status(403).json({ status: false });
    } else {
      // console.log("Middleware Success ", data);
      console.log("Middleware Success ");

      mongoClient = await connectToCluster(uri);
      const db = mongoClient.db("health-db");
      const collection = db.collection("login-user");

      // Decrypting the token and finding the user in the database
      // console.log("data.id=> ", data.id);

      result = await collection.findOne({
        "Google_Token.access_token": data.id,
      });      
      
      // console.log("Middleware result ", result);

      // data.id is the email id of the user

      if (result) {
        // adding the user data to the request object
        req.userData = result.Google_Token;
        // next() is used to move to the next middleware or route
        next();
        // return res.json({ status: true, user: result.Username });
      } else return res.status(404).json({ status: false });
    }
  });
};
