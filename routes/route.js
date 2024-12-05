const router = require("express").Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { createSecretToken } = require("../jwt/SecretToken"); // Importing the Secret Token
const { userVerification } = require("../middlewares/AuthMiddleware"); // Importing the Auth Middleware
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.mongo_url;
const { oAuth2Client, getDriveClient } = require("../config/googleDrive");
const moment = require("moment");

//  latest way of connecting mongodb atlas
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

//#region User

// Get All or By Id(Specific) User Data
router.get("/get-user", userVerification, async (req, res) => {
  try {
    mongoClient = await connectToCluster(uri);
    const db = mongoClient.db("health-db");
    const collection = db.collection("login-user");

    let result = [];

    if (
      req.body._id === undefined ||
      req.body._id === "" ||
      req.body._id === null
    ) {
      result = await collection.find({}).toArray();
    } else {
      console.log(req.body._id);
      result = await collection
        .find({
          _id: new ObjectId(req.body._id),
        })
        .toArray();
    }
    res.status(200).send({ result: result, count: result.length });
  } catch (error) {
    res.status(500).send(error);
  } finally {
    await mongoClient.close();
  }
});

// Add and Update User Data
router.post("/add-user", async (req, res) => {
  try {
    // console.log(req.body);
    mongoClient = await connectToCluster(uri);
    const db = mongoClient.db("health-db");
    const collection = db.collection("login-user");

    const filter = { _id: new ObjectId(req.body._id) }; // Condition to find the document

    const data = {
      $set: {
        Username: req.body.Username,
        Password: hashPassword,
        Email: req.body.Email,
        Login_Token: req.body.Login_Token,
        Login_Status: req.body.Login_Status,
        Status_Enum: req.body.Status_Enum ?? 0,
        Lock_Id: req.body._id === undefined ? 1 : req.body.Lock_Id + 1,
        Last_Modify_Date: Date.now(),
      },
    };
    const result = await collection.updateOne(filter, data, {
      upsert: true,
    });

    res.status(200).send({ result: result });
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  } finally {
    // Ensures that the client will close when you finish/error
    await mongoClient.close();
  }
});

// Signup User
router.post("/signup-user", async (req, res) => {
  try {
    // console.log(req.body);
    mongoClient = await connectToCluster(uri);
    const db = mongoClient.db("health-db");
    const collection = db.collection("login-user");

    // Validation for existing user
    email = req.body.Email;
    const existingUser = await collection.findOne({ Email: email });
    if (existingUser) {
      return res.json({ message: "User already exists" });
    }

    const token = createSecretToken(email);

    let hashPassword = "";

    // console.log(token);
    const saltRounds = 12;
    hashPassword = await bcrypt.hash(req.body.Password, saltRounds);
    // console.log("Hashed password:", hashPassword);

    const data = {
      Username: req.body.Username,
      Password: hashPassword,
      Email: req.body.Email,
      Login_Token: token,
      Login_Status: req.body.Login_Status,
      Status_Enum: req.body.Status_Enum ?? 0,
      Lock_Id: 1,
      Last_Modify_Date: Date.now(),
    };
    const result = await collection.insertOne(data);

    res.cookie("token", token, {
      withCredentials: true,
      httpOnly: false,
    });

    res.status(200).send({ result: result });
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  } finally {
    // Ensures that the client will close when you finish/error
    await mongoClient.close();
  }
});

// Delete User Data
router.post("/delete-user", async (req, res) => {
  debugger;
  try {
    mongoClient = await connectToCluster(uri);
    const db = mongoClient.db("health-db");
    const collection = db.collection("login-user");

    const filter = { _id: new ObjectId(req.body._id) };
    // console.log(filter);

    const result = await collection.deleteOne(filter);
    // console.log(result);

    result.deletedCount === 1
      ? res.status(200).send({
          data: result,
          success: true,
          message: "User Updated Successfully",
        })
      : res.status(200).send({
          data: result,
          success: false,
          message: "User Not Deleted Server issue",
        });
  } catch (error) {
    res.status(500).send(error);
  } finally {
    // Ensures that the client will close when you finish/error
    await mongoClient.close();
  }
});

