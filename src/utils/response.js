function success(res, msg, data) {
  return res.status(200).json({
    status: "success",
    message : msg,
    data,
  });
}

function error(res, message) {
  return res.status(500).json({
    status: "error",
    message,
  });
}

module.exports = { success, error };