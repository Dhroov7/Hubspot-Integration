require("dotenv").config();
const express = require("express");
const request = require("request-promise-native");
const NodeCache = require("node-cache");
const session = require("express-session");
const opn = require("open");
const app = express();
const bodyParser = require("body-parser");
const path = require('path');
const { model, sequelize } = require(path.join(__dirname, './db/model'));
const {
  callHubspotAPIToSendMessage,
  callHubspotAPIToCreateTicket,
  callHubspotAPIToCreateTicketCustomProperty,
  callHubspotAPIToGetMessageDetails,
  callHubspotAPIToGetTicketSettings,
  callHubspotAPIToGethubspotAccountOwners,
  callHubspotAPIToGetPortalID,
} = require(path.join(__dirname, './util'));

const PORT = 3000;

const accessTokenCache = new NodeCache({ deleteOnExpire: true });

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
  throw new Error("Missing CLIENT_ID or CLIENT_SECRET environment variable.");
}

//===========================================================================//
//  HUBSPOT APP CONFIGURATION
//
//  All the following values must match configuration settings in your app.
//  They will be used to build the OAuth URL, which users visit to begin
//  installing. If they don't match your app's configuration, users will
//  see an error page.

// Replace the following with the values from your app auth config,
// or set them as environment variables before running.
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// Scopes for this app will default to `crm.objects.contacts.read`
// To request others, set the SCOPE environment variable instead
let SCOPES = [
  "social",
  "oauth",
  "tickets",
  "conversations.visitor_identification.tokens.create",
  "conversations.read",
  "conversations.write",
  "crm.objects.owners.read",
];
if (process.env.SCOPE) {
  SCOPES = process.env.SCOPE.split(/ |, ?|%20/).join(" ");
}

// On successful install, users will be redirected to /oauth-callback
const REDIRECT_URI = `http://localhost:${PORT}/oauth-callback`;

//===========================================================================//

// Use a session to keep track of client ID
app.use(
  session({
    secret: Math.random().toString(36).substring(2),
    resave: false,
    saveUninitialized: true,
  })
);

app.use(bodyParser.json());

//================================//
//   Running the OAuth 2.0 Flow   //
//================================//

// Step 1
// Build the authorization URL to redirect a user
// to when they choose to install the app
const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=http://localhost:3000/oauth-callback&scope=social%20oauth%20tickets%20conversations.visitor_identification.tokens.create%20conversations.read%20conversations.write%20crm.objects.owners.read`;
// 'https://app.hubspot.com/oauth/authorize' +
// `?client_id=${encodeURIComponent(CLIENT_ID)}` + // app's client ID
// `&scope=${encodeURIComponent(SCOPES)}` + // scopes being requested by the app
// `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`; // where to send the user after the consent page

// Redirect the user from the installation page to
// the authorization URL
app.get("/install", (req, res) => {
  console.log("");
  console.log("=== Initiating OAuth 2.0 flow with HubSpot ===");
  console.log("");
  console.log("===> Step 1: Redirecting user to your app's OAuth URL");
  res.redirect(authUrl);
  console.log("===> Step 2: User is being prompted for consent by HubSpot");
});

// Step 2
// The user is prompted to give the app access to the requested
// resources. This is all done by HubSpot, so no work is necessary
// on the app's end