// Login User
router.post("/login-user", async (req, res) => {
  try {
    const password = req.body.Password;
    const username = req.body.Username;
    const email = req.body.Email;

    // Validate the user input
    if (!username || !password) {
      return res.json({ message: "All fields are required" });
    }

    mongoClient = await connectToCluster(uri);
    const db = mongoClient.db("health-db");
    const collection = db.collection("login-user");

    const existingUser = await collection.findOne({ Username: username });

    if (!existingUser) {
      return res.json({
        data: existingUser,
        success: false,
        message: "Incorrect email, please check again",
      });
    } else {
      const storedHashedPassword = existingUser.Password;
      const userInputPassword = password;

      bcrypt.compare(userInputPassword, storedHashedPassword, (err, result) => {
        if (err) {
          // Handle error
          console.error("Error comparing passwords:", err);
          return;
        }

        // console.error(existingUser);

        if (result && existingUser.Username === username) {
          // Passwords match, authentication successful
          //   console.error(result);
          const token = createSecretToken(email);
          console.log("Passwords match! User authenticated.");

          res.cookie("token", token, {
            withCredentials: true,
            httpOnly: false,
          });
          res.status(200).send({
            data: result,
            success: true,
            message: "User Authenticated",
          });
        } else {
          // Passwords don't match, authentication failed
          console.log("Passwords do not match! Authentication failed.");
          res.status(200).send({
            data: result,
            success: false,
            message: "User Not Authenticated",
          });
        }
      });
    }

    // console.log(existingUser);
  } catch (error) {
    res.status(500).send(error);
  } finally {
    // await mongoClient.close();
  }
});

//#endregion

//#region  Multer
const multer = require("multer");
const path = require("path");
const fs = require("fs");

let baseDir = path.join(__dirname, "../resources/");

