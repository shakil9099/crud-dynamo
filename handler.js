'use strict';
const { PutItemCommand, GetItemCommand, UpdateItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { v4: uuidv4 } = require('uuid');
const client = require('./dynamoDB');
const message = require('./messages')

const handler = {};

handler.createTask = async (event) => {
  try {
    const body = JSON.parse(event.body)
    const document = {
      TableName: 'Task',
      Item : marshall({
        ID: uuidv4(),
        DateCreated: new Date().toISOString(),
        ...body
      })
    }
    const command = new PutItemCommand(document)
    const result = await client.send(command)
    return message.create_success('task', result)
  } catch(error) {    
    return message.server_error(error)
  }
}

handler.getTask =  async (event) => {
    const { taskId } = event.pathParameters;
    const params = {
      TableName: "Task",
      Key: {
        ID: { S: taskId },
      },
    };
    
    try {
      const command = new GetItemCommand(params)
      const data = await client.send(command);
      if (data.Item) {
        const task = unmarshall(data.Item);
        return message.fetch_success('Task', task)
      } else return message.not_found('Task')
    } catch (error) {
      return message.server_error(error)
    }
};

handler.updateTask = async (event) => {
  try{
    const { taskId } = event.pathParameters;
    const updatedTaskData = JSON.parse(event.body)
    const allowedTitleRegex = /^[a-zA-Z0-9#_ ]{3,30}$/; 

    // TODO: Title validation
    if (updatedTaskData.Title && !allowedTitleRegex.test(updatedTaskData.Title)) return message.invalid('Title')
    if (updatedTaskData.status && !['Draft', 'Assigned', 'In-Progress', 'Completed', 'Closed'].includes(updatedTaskData.status)) return message.invalid('status')

    // TODO: check if status is closed or not
    const GetItemParams = {
        TableName: "Task",
        Key: { ID: { S: taskId } },
    };

   
    const existingItem = await client.send(new GetItemCommand(GetItemParams));
    if (existingItem.Item) {
      const doc = unmarshall(existingItem.Item)
      if (doc.Status === 'Closed') return message.custom.can_not_update_closed_task
    } 
    
    const updateExpressionParts = [];
    const expressionAttributeValues = {};
    const ExpressionAttributeNames = {}
    
    if (updatedTaskData.Title) {
        updateExpressionParts.push("#title = :title");
        expressionAttributeValues[":title"] = updatedTaskData.Title
        ExpressionAttributeNames["#title"] = "Title"
    }

    if (updatedTaskData.Description) {
        updateExpressionParts.push("#description = :description");
        expressionAttributeValues[":description"] = updatedTaskData.Description
        ExpressionAttributeNames["#description"] = "Description"
    }

    if (updatedTaskData.Status) {
        updateExpressionParts.push("#status = :status");
        expressionAttributeValues[":status"] = updatedTaskData.Status
        ExpressionAttributeNames["#status"] = "Status"
        if (updatedTaskData.Status === 'Closed') {
          updateExpressionParts.push("#dateClosed = :dateClosed");
          expressionAttributeValues[":dateClosed"] = new Date().toISOString()
          ExpressionAttributeNames["#dateClosed"] = "DateClosed"
        } else if (updatedTaskData.Status === 'Completed') {
          updateExpressionParts.push("#dateCompleted = :dateCompleted");
          expressionAttributeValues[":dateCompleted"] = new Date().toISOString()
          ExpressionAttributeNames["#dateCompleted"] = "DateCompleted"
        }
    }

    if (updatedTaskData.AssignedTo) {
        updateExpressionParts.push("#assignedTo = :assignedTo","#dateAssigned = :dateAssigned");
        expressionAttributeValues[":assignedTo"] =  updatedTaskData.AssignedTo
        expressionAttributeValues[":dateAssigned"] = new Date().toISOString()
        ExpressionAttributeNames["#dateCompleted"] = "DateCompleted"
        ExpressionAttributeNames["#assignedTo"] = "AssignedTo"
    }
    
    const updateExpression = "SET " + updateExpressionParts.join(", ");
    console.log(ExpressionAttributeNames)
    console.log(updateExpression)
    const params = {
      TableName: "Task",
      Key: { "ID": { S: taskId } },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues)
    };
    console.log(params)

    const command = new UpdateItemCommand(params);
    const result = await client.send(command);
    return message.update_success('Task', result)
  }catch (error) {
    return message.server_error(error)
  }
}

handler.getTaskWithMember = async (event) => {
  try{
    const { memberId } = event.pathParameters;
    console.log(memberId)
    const params = {
      TableName: "Task",
      FilterExpression: 'AssinedTo = :value',
      ExpressionAttributeValues:{
        ':value': {S: memberId}
      }
    };

    const command = new ScanCommand(params)
    const data = await client.send(command);
    console.log(data.Items)
    if (data.Items.length) {
      const task = data.Items.map(task => unmarshall(task));
      return message.fetch_success('Tasks', task)
    } else return message.not_found('Task')
  }catch(error) {
    return message.server_error(error)
  }
}

handler.assignTask = async (event) => {
  try {
    const {taskId, memberId} = event.pathParameters;

    const params = {
      TableName: "Task",
      Key: { "ID": { S: taskId } },
      UpdateExpression: "#assignedTo = :assignedTo, #dateAssigned = :dateAssigned",
      ExpressionAttributeNames: { '#assignedTo': AssignedTo, '#dateAssigned': DateAssigned },
      ExpressionAttributeValues: marshall({ ':assignedTo': memberId, ':dateAssigned':  new Date().toISOString() })
    }

    const command = new UpdateItemCommand(params);
    const result = await client.send(command);
    return message.update_success('Task', result)
  } catch (error) {
    return message.server_error(error)
  }
}

handler.acceptTask = async (event) => {
  try {
    const {taskId} = event.pathParameters;

    const params = {
      TableName: "Task",
      Key: { "ID": { S: taskId } },
      UpdateExpression: "#status = :status",
      ExpressionAttributeNames: { '#status': Status, },
      ExpressionAttributeValues: marshall({ ':status': 'In-Progress' })
    }

    const command = new UpdateItemCommand(params);
    const result = await client.send(command);
    return message.update_success('Task', result)
  } catch (error) {
    return message.server_error(error)
  }
}
handler.completeTask = async (event) => {
  try {
    const {taskId} = event.pathParameters;

    const params = {
      TableName: "Task",
      Key: { "ID": { S: taskId } },
      UpdateExpression: "#status = :status",
      ExpressionAttributeNames: { '#status': Status, },
      ExpressionAttributeValues: marshall({ ':status': 'Completed' })
    }

    const command = new UpdateItemCommand(params);
    const result = await client.send(command);
    return message.update_success('Task', result)
  } catch (error) {
    return message.server_error(error)
  }
}

handler.closeTask = async (event) => {
  try {
    const {taskId} = event.pathParameters;

    const params = {
      TableName: "Task",
      Key: { "ID": { S: taskId } },
      UpdateExpression: "#status = :status",
      ExpressionAttributeNames: { '#status': Status, },
      ExpressionAttributeValues: marshall({ ':status': 'Close' })
    }

    const command = new UpdateItemCommand(params);
    const result = await client.send(command);
    return message.update_success('Task', result)
  } catch (error) {
    return message.server_error(error)
  }
}

module.exports = handler