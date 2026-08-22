function success(res, msg, data) {
  return res.status(200).json({
    status: "success",
    message : msg,
    data,
  });
}

function error(res, message, statusCode = 400) {
  return res.status(statusCode).json({
    status: "error",
    message,
  });
}

module.exports = { success, error };