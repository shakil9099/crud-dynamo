const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')

const client = new DynamoDBClient({ region: "ap-south-1" });

module.exports = client;