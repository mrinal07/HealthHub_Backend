const router = require("express").Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { createSecretToken } = require("../jwt/SecretToken"); // Importing the Secret Token
const { userVerification } = require("../middlewares/AuthMiddleware"); // Importing the Auth Middleware
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.mongo_url;
const { oAuth2Client, getDriveClient } = require("../config/googleDrive");
const moment = require("moment");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

// In-memory token store (use a database in production)
let googleToken = null;
const redirectUri = "http://localhost:5000/api/google/google-auth-callback";

// Route to get Google OAuth URL STEP 1
router.get("/google-auth-url", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    redirect_uri: redirectUri,
  });

  //   console.log(authUrl);
  res.json({ url: authUrl });
});

// Callback to exchange code for token STEP 2
router.get("/google-auth-callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oAuth2Client.getToken({
      code,
      redirect_uri: redirectUri,
    });
    console.log(tokens);
    googleToken = tokens;

    // res.json({ code: code, tokens: tokens });

    // Setting the token in the cookie at the time of authentication
    res.cookie("token", googleToken.access_token, {
      httpOnly: true, // Prevents JavaScript access
      secure: process.env.NODE_ENV === "production", // Only HTTPS in production
      sameSite: "strict", // Protects against CSRF
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res
      .status(200)
      //   .json({ googleToken: googleToken })
      .send("Authentication successful! You may close this window.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Authentication failed.");
  }
});

const upload2 = multer({ dest: path.join(__dirname, "../resources/") });

// Upload Documents to Google Drive STEP 3
router.post("/upload-data", upload2.single("document"), async (req, res) => {
  if (!googleToken) {
    return res.status(401).send("Please authenticate with Google first.");
  }

  const drive = getDriveClient(googleToken);

  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    // Creating root folder in Google Drive
    const rootFolderData = await createFolder("HealthHub");

    monthNumber = new Date().toISOString().split("T")[0].split("-")[1];

    const createMonthFolder = await createFolder(
      monthNames[monthNumber - 1] +
        "-" +
        new Date().toISOString().split("T")[0].split("-")[0],
      rootFolderData.id
    );

    // Creating subfolder inside root folder
    const childFolderData = await createFolder(
      moment().format("YYYY-MM-DD"),
      createMonthFolder.id
    );
    // console.log(rootFolderData+" "+childFolderData);

    // Check if the file already exists in the folder
    const query = `name='${req.file.originalname}' and '${childFolderData.id}' in parents and trashed=false`;
    const existingFiles = await drive.files.list({
      q: query,
      fields: "files(id, name)",
    });

    console.log("Upload Token", googleToken.access_token);

    // /google-auth-callback route will set the token in the cookie
    // res.cookie("token", googleToken.access_token, {
    //   httpOnly: true, // Prevents JavaScript access
    //   secure: process.env.NODE_ENV === "production", // Only HTTPS in production
    //   sameSite: "strict", // Protects against CSRF
    //   maxAge: 60 * 60 * 1000, // 1 hour
    // });

    // If the file already exists in the folder, return the file ID
    if (existingFiles.data.files.length > 0) {
      const fileId = existingFiles.data.files[0].id;
      const filePath = req.file.path;

      // Overwrite the file
      const updateExistingDoc = await drive.files.update({
        fileId,
        media: {
          mimeType: "application/octet-stream",
          body: fs.createReadStream(filePath),
        },
      });

      //   console.log(
      //     `File "${req.file.originalname}" already exists with ID: ${fileId}`
      //   );
      console.log(`File "${req.file.originalname}" updated with ID: ${fileId}`);

      res.status(200).json({
        message: `File "${req.file.originalname}" updated`,
        fileId: existingFiles.data.files[0].id,
        webViewLink: "NA",
        webContentLink: "NA",
        duplicate: true,
      });
    }
    // If the file doesn't exist, upload the file
    else {
      const fileMetadata = {
        name: req.file.originalname,
        parents: [childFolderData.id], // Optional: Replace with a specific folder ID.
      };

      const media = {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(req.file.path),
      };

      const response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: "id, webViewLink, webContentLink",
      });

      if (response.data.id) {
        const filePath = req.file.path;

        // console.log("File uploaded successfully!");
        // console.log(req.body);
        // console.log(path.basename(filePath));

        mongoClient = await connectToCluster(uri);
        const db = mongoClient.db("health-db");
        const collection = db.collection("document-user");

        // console.log(req.body._id);

        const filter = { _id: new ObjectId(req.body._id) }; // Condition to find the document

        const data = {
          $set: {
            User_Id: req.body.User_Id, // User ID
            Document_Name: req.body.Document_Name, // Document Name
            Document_Type: req.body.Document_Type, // Document Type
            Document_File_Path: filePath, // File Path in the server
            Document_Upload_Date: new Date().toISOString().split("T")[0], // Upload Date
            Document_Expire_Date: new Date(req.body.Document_Expire_Date) // Expiry Date
              .toISOString()
              .split("T")[0],
            Document_Description: req.body.Additional_Notes, // Additional Notes
            Document_Drive_Id: response.data.id, // Drive ID
            Document_Parent_Folder_Id: childFolderData.id, // Parent Folder ID
            Status_Enum: Number(req.body.Status_Enum) ?? 0, // Status Enum
            Lock_Id: req.body._id === undefined ? 1 : req.body.Lock_Id + 1, // Lock ID
            Last_Modify_Date: new Date().toISOString().split("T")[0], // Last Modify Date
          },
        };
        const result = await collection.updateOne(filter, data, {
          upsert: true,
        });

        res.status(200).json({
          message: "File uploaded successfully!",
          fileId: response.data.id,
          webViewLink: response.data.webViewLink,
          webContentLink: response.data.webContentLink,
          result: result,
          duplicate: false,
        });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to upload file.");
  }
});