// Step 3
// Receive the authorization code from the OAuth 2.0 Server,
// and process it based on the query parameters that are passed
app.get("/oauth-callback", async (req, res) => {
  console.log("===> Step 3: Handling the request sent by the server");

  // Received a user authorization code, so now combine that with the other
  // required values and exchange both for an access token and a refresh token
  if (req.query.code) {
    console.log("       > Received an authorization token");

    const authCodeProof = {
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: req.query.code,
    };

    // Step 4
    // Exchange the authorization code for an access token and refresh token
    console.log(
      "===> Step 4: Exchanging authorization code for an access token and refresh token"
    );
    const token = await exchangeForTokens(authCodeProof);
    if (token.message) {
      return res.redirect(`/error?msg=${token.message}`);
    }
    const userPortalDetails = await callHubspotAPIToGetPortalID(token.access_token);
    console.log(userPortalDetails, "------user portal details");
    const portalId = userPortalDetails.portalId;
    await model.RefreshToken.create({
      portalId: portalId,
      token: token.refresh_token,
    });
    accessTokenCache.set(
      portalId,
      token.access_token,
      Math.round(token.expires_in * 0.75)
    );
    // Once the tokens have been retrieved, use them to make a query
    // to the HubSpot API
    res.redirect(`/?portalId=${portalId}`);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body[0];
    console.log(body, "------body");
    let API_KEY = accessTokenCache.get(body.portalId);
    if (!API_KEY) {
      console.log("Refreshing expired access token");
      API_KEY = await refreshAccessToken(body.portalId).access_token;
    }
    const threadId = body?.objectId;
    const portalId = body.portalId;
    const [threadData, ownerData] = await Promise.all([
      model.Thread.findOne({
        where: {
          id: threadId,
        },
      }),
      model.Owner.findOne({
        where: {
          portalId,
        },
      }),
    ]);

    let ownerId = ownerData?.id,
      actorId = ownerData?.actorId;
    if (!ownerData) {
      const owners = await callHubspotAPIToGethubspotAccountOwners(API_KEY);
      const owner = owners?.results[0];

      await model.Owner.create({
        email: owner.email,
        actorId: `A-${owner.userId}`,
        portalId,
        id: owner.id,
      });
      ownerId = owner.id;
      actorId = `A-${owner.userId}`;

      //Still not sure where to do this
      await callHubspotAPIToCreateTicketCustomProperty(API_KEY);
    }
    let ticketId = threadData?.dataValues?.ticketId;
    if (!threadData) {
      const ticketData = await callHubspotAPIToCreateTicket(
        threadId,
        ownerId,
        API_KEY
      );
      ticketId = ticketData.id;
      await model.Thread.create({
        id: threadId,
        ticketId: ticketId,
      });
    }
    const ticketProperties = await callHubspotAPIToGetTicketSettings(
      ticketId,
      API_KEY
    );
    const isChatbotEnabled = ticketProperties.properties.chatbot_enabled;
    if (isChatbotEnabled !== "NO") {
      const result = await callHubspotAPIToGetMessageDetails(
        body.objectId,
        body.messageId,
        API_KEY
      );
      await callHubspotAPIToSendMessage(result.data, actorId, API_KEY);
    }
    return res.send("Done");
  } catch (err) {
    console.log(err, "--------err");
    res.send("Done");
  }
});

//==========================================//
//   Exchanging Proof for an Access Token   //
//==========================================//

const exchangeForTokens = async (exchangeProof) => {
  try {
    const responseBody = await request.post(
      "https://api.hubapi.com/oauth/v1/token",
      {
        form: exchangeProof,
      }
    );
    // Usually, this token data should be persisted in a database and associated with
    // a user identity.
    const tokens = JSON.parse(responseBody);
    console.log("       > Received an access token and refresh token");
    return tokens;
  } catch (e) {
    console.error(
      `       > Error exchanging ${exchangeProof.grant_type} for access token`
    );
    return JSON.parse(e.response.body);
  }
};

const refreshAccessToken = async (portalId) => {
  const refreshToken = await model.RefreshToken.findOne({
    where: {
      portalId: portalId,
    },
  });
  const refreshTokenProof = {
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    refresh_token: refreshToken?.dataValues?.token,
  };
  return await exchangeForTokens(refreshTokenProof);
};

const isAuthorized = async (portalId) => {
  const refreshToken = await model.RefreshToken.findOne({
    where: {
      portalId,
    },
  });
  console.log(refreshToken, "-----in refresh token")
  return refreshToken?.dataValues?.token ? true : false;
};

app.get("/", async (req, res) => {
  const portalId = req.query?.portalId || '';
  console.log(req.query, "----query");
  res.setHeader("Content-Type", "text/html");
  res.write(`<h2>HubSpot OAuth 2.0 Quickstart App</h2>`);
  if (await isAuthorized(portalId)) {
    res.write(`<h4>App Installed!!</h4>`);
  } else {
    res.write(`<a href="/install"><h3>Install the app</h3></a>`);
  }
  res.end();
});

app.get("/error", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.write(`<h4>Error: ${req.query.msg}</h4>`);
  res.end();
});

app.get('/health', (req, res) => {
  res.status(200).send();
})

sequelize.sync({ alter: true }).then(() => {
  app.listen(PORT, () =>
    console.log(`=== Starting your app on http://localhost:${PORT} ===`)
  );
  opn(`http://localhost:${PORT}`);
});
