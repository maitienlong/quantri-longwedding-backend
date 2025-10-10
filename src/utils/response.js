function success(res, msg, data, code = 200) {
  return res.status(code).json({
    status: "success",
    message : msg,
    data,
  });
}

function error(res, message, code = 500) {
  return res.status(code).json({
    status: "error",
    message,
  });
}

module.exports = { success, error };