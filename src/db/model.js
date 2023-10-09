const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'db.sqlite'
});

const Thread = sequelize.define('Thread', {
  id: {
    type: DataTypes.NUMBER,
    unique: true,
    primaryKey: true
  },
  ticketId: {
    type: DataTypes.NUMBER,
    unique: true
  },
  inboxId: {
    type: DataTypes.NUMBER
  }
});

const Owner = sequelize.define('Owner', {
  id: {
    type: DataTypes.NUMBER,
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
    type: DataTypes.NUMBER,
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

module.exports = {
  sequelize,
  model: {
    Thread,
    Owner,
    RefreshToken
  }
};
