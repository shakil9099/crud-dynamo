const customMessages =  {
    can_not_update_closed_task: { statusCode: 406, body: JSON.stringify({message: 'Can not update task while is in Closed status.'}) },
}


const message = {
    custom: customMessages,
    create_success: (prefix, body) => {
        return { statusCode: 200, body: JSON.stringify({ message: `${prefix} created successfully.`.trim(), body }) }
    },
    update_success: (prefix, body) => {
        return { statusCode: 200, body: JSON.stringify({ message: `${prefix} updated successfully.`.trim(), body }) }
    },
    fetch_success: (prefix, body) => {
        return { statusCode: 200, body: JSON.stringify({ message: `${prefix} fetched successfully.`.trim(), body }) }
    },
    not_found: (prefix) => {
        return { statusCode: 404, body: JSON.stringify({message: `${prefix} not found.`}) }
    },
    invalid: (prefix) => {
        return { statusCode: 406, body: JSON.stringify({message: `${prefix} is not valid.`}) }
    },
    server_error: (error) => {
        return { statusCode: 500, body: JSON.stringify({ message: 'Something went wrong!', errorMessage: error.message }) }
    }
}

module.exports = message
