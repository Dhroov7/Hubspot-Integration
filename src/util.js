const dotenv = require("dotenv");
dotenv.config();

const axios = require("axios");

const callHubspotAPIToGethubspotAccountOwners = async (API_KEY) => {
  const url = "https://api.hubapi.com/crm/v3/owners/?limit=100&archived=false";

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  const response = await axios.get(url, { headers });

  return response.data;
};

const callHubspotAPIToCreateTicket = async (threadId, ownerId, API_KEY) => {
  const url = "https://api.hubapi.com/crm/v3/objects/tickets";

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  const data = {
    properties: {
      subject: `Ticket with thread ${threadId}`,
      hubspot_owner_id: ownerId,
      hs_pipeline_stage: "1",
      hs_ticket_priority: "LOW",
    },
    associations: [
      {
        to: {
          id: threadId,
        },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 32,
          },
        ],
      },
    ],
  };

  const response = await axios.post(url, data, { headers });

  return response.data;
};

const callHubspotAPIToGetMessageDetails = async (
  threadId,
  messageId,
  API_KEY
) => {
  const url = `https://api.hubapi.com/conversations/v3/conversations/threads/${threadId}/messages/${messageId}`;

  return axios.get(url, {
    headers: {
      authorization: `Bearer ${API_KEY}`,
    },
  });
};

const callHubspotAPIToSendMessage = async (payload, sendActorId, API_KEY, message) => {
  if (!payload.senders[0]?.deliveryIdentifier) {
    return;
  }
  if (payload.senders[0]?.deliveryIdentifier?.type !== 'CHANNEL_SPECIFIC_OPAQUE_ID') {
    return;
  }
  const url = `https://api.hubapi.com/conversations/v3/conversations/threads/${payload.conversationsThreadId}/messages`;

  const messageData = {
    type: "MESSAGE",
    text: message,
    recipients: [
      {
        actorId: payload.senders[0]?.actorId,
        recipientField: "TO",
        deliveryIdentifiers: [
          {
            type: payload.senders[0]?.deliveryIdentifier?.type,
            value: payload.senders[0]?.deliveryIdentifier?.value,
          },
        ],
      },
    ],
    senderActorId: sendActorId, //A-userID
    channelId: payload.channelId,
    channelAccountId: payload.channelAccountId,
  };

  return axios.post(url, messageData, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });
};

const callHubspotAPIToGetTicketSettings = async (ticketId, API_KEY) => {
  if (!ticketId) {
    return;
  }
  const response = await axios.get(
    `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}?properties=chatbot_enabled&archived=false`,
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    }
  );
  return response.data;
};

const callHubspotAPIToCreateTicketCustomProperty = async (API_KEY) => {
  const url = "https://api.hubapi.com/crm/v3/properties/tickets";

  const messageData = {
    name: "chatbot_enabled",
    label: "Chatbot Enabled",
    type: "enumeration",
    fieldType: "select",
    groupName: "ticket_activity",
    hidden: false,
    displayOrder: 2,
    hasUniqueValue: false,
    formField: true,
    options: [
      {
        label: "YES",
        description: "Enabled",
        value: "YES",
        displayOrder: 1,
        hidden: false,
      },
      {
        label: "NO",
        description: "Disabled",
        value: "NO",
        displayOrder: 2,
        hidden: false,
      },
    ],
  };

  return axios.post(url, messageData, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });
};

const callHubspotAPIToGetPortalID = async (API_KEY) => {
  const response = await axios.get(
    `https://api.hubapi.com/account-info/v3/details`,
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    }
  );
  return response.data;
}

const callHubspotAPIToUpdateTicket = async (API_KEY, updateObj, ticketId) => {
  const url = `https://api.hubapi.com/crm/v3/objects/tickets/${ticketId}`;

  return axios.patch(url, updateObj, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });
}

const callHubspotAPIToGetInboxIDofThread = async (threadId, API_KEY) => {
  const url = `https://api.hubapi.com/conversations/v3/conversations/threads/${threadId}`;

  return axios.get(url, {
    headers: {
      authorization: `Bearer ${API_KEY}`,
    },
  });
}

const callGigitAPI = async (dataPayload) => {
  const response = await axios.post(
    process.env?.GIGIT_API_URL,
    dataPayload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(response.data.body, 'RESPONSE FROM API');
  return response.data.body;
};

module.exports = {
  callHubspotAPIToCreateTicket,
  callHubspotAPIToCreateTicketCustomProperty,
  callHubspotAPIToGetMessageDetails,
  callHubspotAPIToGetTicketSettings,
  callHubspotAPIToGethubspotAccountOwners,
  callHubspotAPIToSendMessage,
  callHubspotAPIToGetPortalID,
  callHubspotAPIToUpdateTicket,
  callHubspotAPIToGetInboxIDofThread,
  callGigitAPI
};