if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, baseDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.originalname}`);
  },
});

const upload = multer({ storage });
//#endregion

//#region Add Document to file path COMMENTED

// upload.single("image") this name must be same as the name of the input field in the form
// Not using this route as of now 27/11/2024
// router.post("/upload", upload.single("image"), (req, res) => {
//   // console.log(baseDir);

//   //   console.log("req.body");
//   try {
//     if (!req.file) {
//       return res.status(400).send("No file uploaded.");
//     }

//     res.status(200).json({
//       message: "File uploaded successfully",
//       file: req.file,
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
//#endregion

//#region Documents CRUD 
// Get All or By Id(Specific) Document Data
router.get("/get-document", async (req, res) => {
  try {
    mongoClient = await connectToCluster(uri);
    const db = mongoClient.db("health-db");
    const collection = db.collection("document-user");

    let result = [];

    if (
      req.body._id === undefined ||
      req.body._id === "" ||
      req.body._id === null
    ) {
      result = await collection.find({}).toArray();
      result.forEach((element) => {
        // console.log(element.Document_File_Path);
        // console.log(path.basename(element.Document_File_Path));
        element.Document_File_Path = path.basename(element.Document_File_Path);
      });
    } else {
      console.log(req.body._id);
      result = await collection
        .find({
          _id: new ObjectId(req.body._id),
        })
        .toArray();
    }
    res.status(200).send({ result: result, count: result.length });
  } catch (error) {
    res.status(500).send(error);
  } finally {
    await mongoClient.close();
  }
});
// Delete Document Data
router.post("/delete-document", async (req, res) => {
  debugger;
  try {
    mongoClient = await connectToCluster(uri);
    const db = mongoClient.db("health-db");
    const collection = db.collection("document-user");

    const filter = { _id: new ObjectId(req.body._id) };
    // console.log(filter);

    const result = await collection.deleteOne(filter);
    // console.log(result);

    result.deletedCount === 1
      ? res.status(200).send({
          data: result,
          success: true,
          message: "Document Deleted Successfully",
        })
      : res.status(200).send({
          data: result,
          success: false,
          message: "Document Not Deleted Server issue",
        });
  } catch (error) {
    res.status(500).send(error);
  } finally {
    // Ensures that the client will close when you finish/error
    await mongoClient.close();
  }
});

// Add and Update Document Data --- NOT IN USE ---
router.post("/add-document", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const filePath = req.file.path;

    // console.log("File path:", filePath);
    // console.log(req.body);
    // console.log(path.basename(filePath));

    mongoClient = await connectToCluster(uri);
    const db = mongoClient.db("health-db");
    const collection = db.collection("document-user");

    // console.log(req.body._id);

    const filter = { _id: new ObjectId(req.body._id) }; // Condition to find the document

    const data = {
      $set: {
        User_Id: req.body.User_Id,
        Document_Name: req.body.Document_Name,
        Document_Type: req.body.Document_Type,
        Document_File_Path: filePath,
        Document_Upload_Date: new Date().toISOString().split("T")[0], //req.body.Document_Upload_Date,
        Document_Expire_Date: new Date(req.body.Document_Expire_Date)
          .toISOString()
          .split("T")[0],
        Status_Enum: Number(req.body.Status_Enum) ?? 0,
        Lock_Id: req.body._id === undefined ? 1 : req.body.Lock_Id + 1,
        Last_Modify_Date: new Date().toISOString().split("T")[0],
      },
    };
    const result = await collection.updateOne(filter, data, { upsert: true });

    res
      .status(200)
      .send({ result: result, success: "Document Added Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  } finally {
    // Ensures that the client will close when you finish/error
    await mongoClient.close();
  }
});

//#region Get Document from file path
// Endpoint to get the PDF file
router.get("/download/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(baseDir, filename);
  // console.log(filePath);

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    res.download(filePath, filename, (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      }
    });
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

//#endregion

//#endregion

//#region Documents CRUD + File Management (CRUD)
// router.post("/upload", upload.single("image"), async (req, res) => {
//     // console.log(baseDir);

//     //   console.log("req.body");
//     try {
//       mongoClient = await connectToCluster(uri);
//       const db = mongoClient.db("health-db");
//       const collection = db.collection("document-user");

//       console.log(req.body);

//       const filter = { _id: new ObjectId(req.body._id) }; // Condition to find the document

//       const data = {
//         $set: {
//           User_Id: req.body.User_Id,
//           Document_Name: req.body.Document_Name,
//           Document_Type: req.body.Document_Type,
//           Document_File_Path: req.body.Document_File_Path,
//           Document_Upload_Date: req.body.Document_Upload_Date,
//           Document_Expire_Date: req.body.Document_Expire_Date,
//           Status_Enum: req.body.Status_Enum ?? 0,
//           Lock_Id: req.body._id === undefined ? 1 : req.body.Lock_Id + 1,
//           Last_Modify_Date: Date.now(),
//         },
//       };

//       if (!req.file) {
//         return res.status(400).send("No file uploaded.");
//       }

//       const result = await collection.updateOne(filter, data, { upsert: true });

//       // res.status(200).send({ result: result });

//       res.status(200).json({
//         message: "File uploaded successfully",
//         file: req.file,
//         result: result
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   });
//#endregion

//#region Google Drive API --------Shifted to routeGoogle.js--------------------------------------------------

// In-memory token store (use a database in production)
// let googleToken = null;

// // Route to get Google OAuth URL STEP 1
// router.get("/google-auth-url", (req, res) => {
//   const authUrl = oAuth2Client.generateAuthUrl({
//     access_type: "offline",
//     scope: ["https://www.googleapis.com/auth/drive.file"],
//   });
//   res.json({ url: authUrl });
// });

// // Callback to exchange code for token STEP 2
// router.get("/google-auth-callback", async (req, res) => {
//   const { code } = req.query;
//   try {
//     const { tokens } = await oAuth2Client.getToken(code);
//     console.log(tokens);
//     googleToken = tokens;
//     res
//       .status(200)
//       .send("Authentication successful! You can now upload files.");
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Authentication failed.");
//   }
// });

// const upload2 = multer({ dest: path.join(__dirname, "../resources/") });

// // Upload Documents to Google Drive STEP 3
// router.post("/upload-data", upload2.single("document"), async (req, res) => {
//   if (!googleToken) {
//     return res.status(401).send("Please authenticate with Google first.");
//   }

//   const drive = getDriveClient(googleToken);

//   try {

//      if (!req.file) {
//         return res.status(400).send("No file uploaded.");
//       }

//     // Creating root folder in Google Drive
//     const rootFolderData = await createFolder("HealthHub");

//     // Creating subfolder inside root folder
//     const childFolderData = await createFolder(
//       moment().format("YYYY-MM-DD"),
//       rootFolderData.id
//     );
//     // console.log(rootFolderData+" "+childFolderData);

//     // Check if the file already exists in the folder
//     const query = `name='${req.file.originalname}' and '${childFolderData.id}' in parents and trashed=false`;
//     const existingFiles = await drive.files.list({
//       q: query,
//       fields: "files(id, name)",
//     });

//     // If the file already exists in the folder, return the file ID
//     if (existingFiles.data.files.length > 0) {
//       // Duplicate file found
//       console.log(
//         `File "${req.file.originalname}" already exists with ID: ${existingFiles.data.files[0].id}`
//       );

//       res.status(200).json({
//         message: `File "${req.file.originalname}" already exists`,
//         fileId: existingFiles.data.files[0].id,
//         webViewLink: "NA",
//         webContentLink: "NA",
//         duplicate: true,
//       });
//     }
//     // If the file doesn't exist, upload the file
//     else {
//       const fileMetadata = {
//         name: req.file.originalname,
//         parents: [childFolderData.id], // Optional: Replace with a specific folder ID.
//       };

//       const media = {
//         mimeType: req.file.mimetype,
//         body: fs.createReadStream(req.file.path),
//       };

//       const response = await drive.files.create({
//         resource: fileMetadata,
//         media,
//         fields: "id, webViewLink, webContentLink",
//       });

     
  
//       const filePath = req.file.path;
  
//       // console.log("File path:", filePath);
//       // console.log(req.body);
//       // console.log(path.basename(filePath));
  
//       mongoClient = await connectToCluster(uri);
//       const db = mongoClient.db("health-db");
//       const collection = db.collection("document-user");
  
//       // console.log(req.body._id);
  
//       const filter = { _id: new ObjectId(req.body._id) }; // Condition to find the document
  
//       const data = {
//         $set: {
//           User_Id: req.body.User_Id,
//           Document_Name: req.body.Document_Name,
//           Document_Type: req.body.Document_Type,
//           Document_File_Path: filePath,
//           Document_Upload_Date: new Date().toISOString().split("T")[0], //req.body.Document_Upload_Date,
//           Document_Expire_Date: new Date(req.body.Document_Expire_Date)
//             .toISOString()
//             .split("T")[0],
//           Status_Enum: Number(req.body.Status_Enum) ?? 0,
//           Lock_Id: req.body._id === undefined ? 1 : req.body.Lock_Id + 1,
//           Last_Modify_Date: new Date().toISOString().split("T")[0],
//         },
//       };
//       const result = await collection.updateOne(filter, data, { upsert: true });


//       res.status(200).json({
//         message: "File uploaded successfully!",
//         fileId: response.data.id,
//         webViewLink: response.data.webViewLink,
//         webContentLink: response.data.webContentLink,
//         result:result,
//         duplicate: false,
//       });
//     }
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Failed to upload file.");
//   }
// });

// // Create a folder in Google Drive
// async function createFolder(folderName, parentFolderId = null) {
//   try {
//     const drive = getDriveClient(googleToken);

//     // Check for an existing folder with the same name
//     const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
//     const existingFolders = await drive.files.list({
//       q: query,
//       fields: "files(id, name)",
//     });

//     if (existingFolders.data.files.length > 0) {
//       console.log(
//         "Parent/Root Folder already exists:",
//         existingFolders.data.files[0]
//       );
//       return existingFolders.data.files[0];
//     }

//     const fileMetadata = {
//       name: folderName,
//       mimeType: "application/vnd.google-apps.folder",
//     };

//     // If you want to create the folder inside another folder, specify 'parents'
//     if (parentFolderId) {
//       // Check if the parent folder exists
//       const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
//       const existingFolders = await drive.files.list({
//         q: query,
//         fields: "files(id, name)",
//       });

//       // If the folder already exists, return the folder ID
//       if (existingFolders.data.files.length > 0) {
//         console.log(
//           "Sub/Child Folder already exists:",
//           existingFolders.data.files[0]
//         );
//         return existingFolders.data.files[0];
//       }

//       // If the parent folder doesn't exist, create it
//       fileMetadata.parents = [parentFolderId];
//     }

//     const response = await drive.files.create({
//       resource: fileMetadata,
//       fields: "id, name",
//     });

//     console.log(`Folder created with ID: ${response.data.id}`);
//     return response.data; // Returns folder ID and name
//   } catch (error) {
//     console.error("Error creating folder:", error.message);
//   }
// }

//#endregion

//#region Module Export
// If dont write below line will get this error
//    TypeError: Router.use() requires a middleware function but got a Object
module.exports = router;
//#endregion
