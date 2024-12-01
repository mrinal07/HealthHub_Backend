const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

// Load credentials.json (downloaded from Google Cloud Console)
const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, "../testing/credentials.json")));

// console.log(credentials.web.client_id);

// Extract keys
const { client_id, client_secret, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Export Google Drive client
const getDriveClient = (token) => {
  oAuth2Client.setCredentials(token);
  return google.drive({ version: "v3", auth: oAuth2Client });
};

module.exports = { oAuth2Client, getDriveClient };