router.get("/fetch-data", async (req, res) => {
  console.log("Fetch Token", req.cookies);

  if (req.cookies.token === undefined || req.cookies.token === null) {
    res.status(401).json({ message: "Please authenticate with Google first." });
    return;
  }

  const { token } = req.cookies;

  const auth = new google.auth.OAuth2(
    process.env.client_id,
    process.env.client_secret,
    process.env.redirect_uris
  );

  auth.setCredentials({ refresh_token: token });
  const drive = google.drive({ version: "v3", auth });

  try {
    // Fetch the root(HealthHub) folder
    const rootFolderDetail = await getHealthHubFolder(
      process.env.rootFolderName,
      drive
    );

    if (!rootFolderDetail) {
      res.status(404).json({ message: "Root(HealthHub) Folder not found" });
      return;
    }

    const folderId = rootFolderDetail.id;

    // Fetch the Month(child) folders
    const childFolderDetail = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, webViewLink, thumbnailLink)",
    });

    if (childFolderDetail.data.files.length === 0) {
      res.status(404).json({ message: "No Dated(Child) Folder found" });
      return;
    }

    let result = [];

    // console.log(childFolderDetail.data.files);

    const data = childFolderDetail.data.files;

    result = data.map((file) => ({
      name: file.name,
      id: file.id,
    }));

    console.log(result);

    // Use Promise.all to ensure all operations complete
    // This function will return the result array without empty entries in result
    // await Promise.all(
    //   childFolderDetail.data.files.map(async (element) => {

    //     const childResponse = await drive.files.list({
    //       q: `'${element.id}' in parents and trashed = false`,
    //       fields: "files(id, name, mimeType, webViewLink, thumbnailLink)",
    //     });

    //     // console.log(childResponse.data.files);

    //     for (const childElement of childResponse.data.files) {
    //       const year = childElement.name.split("-")[0];
    //       const month = childElement.name.split("-")[1];

    //       const yearEntry = result.find((x) => x.year === year);

    //       if (yearEntry) {
    //         if (!yearEntry.month.includes(monthNames[month - 1]+"|"+childElement.id)) {
    //           yearEntry.month.push(monthNames[month - 1]+"|"+childElement.id);
    //         }
    //       } else {
    //         result.push({
    //           year: year,
    //           month: [monthNames[month - 1]+"|"+childElement.id],
    //         });
    //       }
    //     }

    //   })
    // );

    // console.log(result);

    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/fetch-detailed-data", async (req, res) => {
  const { token } = req.cookies;
  const { code } = req.query;
  console.log("Code", code);
  console.log("Fetch Token", req.cookies);

  const auth = new google.auth.OAuth2(
    process.env.client_id,
    process.env.client_secret,
    process.env.redirect_uris
  );

  auth.setCredentials({ refresh_token: token });
  const drive = google.drive({ version: "v3", auth });

  const result = [];

  const datedFolderData = await drive.files.list({
    q: `'${code}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, thumbnailLink)",
  });

  if (datedFolderData.data.files.length > 0) {
    console.log("Dated Folder found in Month folder:");

    const folderPromises = datedFolderData.data.files.map(async (file) => {
      console.log(`Name: ${file.name}, ID: ${file.id}`);

      const filesData = await drive.files.list({
        q: `'${file.id}' in parents and trashed = false`,
        fields: "files(id, name, mimeType, webViewLink, thumbnailLink)",
      });

      if (filesData.data.files.length > 0) {
        console.log("Files found in the folder:");

        // const getObjByDate = result.find((x) => x.Date === file.name);

        const imgArray = [];

        const filePromises = filesData.data.files.map((file2) => {
          console.log(`Name: ${file2.name}, ID: ${file2.id}`);
          imgArray.push({
            name: file2.name,
            id: file2.id,
            webViewLink: file2.webViewLink,
            thumbnailLink: file2.thumbnailLink,
          });
        });

        result.push({
          Date: file.name,
          img: imgArray,
        });

        // Wait for all file-related promises to resolve
        await Promise.all(filePromises);
      }
    });
    // Await the promises for each folder
    await Promise.all(folderPromises); // Wait for all folder promises to complete
  } else {
    console.log("No files found in the folder.");
  }

  console.log(result);

  res.status(200).json({ message: "Success", result: result });
});

// Create a folder in Google Drive
async function createFolder(folderName, parentFolderId = null) {
  try {
    const drive = getDriveClient(googleToken);

    // Check for an existing folder with the same name
    const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const existingFolders = await drive.files.list({
      q: query,
      fields: "files(id, name)",
    });

    if (existingFolders.data.files.length > 0) {
      console.log(
        "Parent/Root Folder already exists:",
        existingFolders.data.files[0]
      );
      return existingFolders.data.files[0];
    }

    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    // If you want to create the folder inside another folder, specify 'parents'
    if (parentFolderId) {
      // Check if the parent folder exists
      const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
      const existingFolders = await drive.files.list({
        q: query,
        fields: "files(id, name)",
      });

      // If the folder already exists, return the folder ID
      if (existingFolders.data.files.length > 0) {
        console.log(
          "Sub/Child Folder already exists:",
          existingFolders.data.files[0]
        );
        return existingFolders.data.files[0];
      }

      // If the parent folder doesn't exist, create it
      fileMetadata.parents = [parentFolderId];
    }

    const response = await drive.files.create({
      resource: fileMetadata,
      fields: "id, name",
    });

    console.log(`Folder created with ID: ${response.data.id}`);
    return response.data; // Returns folder ID and name
  } catch (error) {
    console.error("Error creating folder:", error.message);
  }
}

async function getHealthHubFolder(folderName, drive) {
  // Search for a folder by its name
  try {
    const response = await drive.files.list({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name, mimeType)",
    });

    if (response.data.files.length === 0) {
      // res.status(404).json({ message: "Folder not found" });
      return null;
    } else {
      // res.status(200).json(response.data.files);
      return response.data.files[0];
    }
  } catch (error) {
    console.error("Error fetching folder:", error.message);
  }
}

//#region Module Export
// If dont write below line will get this error
//    TypeError: Router.use() requires a middleware function but got a Object
module.exports = router;
//#endregion