const { Sequelize, DataTypes } = require('sequelize');
const postgres = require('pg');
const dotenv = require("dotenv");

dotenv.config();

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;

const sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
  host: PGHOST,
  port: 5432,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  // storage: 'db.sqlite'
});

sequelize.authenticate().then(() => {
  console.log('Connection has been established successfully.');
}).catch((error) => {
  console.error('Unable to connect to the database: ', error);
});

const Thread = sequelize.define('Thread', {
  id: {
    type: DataTypes.STRING,
    unique: true,
    primaryKey: true
  },
  ticketId: {
    type: DataTypes.BIGINT,
    unique: true
  },
  inboxId: {
    type: DataTypes.STRING
  }
});

const Owner = sequelize.define('Owner', {
  id: {
    type: DataTypes.BIGINT,
    unique: true,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  actorId: {
    type: DataTypes.STRING,
    unique: true
  },
  portalId: {
    type: DataTypes.BIGINT,
    unique: true
  }
});

const RefreshToken = sequelize.define('refreshToken', {
  portalId: {
    type: DataTypes.STRING,
    unique: true
  },
  token: {
    type: DataTypes.STRING
  }
});

sequelize.sync().then(() => {
  console.log('Book table created successfully!');
}).catch((error) => {
  console.error('Unable to create table : ', error);
});


module.exports = {
  sequelize,
  model: {
    Thread,
    Owner,
    RefreshToken
  }
};
